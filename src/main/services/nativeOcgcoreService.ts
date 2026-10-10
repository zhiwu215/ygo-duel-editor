import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import koffi, { LibraryHandle } from 'koffi'
import {
  CdbCard,
  CustomCard,
  DuelPuzzleState,
  CardLocation,
  CardPosition,
  FieldCard,
  customCardToCdbCard,
  isCustomCardId,
  OcgLocation,
  OcgPosition,
  OcgCardData,
  OcgMessageType,
  OcgResponseType,
  OcgResponse,
  OcgProcessResult,
  OcgQuery,
  OcgCardQueryInfo,
  OcgQueryFlags
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { customCardService } from './customCardService'
import { ZipFileReader } from '../utils/zipFile'

const CardDataStruct = koffi.struct('card_data', {
  code: 'uint32',
  alias: 'uint32',
  setcode: koffi.array('uint16', 16),
  type: 'uint32',
  level: 'uint32',
  attribute: 'uint32',
  race: 'uint32',
  attack: 'int32',
  defense: 'int32',
  lscale: 'uint32',
  rscale: 'uint32',
  link_marker: 'uint32',
  rule_code: 'uint32'
})

const ScriptReaderProto = koffi.proto('uint8_t* (const char* script_name, _Out_ int* len)')
const CardReaderProto = koffi.proto('uint32_t (uint32_t code, _Out_ card_data* data)')
const MessageHandlerProto = koffi.proto('uint32_t (intptr_t pduel, uint32_t msg_type)')

const CORE_SCRIPT_NAMES = ['constant.lua', 'utility.lua', 'procedure.lua'] as const
const EMPTY_SCRIPT = '-- empty fallback script\nfunction initial_effect(c)\nend\n'
const SCRIPT_BUFFER_SIZE = 0x200000
const MSG_BUFFER_SIZE = 0x100000

export interface NativeCreateDuelOptions {
  drawCountPerTurn?: number
  startingDrawCount?: number
  startDuel?: boolean
}

export type NativeDuelHandle = bigint | number

class BinaryReader {
  private view: DataView
  private off = 0

  constructor(buffer: ArrayBuffer, offset = 0, length = buffer.byteLength) {
    this.view = new DataView(buffer, offset, length)
  }

  public get avail(): number {
    return this.view.byteLength - this.off
  }

  public get position(): number {
    return this.off
  }

  public u8(): number {
    if (this.avail < 1) throw new Error('eof')
    const val = this.view.getUint8(this.off)
    this.off += 1
    return val
  }

  public i8(): number {
    if (this.avail < 1) throw new Error('eof')
    const val = this.view.getInt8(this.off)
    this.off += 1
    return val
  }

  public u16(): number {
    if (this.avail < 2) throw new Error('eof')
    const val = this.view.getUint16(this.off, true)
    this.off += 2
    return val
  }

  public i16(): number {
    if (this.avail < 2) throw new Error('eof')
    const val = this.view.getInt16(this.off, true)
    this.off += 2
    return val
  }

  public u32(): number {
    if (this.avail < 4) throw new Error('eof')
    const val = this.view.getUint32(this.off, true)
    this.off += 4
    return val
  }

  public i32(): number {
    if (this.avail < 4) throw new Error('eof')
    const val = this.view.getInt32(this.off, true)
    this.off += 4
    return val
  }

  public u64(): bigint {
    if (this.avail < 8) throw new Error('eof')
    const val = this.view.getBigUint64(this.off, true)
    this.off += 8
    return val
  }

  public i64(): bigint {
    if (this.avail < 8) throw new Error('eof')
    const val = this.view.getBigInt64(this.off, true)
    this.off += 8
    return val
  }

  public bytes(len: number): Uint8Array {
    if (this.avail < len) throw new Error('eof')
    const slice = new Uint8Array(this.view.buffer, this.view.byteOffset + this.off, len)
    this.off += len
    return new Uint8Array(slice)
  }
}

class BinaryWriter {
  private buffer: Uint8Array
  private view: DataView
  private off = 0

  constructor(capacity = 64) {
    this.buffer = new Uint8Array(capacity)
    this.view = new DataView(this.buffer.buffer)
  }

  private ensure(len: number): void {
    if (this.off + len <= this.buffer.byteLength) return
    const next = new Uint8Array(Math.max(this.buffer.byteLength * 2, this.off + len))
    next.set(this.buffer, 0)
    this.buffer = next
    this.view = new DataView(this.buffer.buffer)
  }

  public u8(val: number): this {
    this.ensure(1)
    this.view.setUint8(this.off, val)
    this.off += 1
    return this
  }

  public i8(val: number): this {
    this.ensure(1)
    this.view.setInt8(this.off, val)
    this.off += 1
    return this
  }

  public u16(val: number): this {
    this.ensure(2)
    this.view.setUint16(this.off, val, true)
    this.off += 2
    return this
  }

  public i16(val: number): this {
    this.ensure(2)
    this.view.setInt16(this.off, val, true)
    this.off += 2
    return this
  }

  public u32(val: number): this {
    this.ensure(4)
    this.view.setUint32(this.off, val, true)
    this.off += 4
    return this
  }

  public i32(val: number): this {
    this.ensure(4)
    this.view.setInt32(this.off, val, true)
    this.off += 4
    return this
  }

  public u64(val: bigint): this {
    this.ensure(8)
    this.view.setBigUint64(this.off, val, true)
    this.off += 8
    return this
  }

  public bytes(data: Uint8Array): this {
    this.ensure(data.length)
    this.buffer.set(data, this.off)
    this.off += data.length
    return this
  }

  public toUint8Array(): Uint8Array {
    return this.buffer.subarray(0, this.off)
  }
}

export class NativeOcgcoreService {
  private lib: LibraryHandle | null = null
  private scriptCache = new Map<string, string | null>()
  private dynamicScripts = new Map<string, string>()
  private zipReaders = new Map<string, ZipFileReader | null>()
  public missingCardScriptNames = new Set<string>()

  private scriptBuffer = Buffer.alloc(SCRIPT_BUFFER_SIZE)
  private msgBuffer = Buffer.alloc(MSG_BUFFER_SIZE)

  private create_duel!: (seed: number) => NativeDuelHandle
  private start_duel!: (pduel: NativeDuelHandle, options: number) => void
  private end_duel!: (pduel: NativeDuelHandle) => void
  private set_player_info!: (
    pduel: NativeDuelHandle,
    playerid: number,
    lp: number,
    startcount: number,
    drawcount: number
  ) => void
  private new_card!: (
    pduel: NativeDuelHandle,
    code: number,
    owner: number,
    playerid: number,
    location: number,
    sequence: number,
    position: number
  ) => void
  private ocgProcess!: (pduel: NativeDuelHandle) => number
  private get_message!: (pduel: NativeDuelHandle, buf: Buffer | Uint8Array) => number
  private set_responsei!: (pduel: NativeDuelHandle, value: number) => void
  private set_responseb!: (pduel: NativeDuelHandle, buf: Buffer | Uint8Array) => void
  private preload_script!: (pduel: NativeDuelHandle, name: string) => number
  private query_card!: (
    pduel: NativeDuelHandle,
    playerid: number,
    location: number,
    sequence: number,
    query_flag: number,
    buf: Buffer | Uint8Array,
    use_cache: number
  ) => number
  private query_field_card!: (
    pduel: NativeDuelHandle,
    playerid: number,
    location: number,
    query_flag: number,
    buf: Buffer | Uint8Array,
    use_cache: number
  ) => number
  private query_field_count!: (
    pduel: NativeDuelHandle,
    playerid: number,
    location: number
  ) => number
  private query_field_info!: (pduel: NativeDuelHandle, buf: Buffer | Uint8Array) => number

  constructor() {
    this.initNativeLib()
  }

  private resolveDllPath(): string {
    const candidates = [
      path.join(app.getAppPath(), 'resources', 'engine', 'bin', 'x64', 'ocgcore.dll'),
      path.join(process.cwd(), 'resources', 'engine', 'bin', 'x64', 'ocgcore.dll'),
      path.join(__dirname, '..', '..', '..', 'resources', 'engine', 'bin', 'x64', 'ocgcore.dll')
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return candidates[0]
  }

  private initNativeLib(): void {
    const dllPath = this.resolveDllPath()
    if (!existsSync(dllPath)) {
      throw new Error(`ocgcore.dll not found at: ${dllPath}`)
    }
    this.lib = koffi.load(dllPath)

    const set_script_reader = this.lib.func('set_script_reader', 'void', [
      koffi.pointer(ScriptReaderProto)
    ])
    const set_card_reader = this.lib.func('set_card_reader', 'void', [
      koffi.pointer(CardReaderProto)
    ])
    const set_message_handler = this.lib.func('set_message_handler', 'void', [
      koffi.pointer(MessageHandlerProto)
    ])

    const scriptCallback = koffi.register((scriptName: string, lenPtr: unknown) => {
      const content = this.readScript(scriptName)
      const written = this.scriptBuffer.write(content, 'utf-8')
      koffi.encode(lenPtr, 'int', written)
      return this.scriptBuffer
    }, koffi.pointer(ScriptReaderProto))
    set_script_reader(scriptCallback)

    const cardCallback = koffi.register((code: number, dataPtr: unknown) => {
      const cardData = this.readCardData(code)
      if (!cardData) return 0
      const setcode = Array.from({ length: 16 }, (_, i) => cardData.setcodes[i] || 0)
      koffi.encode(dataPtr, CardDataStruct, {
        code: cardData.code,
        alias: cardData.alias || 0,
        setcode,
        type: cardData.type || 0,
        level: cardData.level || 0,
        attribute: cardData.attribute || 0,
        race: Number(cardData.race || 0n),
        attack: cardData.attack || 0,
        defense: cardData.defense || 0,
        lscale: cardData.lscale || 0,
        rscale: cardData.rscale || 0,
        link_marker: cardData.link_marker || 0,
        rule_code: 0
      })
      return 1
    }, koffi.pointer(CardReaderProto))
    set_card_reader(cardCallback)

    const msgCallback = koffi.register(() => {
      return 0
    }, koffi.pointer(MessageHandlerProto))
    set_message_handler(msgCallback)

    this.create_duel = this.lib.func('create_duel', 'intptr_t', ['uint32'])
    this.start_duel = this.lib.func('start_duel', 'void', ['intptr_t', 'uint32'])
    this.end_duel = this.lib.func('end_duel', 'void', ['intptr_t'])
    this.set_player_info = this.lib.func('set_player_info', 'void', [
      'intptr_t',
      'int32',
      'int32',
      'int32',
      'int32'
    ])
    this.new_card = this.lib.func('new_card', 'void', [
      'intptr_t',
      'uint32',
      'uint8',
      'uint8',
      'uint8',
      'uint8',
      'uint8'
    ])
    this.ocgProcess = this.lib.func('process', 'uint32', ['intptr_t'])
    this.get_message = this.lib.func('get_message', 'int32', ['intptr_t', '_Out_ uint8_t*'])
    this.set_responsei = this.lib.func('set_responsei', 'void', ['intptr_t', 'int32'])
    this.set_responseb = this.lib.func('set_responseb', 'void', ['intptr_t', 'uint8_t*'])
    this.preload_script = this.lib.func('preload_script', 'int32', ['intptr_t', 'const char*'])
    this.query_card = this.lib.func('query_card', 'int32', [
      'intptr_t',
      'uint8',
      'uint8',
      'uint8',
      'uint32',
      '_Out_ uint8_t*',
      'int32'
    ])
    this.query_field_card = this.lib.func('query_field_card', 'int32', [
      'intptr_t',
      'uint8',
      'uint8',
      'uint32',
      '_Out_ uint8_t*',
      'int32'
    ])
    this.query_field_count = this.lib.func('query_field_count', 'int32', [
      'intptr_t',
      'uint8',
      'uint8'
    ])
    this.query_field_info = this.lib.func('query_field_info', 'int32', [
      'intptr_t',
      '_Out_ uint8_t*'
    ])
  }

  public resetScriptCache(): void {
    this.scriptCache.clear()
    for (const reader of this.zipReaders.values()) {
      reader?.close()
    }
    this.zipReaders.clear()
  }

  private scriptRoots(): string[] {
    const cfg = configService.get()
    const roots: string[] = []
    if (cfg.gameDirectory) roots.push(cfg.gameDirectory)
    for (const cdbPath of cfg.extraCdbPaths || []) {
      if ((cfg.disabledCdbPaths || []).includes(cdbPath)) continue
      let current = path.dirname(cdbPath)
      for (let depth = 0; depth < 4 && current && current !== path.parse(current).root; depth++) {
        roots.push(current)
        current = path.dirname(current)
      }
    }
    const seen = new Set<string>()
    return roots.filter((root) => {
      if (!root) return false
      if (seen.has(root)) return false
      seen.add(root)
      return true
    })
  }

  private readScriptFile(root: string, name: string): string | null {
    const cleanName = name.replace(/^(\.\/)?(script[/\\])?/, '')
    const cacheKey = `${root}\u0000${cleanName}`
    if (this.scriptCache.has(cacheKey)) return this.scriptCache.get(cacheKey) ?? null
    let content: string | null = null
    const fileName = cleanName.endsWith('.lua') ? cleanName : `${cleanName}.lua`
    const candidates = [path.join(root, 'script', fileName), path.join(root, fileName)]
    for (const fullPath of candidates) {
      if (existsSync(fullPath)) {
        try {
          content = readFileSync(fullPath, 'utf-8')
          break
        } catch (err) {
          console.error(`[NativeOcgcoreService] Failed to read script ${fullPath}:`, err)
        }
      }
    }
    if (content === null) {
      content = this.readZipScript(root, fileName)
    }
    this.scriptCache.set(cacheKey, content)
    return content
  }

  private readZipScript(root: string, fileName: string): string | null {
    const zipPath = path.join(root, 'expansions', 'script.zip')
    const cacheKey = zipPath
    let reader = this.zipReaders.get(cacheKey)
    if (reader === undefined) {
      reader = ZipFileReader.open(zipPath)
      this.zipReaders.set(cacheKey, reader)
    }
    if (!reader) return null
    const data = reader.read(fileName)
    if (!data) return null
    return data.toString('utf-8')
  }

  public readScriptRaw(name: string): string | null {
    for (const root of this.scriptRoots()) {
      const content = this.readScriptFile(root, name)
      if (content !== null) return content
    }
    return null
  }

  public readScript(name: string): string {
    const cleanName = name.replace(/^(\.\/)?(script[/\\])?/, '')
    if (this.dynamicScripts.has(cleanName)) {
      return this.dynamicScripts.get(cleanName)!
    }
    if (this.dynamicScripts.has(name)) {
      return this.dynamicScripts.get(name)!
    }
    const content = this.readScriptRaw(cleanName)
    if (content !== null) return content
    if (/(^|[/\\])c\d+\.lua$/.test(cleanName)) {
      this.missingCardScriptNames.add(cleanName)
    }
    return EMPTY_SCRIPT
  }

  public readCardDataOf(cdbCard: CdbCard): OcgCardData {
    const setcodes: number[] = []
    if (cdbCard.setcode) {
      let val = BigInt(cdbCard.setcode)
      for (let i = 0; i < 4; i++) {
        const chunk = Number(val & 0xffffn)
        if (chunk > 0) setcodes.push(chunk)
        val >>= 16n
      }
    }
    return {
      code: cdbCard.id,
      alias: cdbCard.alias || 0,
      setcodes,
      type: cdbCard.type || 0x11,
      level: (cdbCard.level || 1) & 0xff,
      attribute: cdbCard.attribute || 1,
      race: BigInt(cdbCard.race || 1),
      attack: cdbCard.atk || 0,
      defense: cdbCard.def || 0,
      lscale: ((cdbCard.level || 0) >> 24) & 0xff,
      rscale: ((cdbCard.level || 0) >> 16) & 0xff,
      link_marker: cdbCard.def || 0
    }
  }

  public readCardData(code: number): OcgCardData | null {
    const dict = cdbService.getCardsByIds([code])
    const cdbCard = dict[code]
    if (cdbCard) return this.readCardDataOf(cdbCard)
    if (isCustomCardId(code)) {
      const custom: CustomCard | null = customCardService.getById(code)
      if (custom) return this.readCardDataOf(customCardToCdbCard(custom))
    }
    return null
  }

  private mapLocation(loc: number): number {
    switch (loc) {
      case CardLocation.DECK:
        return OcgLocation.DECK
      case CardLocation.HAND:
        return OcgLocation.HAND
      case CardLocation.MZONE:
        return OcgLocation.MZONE
      case CardLocation.SZONE:
        return OcgLocation.SZONE
      case CardLocation.FZONE:
        return OcgLocation.FZONE
      case CardLocation.GRAVE:
        return OcgLocation.GRAVE
      case CardLocation.REMOVED:
        return OcgLocation.REMOVED
      case CardLocation.EXTRA:
        return OcgLocation.EXTRA
      case CardLocation.PZONE:
        return OcgLocation.PZONE
      default:
        return OcgLocation.DECK
    }
  }

  private mapPosition(pos: number): number {
    switch (pos) {
      case CardPosition.FACEUP_ATTACK:
        return OcgPosition.FACEUP_ATTACK
      case CardPosition.FACEDOWN_ATTACK:
        return OcgPosition.FACEDOWN_ATTACK
      case CardPosition.FACEUP_DEFENSE:
        return OcgPosition.FACEUP_DEFENSE
      case CardPosition.FACEDOWN_DEFENSE:
        return OcgPosition.FACEDOWN_DEFENSE
      case CardPosition.FACEUP:
        return OcgPosition.FACEUP
      case CardPosition.FACEDOWN:
        return OcgPosition.FACEDOWN
      default:
        return OcgPosition.FACEUP_ATTACK
    }
  }

  public getVersion(): [number, number] {
    return [0x13, 0x62]
  }

  public createDuel(options: {
    team1: { startingLP: number; startingDrawCount: number; drawCountPerTurn: number }
    team2: { startingLP: number; startingDrawCount: number; drawCountPerTurn: number }
  }): NativeDuelHandle {
    const handle = this.create_duel(0x12345678)
    this.set_player_info(
      handle,
      0,
      options.team1.startingLP,
      options.team1.startingDrawCount,
      options.team1.drawCountPerTurn
    )
    this.set_player_info(
      handle,
      1,
      options.team2.startingLP,
      options.team2.startingDrawCount,
      options.team2.drawCountPerTurn
    )
    return handle
  }

  public destroyDuel(handle: NativeDuelHandle): void {
    this.end_duel(handle)
  }

  public duelNewCard(
    handle: NativeDuelHandle,
    card: {
      team: number
      code: number
      controller: number
      location: number
      sequence: number
      position: number
    }
  ): void {
    this.new_card(
      handle,
      card.code,
      card.controller,
      card.controller,
      card.location,
      card.sequence,
      card.position
    )
  }

  public startDuel(handle: NativeDuelHandle, options = 5 << 16): void {
    this.start_duel(handle, options)
  }

  public duelProcess(handle: NativeDuelHandle): number {
    const res = this.ocgProcess(handle)
    if ((res & 0x10000000) !== 0) return OcgProcessResult.WAITING
    if ((res & 0x20000000) !== 0) return OcgProcessResult.END
    return OcgProcessResult.CONTINUE
  }

  public duelGetMessage(handle: NativeDuelHandle): Array<Record<string, unknown>> {
    const len = this.get_message(handle, this.msgBuffer)
    if (len <= 0) return []
    const reader = new BinaryReader(this.msgBuffer.buffer, this.msgBuffer.byteOffset, len)
    const list: Array<Record<string, unknown>> = []
    while (reader.avail > 0) {
      const msg = this.parseMessage(reader)
      if (!msg) break
      list.push(msg)
    }
    return list
  }

  private parsePos(reader: BinaryReader): {
    controller: number
    location: number
    sequence: number
    position: number
  } {
    const packed = reader.u32()
    return {
      controller: packed & 0xff,
      location: (packed >>> 8) & 0xff,
      sequence: (packed >>> 16) & 0xff,
      position: (packed >>> 24) & 0x7f
    }
  }

  private parseMessage(reader: BinaryReader): Record<string, unknown> | null {
    if (reader.avail < 1) return null
    const type = reader.u8()
    switch (type) {
      case OcgMessageType.RETRY:
        return { type }
      case OcgMessageType.HINT:
        return {
          type,
          hint_type: reader.u8(),
          player: reader.u8(),
          hint: reader.u32()
        }
      case OcgMessageType.WAITING:
        return { type }
      case OcgMessageType.START:
        return { type }
      case OcgMessageType.WIN:
        return { type, player: reader.u8(), reason: reader.u8() }
      case OcgMessageType.SELECT_BATTLECMD:
        return {
          type,
          player: reader.u8(),
          chains: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            description: reader.u64(),
            client_mode: reader.u8()
          })),
          attacks: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            can_direct: reader.u8() !== 0
          })),
          to_m2: reader.u8() !== 0,
          to_ep: reader.u8() !== 0
        }
      case OcgMessageType.SELECT_IDLECMD:
        return {
          type,
          player: reader.u8(),
          summons: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          })),
          special_summons: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          })),
          pos_changes: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          })),
          monster_sets: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          })),
          spell_sets: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          })),
          activates: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            description: reader.u32()
          })),
          to_bp: reader.u8() !== 0,
          to_ep: reader.u8() !== 0,
          shuffle: reader.u8() !== 0
        }
      case OcgMessageType.SELECT_EFFECTYN:
        return {
          type,
          player: reader.u8(),
          code: reader.u32(),
          ...this.parsePos(reader),
          description: reader.u32()
        }
      case OcgMessageType.SELECT_YESNO:
        return { type, player: reader.u8(), description: reader.u32() }
      case OcgMessageType.SELECT_OPTION:
        return {
          type,
          player: reader.u8(),
          options: Array.from({ length: reader.u8() }, () => reader.u32())
        }
      case OcgMessageType.SELECT_CARD:
        return {
          type,
          player: reader.u8(),
          can_cancel: reader.u8() !== 0,
          min: reader.u8(),
          max: reader.u8(),
          selects: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            ...this.parsePos(reader)
          }))
        }
      case OcgMessageType.SELECT_CHAIN: {
        const player = reader.u8()
        const count = reader.u8()
        const speCount = reader.u8()
        const hintTiming = reader.u32()
        const hintTimingOther = reader.u32()
        const selects = Array.from({ length: count }, () => ({
          edesc: reader.u8(),
          forced: reader.u8() !== 0,
          code: reader.u32(),
          ...this.parsePos(reader),
          description: reader.u32()
        }))
        return {
          type,
          player,
          spe_count: speCount,
          forced: selects.some((s) => s.forced),
          hint_timing: hintTiming,
          hint_timing_other: hintTimingOther,
          selects
        }
      }
      case OcgMessageType.SELECT_PLACE:
        return { type, player: reader.u8(), count: reader.u8(), field_mask: reader.u32() }
      case OcgMessageType.SELECT_POSITION:
        return { type, player: reader.u8(), code: reader.u32(), positions: reader.u8() }
      case OcgMessageType.SELECT_TRIBUTE:
        return {
          type,
          player: reader.u8(),
          can_cancel: reader.u8() !== 0,
          min: reader.u8(),
          max: reader.u8(),
          selects: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            release_param: reader.u8()
          }))
        }
      case OcgMessageType.SORT_CHAIN:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          }))
        }
      case OcgMessageType.SELECT_COUNTER:
        return {
          type,
          player: reader.u8(),
          counter_type: reader.u16(),
          count: reader.u16(),
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            count: reader.u16()
          }))
        }
      case OcgMessageType.SELECT_SUM:
        return {
          type,
          select_max: reader.u8(),
          player: reader.u8(),
          amount: reader.u32(),
          min: reader.u8(),
          max: reader.u8(),
          selects_must: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            amount: reader.u32()
          })),
          selects: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8(),
            amount: reader.u32()
          }))
        }
      case OcgMessageType.SELECT_DISFIELD:
        return { type, player: reader.u8(), count: reader.u8(), field_mask: reader.u32() }
      case OcgMessageType.SORT_CARD:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          }))
        }
      case OcgMessageType.SELECT_UNSELECT_CARD:
        return {
          type,
          player: reader.u8(),
          can_finish: reader.u8() !== 0,
          can_cancel: reader.u8() !== 0,
          min: reader.u8(),
          max: reader.u8(),
          select_cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            ...this.parsePos(reader)
          })),
          unselect_cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            ...this.parsePos(reader)
          }))
        }
      case OcgMessageType.CONFIRM_DECKTOP:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          }))
        }
      case OcgMessageType.CONFIRM_CARDS:
        return {
          type,
          player: reader.u8(),
          skip_panel: reader.u8() !== 0,
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          }))
        }
      case OcgMessageType.SHUFFLE_DECK:
        return { type, player: reader.u8() }
      case OcgMessageType.SHUFFLE_HAND:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => reader.u32())
        }
      case OcgMessageType.REFRESH_DECK:
        return { type }
      case OcgMessageType.SHUFFLE_SET_CARD:
        return {
          type,
          location: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => ({
            from: this.parsePos(reader),
            to: this.parsePos(reader)
          }))
        }
      case OcgMessageType.NEW_TURN:
        return { type, player: reader.u8() }
      case OcgMessageType.NEW_PHASE:
        return { type, phase: reader.u16() }
      case OcgMessageType.MOVE:
        return {
          type,
          card: reader.u32(),
          from: this.parsePos(reader),
          to: this.parsePos(reader),
          reason: reader.i32()
        }
      case OcgMessageType.POS_CHANGE:
        return {
          type,
          code: reader.u32(),
          controller: reader.u8(),
          location: reader.u8(),
          sequence: reader.u8(),
          prev_position: reader.u8(),
          position: reader.u8()
        }
      case OcgMessageType.SET:
        return { type, code: reader.u32(), ...this.parsePos(reader) }
      case OcgMessageType.SWAP:
        return {
          type,
          card1: { code: reader.u32(), ...this.parsePos(reader) },
          card2: { code: reader.u32(), ...this.parsePos(reader) }
        }
      case OcgMessageType.FIELD_DISABLED:
        return { type, field_mask: reader.u32() }
      case OcgMessageType.SUMMONING:
        return { type, code: reader.u32(), ...this.parsePos(reader) }
      case OcgMessageType.SUMMONED:
        return { type }
      case OcgMessageType.SPSUMMONING:
        return { type, code: reader.u32(), ...this.parsePos(reader) }
      case OcgMessageType.SPSUMMONED:
        return { type }
      case OcgMessageType.FLIPSUMMONING:
        return { type, code: reader.u32(), ...this.parsePos(reader) }
      case OcgMessageType.FLIPSUMMONED:
        return { type }
      case OcgMessageType.CHAINING:
        return {
          type,
          code: reader.u32(),
          ...this.parsePos(reader),
          triggering_controller: reader.u8(),
          triggering_location: reader.u8(),
          triggering_sequence: reader.u8(),
          description: reader.u32(),
          chain_size: reader.u8()
        }
      case OcgMessageType.CHAINED:
        return { type, chain_size: reader.u8() }
      case OcgMessageType.CHAIN_SOLVING:
        return { type, chain_size: reader.u8() }
      case OcgMessageType.CHAIN_SOLVED:
        return { type, chain_size: reader.u8() }
      case OcgMessageType.CHAIN_END:
        return { type }
      case OcgMessageType.CHAIN_NEGATED:
        return { type, chain_size: reader.u8() }
      case OcgMessageType.CHAIN_DISABLED:
        return { type, chain_size: reader.u8() }
      case OcgMessageType.CARD_SELECTED:
        return {
          type,
          cards: Array.from({ length: reader.u8() }, () => this.parsePos(reader))
        }
      case OcgMessageType.RANDOM_SELECTED:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => this.parsePos(reader))
        }
      case OcgMessageType.BECOME_TARGET:
        return {
          type,
          cards: Array.from({ length: reader.u8() }, () => this.parsePos(reader))
        }
      case OcgMessageType.DRAW:
        return {
          type,
          player: reader.u8(),
          drawn: Array.from({ length: reader.u8() }, () => {
            const raw = reader.u32()
            return { code: raw & 0x7fffffff, faceup: raw >>> 31 === 1 }
          })
        }
      case OcgMessageType.DAMAGE:
        return { type, player: reader.u8(), amount: reader.u32() }
      case OcgMessageType.RECOVER:
        return { type, player: reader.u8(), amount: reader.u32() }
      case OcgMessageType.EQUIP:
        return { type, card: this.parsePos(reader), target: this.parsePos(reader) }
      case OcgMessageType.LPUPDATE:
        return { type, player: reader.u8(), lp: reader.u32() }
      case OcgMessageType.CARD_TARGET:
        return { type, card: this.parsePos(reader), target: this.parsePos(reader) }
      case OcgMessageType.CANCEL_TARGET:
        return { type, card: this.parsePos(reader), target: this.parsePos(reader) }
      case OcgMessageType.PAY_LPCOST:
        return { type, player: reader.u8(), amount: reader.u32() }
      case OcgMessageType.ADD_COUNTER:
        return {
          type,
          counter_type: reader.u16(),
          controller: reader.u8(),
          location: reader.u8(),
          sequence: reader.u8(),
          count: reader.u16()
        }
      case OcgMessageType.REMOVE_COUNTER:
        return {
          type,
          counter_type: reader.u16(),
          controller: reader.u8(),
          location: reader.u8(),
          sequence: reader.u8(),
          count: reader.u16()
        }
      case OcgMessageType.ATTACK:
        return { type, card: this.parsePos(reader), target: this.parsePos(reader) }
      case OcgMessageType.ATTACK_DISABLED:
        return { type }
      case OcgMessageType.DAMAGE_STEP_START:
        return { type }
      case OcgMessageType.DAMAGE_STEP_END:
        return { type }
      case OcgMessageType.DECK_TOP:
        return {
          type,
          player: reader.u8(),
          count: reader.u8(),
          code: reader.u32()
        }
      case OcgMessageType.CONFIRM_EXTRATOP:
        return {
          type,
          player: reader.u8(),
          cards: Array.from({ length: reader.u8() }, () => ({
            code: reader.u32(),
            controller: reader.u8(),
            location: reader.u8(),
            sequence: reader.u8()
          }))
        }
      case OcgMessageType.SWAP_GRAVE_DECK:
        return { type, player: reader.u8() }
      case OcgMessageType.REVERSE_DECK:
        return { type }
      case OcgMessageType.TOSS_COIN:
      case OcgMessageType.TOSS_DICE:
        return {
          type,
          player: reader.u8(),
          count: reader.u8(),
          res: Array.from({ length: reader.u8() }, () => reader.u8())
        }
      case OcgMessageType.HAND_RES:
        return { type, res: reader.u8() }
      case OcgMessageType.ROCK_PAPER_SCISSORS:
        return { type, player: reader.u8() }
      case OcgMessageType.ANNOUNCE_RACE:
      case OcgMessageType.ANNOUNCE_ATTRIB:
        return {
          type,
          player: reader.u8(),
          count: reader.u8(),
          available: reader.u32()
        }
      case OcgMessageType.ANNOUNCE_CARD:
      case OcgMessageType.ANNOUNCE_NUMBER:
        return {
          type,
          player: reader.u8(),
          options: Array.from({ length: reader.u8() }, () => reader.u32())
        }
      case OcgMessageType.MISSED_EFFECT:
        return { type, card: this.parsePos(reader), code: reader.u32() }
      case OcgMessageType.MATCH_KILL:
        return { type, code: reader.u32() }
      case OcgMessageType.CARD_HINT:
        return {
          type,
          card: this.parsePos(reader),
          hint_type: reader.u8(),
          description: reader.u32()
        }
      case OcgMessageType.PLAYER_HINT:
        return {
          type,
          player: reader.u8(),
          hint_type: reader.u8(),
          description: reader.u32()
        }
      case OcgMessageType.SHOW_HINT:
      case OcgMessageType.AI_NAME: {
        const len = reader.u16()
        const text = new TextDecoder().decode(reader.bytes(len))
        reader.u8()
        return { type, text }
      }
      case OcgMessageType.RELOAD_FIELD: {
        const rule = reader.u8()
        const players = Array.from({ length: 2 }, () => {
          const lp = reader.i32()
          const monsters = Array.from({ length: 7 }, () => {
            const has = reader.u8()
            if (!has) return null
            return { position: reader.u8(), materials: reader.u8() }
          })
          const spells = Array.from({ length: 8 }, () => {
            const has = reader.u8()
            if (!has) return null
            return { position: reader.u8() }
          })
          return {
            lp,
            monsters,
            spells,
            deck: reader.u8(),
            hand: reader.u8(),
            grave: reader.u8(),
            removed: reader.u8(),
            extra: reader.u8(),
            extraP: reader.u8()
          }
        })
        const chain = Array.from({ length: reader.u8() }, () => ({
          code: reader.u32(),
          ...this.parsePos(reader),
          triggering_controller: reader.u8(),
          triggering_location: reader.u8(),
          triggering_sequence: reader.u8(),
          description: reader.u32()
        }))
        return { type, rule, players, chain }
      }
      default:
        console.warn(`[NativeOcgcoreService] unhandled message type ${type}, stop parsing rest`)
        return null
    }
  }

  public duelSetResponse(handle: NativeDuelHandle, response: OcgResponse): void {
    switch (response.type) {
      case OcgResponseType.SELECT_IDLECMD:
      case OcgResponseType.SELECT_BATTLECMD: {
        const val = ((response.action ?? 0) & 0xffff) | (((response.index ?? 0) & 0xffff) << 16)
        this.set_responsei(handle, val)
        return
      }
      case OcgResponseType.SELECT_EFFECTYN:
      case OcgResponseType.SELECT_YESNO: {
        this.set_responsei(handle, response.yes ? 1 : 0)
        return
      }
      case OcgResponseType.SELECT_OPTION: {
        this.set_responsei(handle, response.index ?? 0)
        return
      }
      case OcgResponseType.SELECT_CHAIN: {
        this.set_responsei(
          handle,
          response.index === null || response.index === undefined ? -1 : response.index
        )
        return
      }
      case OcgResponseType.SELECT_POSITION: {
        this.set_responsei(handle, response.position ?? 0)
        return
      }
      case OcgResponseType.SELECT_CARD:
      case OcgResponseType.SELECT_TRIBUTE: {
        if (!response.indicies || response.indicies.length === 0) {
          this.set_responsei(handle, -1)
          return
        }
        const writer = new BinaryWriter()
        writer.i8(response.indicies.length)
        for (const idx of response.indicies) {
          writer.i8(idx)
        }
        this.set_responseb(handle, writer.toUint8Array())
        return
      }
      case OcgResponseType.SELECT_SUM: {
        const indicies = response.indicies ?? []
        const writer = new BinaryWriter()
        if (indicies.length === 0) {
          writer.i8(0)
        } else {
          writer.i8(indicies.length)
          for (const idx of indicies) {
            writer.i8(idx)
          }
        }
        this.set_responseb(handle, writer.toUint8Array())
        return
      }
      case OcgResponseType.SELECT_PLACE:
      case OcgResponseType.SELECT_DISFIELD: {
        const places = response.places ?? []
        if (places.length === 0) {
          this.set_responsei(handle, -1)
          return
        }
        const writer = new BinaryWriter()
        for (const p of places) {
          writer.u8(p.player)
          writer.u8(p.location)
          writer.u8(p.sequence)
        }
        this.set_responseb(handle, writer.toUint8Array())
        return
      }
      case OcgResponseType.SELECT_COUNTER: {
        const counters = response.counters ?? []
        const writer = new BinaryWriter()
        for (const c of counters) {
          writer.i16(c)
        }
        this.set_responseb(handle, writer.toUint8Array())
        return
      }
      case OcgResponseType.SORT_CARD: {
        const order = response.order ?? []
        const writer = new BinaryWriter()
        if (order.length === 0) {
          writer.i8(-1)
        } else {
          writer.u8(order.length)
          for (const idx of order) {
            writer.i8(idx)
          }
        }
        this.set_responseb(handle, writer.toUint8Array())
        return
      }
      default: {
        this.set_responsei(handle, -1)
        return
      }
    }
  }

  public duelQueryCount(handle: NativeDuelHandle, playerid: number, location: number): number {
    return this.query_field_count(handle, playerid, location)
  }

  public duelQueryCard(
    handle: NativeDuelHandle,
    playerid: number,
    location: number,
    sequence: number,
    queryFlag: number,
    buf: Buffer | Uint8Array,
    useCache = 0
  ): number {
    return this.query_card(handle, playerid, location, sequence, queryFlag, buf, useCache)
  }

  public duelQueryFieldCard(
    handle: NativeDuelHandle,
    playerid: number,
    location: number,
    queryFlag: number,
    buf: Buffer | Uint8Array,
    useCache = 0
  ): number {
    return this.query_field_card(handle, playerid, location, queryFlag, buf, useCache)
  }

  public duelQuery(handle: NativeDuelHandle, query: OcgQuery): Partial<OcgCardQueryInfo> | null {
    const buf = Buffer.alloc(1024)
    const len = this.query_card(
      handle,
      query.controller,
      query.location,
      query.sequence,
      query.flags,
      buf,
      0
    )
    if (len <= 4) return null
    const reader = new BinaryReader(buf.buffer, buf.byteOffset, len)
    const totalLen = reader.i32()
    if (totalLen <= 4) return null
    const flags = reader.u32()
    const res: Partial<OcgCardQueryInfo> = {}
    if ((flags & OcgQueryFlags.CODE) !== 0) {
      res.code = reader.u32()
    }
    if ((flags & OcgQueryFlags.POSITION) !== 0) {
      const locInfo = reader.u32()
      res.position = (locInfo >>> 24) & 0xff
    }
    if ((flags & OcgQueryFlags.ALIAS) !== 0) {
      res.alias = reader.u32()
    }
    if ((flags & OcgQueryFlags.TYPE) !== 0) {
      res.type = reader.u32()
    }
    if ((flags & OcgQueryFlags.LEVEL) !== 0) {
      res.level = reader.u32()
    }
    if ((flags & OcgQueryFlags.RANK) !== 0) {
      res.rank = reader.u32()
    }
    if ((flags & OcgQueryFlags.ATTRIBUTE) !== 0) {
      res.attribute = reader.u32()
    }
    if ((flags & OcgQueryFlags.RACE) !== 0) {
      res.race = BigInt(reader.u32())
    }
    if ((flags & OcgQueryFlags.ATTACK) !== 0) {
      res.attack = reader.i32()
    }
    if ((flags & OcgQueryFlags.DEFENSE) !== 0) {
      res.defense = reader.i32()
    }
    if ((flags & OcgQueryFlags.BASE_ATTACK) !== 0) {
      res.baseAttack = reader.i32()
    }
    if ((flags & OcgQueryFlags.BASE_DEFENSE) !== 0) {
      res.baseDefense = reader.i32()
    }
    if ((flags & OcgQueryFlags.REASON) !== 0) {
      res.reason = reader.u32()
    }
    if ((flags & OcgQueryFlags.REASON_CARD) !== 0) {
      reader.u32()
    }
    if ((flags & OcgQueryFlags.EQUIP_CARD) !== 0) {
      reader.u32()
    }
    if ((flags & OcgQueryFlags.TARGET_CARD) !== 0) {
      const count = reader.i32()
      for (let i = 0; i < count; i++) reader.u32()
    }
    if ((flags & OcgQueryFlags.OVERLAY_CARD) !== 0) {
      const count = reader.i32()
      const arr: number[] = []
      for (let i = 0; i < count; i++) arr.push(reader.u32())
      res.overlayCards = arr
    }
    if ((flags & OcgQueryFlags.COUNTERS) !== 0) {
      const count = reader.i32()
      const counters: Record<number, number> = {}
      for (let i = 0; i < count; i++) {
        const tdata = reader.u32()
        const ctype = tdata & 0xffff
        const ccount = (tdata >>> 16) & 0xffff
        counters[ctype] = ccount
      }
      res.counters = counters
    }
    if ((flags & OcgQueryFlags.OWNER) !== 0) {
      res.owner = reader.i32()
    }
    if ((flags & OcgQueryFlags.STATUS) !== 0) {
      res.status = reader.u32()
    }
    if ((flags & OcgQueryFlags.LSCALE) !== 0) {
      res.leftScale = reader.u32()
    }
    if ((flags & OcgQueryFlags.RSCALE) !== 0) {
      res.rightScale = reader.u32()
    }
    if ((flags & OcgQueryFlags.LINK) !== 0) {
      res.link = { rating: reader.u32(), marker: reader.u32() }
    }
    return res
  }

  public async getCore(): Promise<NativeOcgcoreService> {
    return this
  }

  public duelEnd(handle: NativeDuelHandle): void {
    this.end_duel(handle)
  }

  public duelQueryField(handle: NativeDuelHandle): {
    rule: number
    players: Array<{
      lp: number
      monsters: Array<{ position: number; materials: number } | null>
      spells: Array<{ position: number } | null>
      deck: number
      hand: number
      grave: number
      removed: number
      extra: number
      extraP: number
    }>
    chain: Array<{
      code: number
      controller: number
      location: number
      sequence: number
      position: number
      description: number
    }>
  } {
    const buf = Buffer.alloc(1024)
    const len = this.query_field_info(handle, buf)
    const reader = new BinaryReader(buf.buffer, buf.byteOffset, Math.max(len, 2))
    reader.u8()
    const rule = reader.u8()
    const players = Array.from({ length: 2 }, () => ({
      lp: reader.i32(),
      monsters: Array.from({ length: 7 }, () => {
        const has = reader.u8()
        if (!has) return null
        return { position: reader.u8(), materials: reader.u8() }
      }),
      spells: Array.from({ length: 8 }, () => {
        const has = reader.u8()
        if (!has) return null
        return { position: reader.u8() }
      }),
      deck: reader.u8(),
      hand: reader.u8(),
      grave: reader.u8(),
      removed: reader.u8(),
      extra: reader.u8(),
      extraP: reader.u8()
    }))
    const chain = Array.from({ length: reader.u8() }, () => ({
      code: reader.u32(),
      ...this.parsePos(reader),
      triggering_controller: reader.u8(),
      triggering_location: reader.u8(),
      triggering_sequence: reader.u8(),
      description: reader.u32()
    }))
    return { rule, players, chain }
  }

  public loadScript(handle: NativeDuelHandle, name: string, content?: string): boolean {
    if (content) {
      this.dynamicScripts.set(name, content)
    }
    const res = this.preload_script(handle, name)
    return res === 1
  }

  public async createDuelFromState(
    state: DuelPuzzleState,
    options: NativeCreateDuelOptions = {}
  ): Promise<{ handle: NativeDuelHandle | null; core: NativeOcgcoreService; cardCount: number }> {
    const handle = this.createDuel({
      team1: {
        startingLP: state.players[0]?.lp || 8000,
        startingDrawCount: options.startingDrawCount ?? 0,
        drawCountPerTurn: options.drawCountPerTurn ?? 1
      },
      team2: {
        startingLP: state.players[1]?.lp || 8000,
        startingDrawCount: options.startingDrawCount ?? 0,
        drawCountPerTurn: options.drawCountPerTurn ?? 1
      }
    })

    for (const coreScript of CORE_SCRIPT_NAMES) {
      this.loadScript(handle, coreScript)
    }

    let cardCount = 0
    const byLocation = new Map<number, FieldCard[]>()
    for (const card of state.cards) {
      if (this.readCardData(card.code) === null) continue
      const list = byLocation.get(card.location) ?? []
      list.push(card)
      byLocation.set(card.location, list)
    }

    const addCard = (card: FieldCard, ocgLoc: number, sequence: number): void => {
      const ocgPos = this.mapPosition(card.position)
      this.duelNewCard(handle, {
        team: card.controller,
        code: card.code,
        controller: card.controller,
        location: ocgLoc,
        sequence,
        position: ocgPos
      })
      cardCount++
    }

    const deckCards = [...(byLocation.get(CardLocation.DECK) ?? [])].sort(
      (a, b) => a.sequence - b.sequence
    )
    for (let i = deckCards.length - 1; i >= 0; i--) {
      addCard(deckCards[i], OcgLocation.DECK, 0)
    }
    for (const [loc, cards] of byLocation) {
      if (loc === CardLocation.DECK) continue
      const ocgLoc = this.mapLocation(loc)
      const ordered =
        loc === CardLocation.MZONE || loc === CardLocation.SZONE || loc === CardLocation.PZONE
          ? cards
          : [...cards].sort((a, b) => a.sequence - b.sequence)
      for (const card of ordered) {
        const sequence =
          loc === CardLocation.MZONE || loc === CardLocation.SZONE || loc === CardLocation.PZONE
            ? card.sequence
            : 0
        addCard(card, ocgLoc, sequence)
      }
    }

    if (options.startDuel !== false) {
      const masterRule = state.masterRule ?? 5
      const duelRule = masterRule >= 1 && masterRule <= 5 ? masterRule : 5
      const duelOptions = (state.firstTurnAttack ? 0x2 : 0) | 0x10
      this.startDuel(handle, (duelRule << 16) | duelOptions)
    }

    return { handle, core: this, cardCount }
  }

  public seedCounters(handle: NativeDuelHandle, cards: FieldCard[]): void {
    const seedable = new Set<number>([
      CardLocation.MZONE,
      CardLocation.SZONE,
      CardLocation.FZONE,
      CardLocation.PZONE
    ])
    const lines: string[] = []
    for (const card of cards) {
      if (!seedable.has(card.location)) continue
      const pairs = Object.entries(card.counters ?? {}).filter(([, n]) => n > 0)
      if (pairs.length === 0) continue
      const counterObj = `{${pairs.map(([t, n]) => `[${t}]=${n}`).join(',')}}`
      lines.push(
        `{ con=${card.controller}, loc=${this.mapLocation(card.location)}, seq=${card.sequence}, counters=${counterObj} },`
      )
    }
    if (lines.length === 0) return
    const snippet = [
      'local probe_counters = {',
      ...lines,
      '}',
      'for _,info in ipairs(probe_counters) do',
      '  local h=Duel.GetFieldCard(info.con, info.loc, info.seq)',
      '  if h then',
      '    for t,n in pairs(info.counters) do',
      '      h:AddCounter(t, n)',
      '    end',
      '  end',
      'end'
    ].join('\n')
    this.loadScript(handle, 'ygo_duel_editor_counter_seed.lua', snippet)
  }
}

export const nativeOcgcoreService = new NativeOcgcoreService()
