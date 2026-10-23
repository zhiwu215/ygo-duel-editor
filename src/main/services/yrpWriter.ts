export const YRP2_ID = 0x32707279
export const YRP_VERSION = 0x1362
export const YRP_FLAG_TAG = 0x2
export const YRP_FLAG_UNIFORM = 0x10
export const YRP_FLAG_SINGLE_MODE = 0x8
export const YRP_MAX_PAYLOAD = 0x80000
export const DUEL_PSEUDO_SHUFFLE = 0x10
const DUEL_REVEAL_DECK_SEQ = 0x100
const DUEL_ATTACK_FIRST_TURN = 0x2
const DUEL_TAG_MODE = 0x20

class ByteWriter {
  private buf: number[] = []

  public u8(v: number): void {
    this.buf.push(v & 0xff)
  }

  public u16(v: number): void {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff)
  }

  public i32(v: number): void {
    const n = v | 0
    this.buf.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)
  }

  public bytes(arr: Uint8Array | number[]): void {
    for (const b of arr) this.buf.push(b & 0xff)
  }

  public ascii40(text: string): void {
    const units: number[] = []
    for (const ch of text.slice(0, 19)) units.push(ch.charCodeAt(0))
    while (units.length < 20) units.push(0)
    for (const u of units) this.u16(u)
  }

  public get length(): number {
    return this.buf.length
  }

  public toUint8Array(): Uint8Array {
    return Uint8Array.from(this.buf)
  }
}

export interface YrpSingleWriteOptions {
  names: [string, string]
  seed: number[]
  startLp: number
  startHand: number
  drawCount: number
  opt: number
  scriptFile: string
  responses: Uint8Array[]
}

export interface YrpTagDeck {
  main: number[]
  extra: number[]
}

export interface YrpTagWriteOptions {
  names: string[]
  seed: number[]
  startLp: number
  startHand: number
  drawCount: number
  opt: number
  decks: YrpTagDeck[]
  responses: Uint8Array[]
}

export function buildDuelFlag(masterRule: number, firstTurnAttack: boolean, tag: boolean): number {
  let flag = DUEL_PSEUDO_SHUFFLE | DUEL_REVEAL_DECK_SEQ
  if (firstTurnAttack) flag |= DUEL_ATTACK_FIRST_TURN
  if (tag) flag |= DUEL_TAG_MODE
  return flag | ((masterRule & 0xff) << 16)
}

export function buildYrpSingleFile(options: YrpSingleWriteOptions): Uint8Array {
  if (options.opt & DUEL_TAG_MODE) {
    throw new Error('单人回放不能带 tag 对局参数。')
  }

  const payload = new ByteWriter()
  payload.ascii40(options.names[0])
  payload.ascii40(options.names[1])
  payload.i32(options.startLp)
  payload.i32(options.startHand)
  payload.i32(options.drawCount)
  payload.i32(options.opt)

  const scriptBytes = new TextEncoder().encode(options.scriptFile)
  payload.u16(scriptBytes.length)
  payload.bytes(scriptBytes)

  for (const res of options.responses) {
    const len = Math.min(res.length, 255)
    if (len === 0) continue
    payload.u8(len)
    payload.bytes(res.subarray(0, len))
  }

  if (payload.length > YRP_MAX_PAYLOAD) {
    throw new Error(
      `回放数据 ${payload.length} 字节超出 ygopro 上限 ${YRP_MAX_PAYLOAD}，请缩短编排`
    )
  }

  return buildYrpBuffer(
    YRP_FLAG_UNIFORM | YRP_FLAG_SINGLE_MODE,
    options.seed,
    payload.toUint8Array()
  )
}

export function buildYrpTagFile(options: YrpTagWriteOptions): Uint8Array {
  if (options.names.length !== 4) {
    throw new Error('2v2 回放需要写入 4 个玩家名。')
  }
  if (options.decks.length !== 4) {
    throw new Error('2v2 回放需要写入 4 副卡组。')
  }
  if (!(options.opt & DUEL_TAG_MODE)) {
    throw new Error('2v2 回放的对局参数缺少 tag 标记。')
  }

  const payload = new ByteWriter()
  for (const name of options.names) payload.ascii40(name)
  payload.i32(options.startLp)
  payload.i32(options.startHand)
  payload.i32(options.drawCount)
  payload.i32(options.opt)
  for (const deck of options.decks) {
    payload.i32(deck.main.length)
    for (const code of deck.main) payload.i32(code)
    payload.i32(deck.extra.length)
    for (const code of deck.extra) payload.i32(code)
  }
  for (const res of options.responses) {
    const len = Math.min(res.length, 255)
    if (len === 0) continue
    payload.u8(len)
    payload.bytes(res.subarray(0, len))
  }

  if (payload.length > YRP_MAX_PAYLOAD) {
    throw new Error(
      `回放数据 ${payload.length} 字节超出 ygopro 上限 ${YRP_MAX_PAYLOAD}，请缩短编排`
    )
  }

  return buildYrpBuffer(YRP_FLAG_UNIFORM | YRP_FLAG_TAG, options.seed, payload.toUint8Array())
}

function buildYrpBuffer(flag: number, seed: number[], payload: Uint8Array): Uint8Array {
  const seedSequence = [...seed]
  while (seedSequence.length < 8) seedSequence.push(0)

  const out = new ByteWriter()
  out.i32(YRP2_ID)
  out.i32(YRP_VERSION)
  out.i32(flag)
  out.i32(seedSequence[0] ?? 0)
  out.i32(payload.length)
  out.i32(Math.floor(Date.now() / 1000))
  for (let i = 0; i < 8; i++) out.u8(0)
  for (const value of seedSequence.slice(0, 8)) out.i32(value)
  out.i32(1)
  out.i32(0)
  out.i32(0)
  out.i32(0)
  out.bytes(payload)
  return out.toUint8Array()
}
