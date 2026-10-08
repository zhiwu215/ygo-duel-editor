import { existsSync, readFileSync } from 'fs'
import path from 'path'
import {
  OcgCoreSync,
  OcgDuelMode,
  OcgLocation,
  OcgPosition,
  OcgCardData,
  OcgDuelHandle
} from 'ocgcore-wasm'
import ocgcoreWasmModule from 'ocgcore-wasm'
import {
  CdbCard,
  CustomCard,
  DuelPuzzleState,
  CardLocation,
  CardPosition,
  FieldCard,
  customCardToCdbCard,
  isCustomCardId
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { customCardService } from './customCardService'
import { ZipFileReader } from '../utils/zipFile'

type OcgcoreWasmExports = Omit<typeof ocgcoreWasmModule, 'default'> & {
  default: typeof ocgcoreWasmModule
}

function resolveCreateCore(): typeof ocgcoreWasmModule {
  const m = ocgcoreWasmModule as unknown as OcgcoreWasmExports
  if (typeof m === 'function') return m
  if (typeof m?.default === 'function') return m.default
  throw new Error('ocgcore-wasm 加载失败：createCore 找不到（ESM 互操作形态异常）')
}

const CORE_SCRIPT_NAMES = ['constant.lua', 'utility.lua'] as const
const EMPTY_SCRIPT = '-- empty fallback script\nfunction initial_effect(c)\nend\n'
const DEFAULT_SEED: [bigint, bigint, bigint, bigint] = [100n, 200n, 300n, 400n]

export interface CreateDuelOptions {
  drawCountPerTurn?: number
  startingDrawCount?: number
  skipDrawStandby?: boolean
  startDuel?: boolean
}

export interface CreateDuelResult {
  handle: OcgDuelHandle | null
  core: OcgCoreSync
  cardCount: number
}

export class OcgcoreService {
  private core: OcgCoreSync | null = null

  private isInitializing: boolean = false

  private scriptCache: Map<string, string | null> = new Map()

  private zipReaders: Map<string, ZipFileReader | null> = new Map()

  public missingCardScriptNames: Set<string> = new Set()

  public async getCore(): Promise<OcgCoreSync> {
    if (this.core) return this.core
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (this.core) return this.core
    }

    this.isInitializing = true
    try {
      this.core = await resolveCreateCore()({ sync: true })
      const [maj, min] = this.core.getVersion()
      console.log(`[OcgcoreService] ocgcore-wasm core initialized (v${maj}.${min})`)
      return this.core
    } finally {
      this.isInitializing = false
    }
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
    const cacheKey = `${root}\u0000${name}`
    if (this.scriptCache.has(cacheKey)) return this.scriptCache.get(cacheKey) ?? null
    let content: string | null = null
    const fileName = name.endsWith('.lua') ? name : `${name}.lua`
    const scriptDir = path.join(root, 'script')
    const fullPath = path.join(scriptDir, fileName)
    if (existsSync(fullPath)) {
      try {
        content = readFileSync(fullPath, 'utf-8')
      } catch (err) {
        console.error(`[OcgcoreService] Failed to read script ${fullPath}:`, err)
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
      if (reader) {
        console.log(
          `[OcgcoreService] script.zip detected: ${zipPath} (${reader.entryCount} entries)`
        )
      }
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
    const content = this.readScriptRaw(name)
    if (content !== null) return content
    if (/(^|\/)c\d+\.lua$/.test(name)) {
      this.missingCardScriptNames.add(name)
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
    console.warn(`[OcgcoreService] Card data missing in database for code: ${code}`)
    return null
  }

  private resetRunCounters(): void {
    this.missingCardScriptNames = new Set()
    if (this.scriptCache.size > 4000) {
      this.scriptCache.clear()
    }
  }

  private mapLocation(loc: number): OcgLocation {
    switch (loc) {
      case CardLocation.DECK:
        return OcgLocation.DECK
      case CardLocation.HAND:
        return OcgLocation.HAND
      case CardLocation.MZONE:
        return OcgLocation.MZONE
      case CardLocation.SZONE:
      case CardLocation.FZONE:
        return OcgLocation.SZONE
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

  private mapPosition(pos: number): OcgPosition {
    switch (pos) {
      case CardPosition.FACEUP_ATTACK:
        return OcgPosition.FACEUP_ATTACK
      case CardPosition.FACEDOWN_ATTACK:
        return OcgPosition.FACEDOWN_ATTACK
      case CardPosition.FACEUP_DEFENSE:
        return OcgPosition.FACEUP_DEFENSE
      case CardPosition.FACEDOWN_DEFENSE:
        return OcgPosition.FACEDOWN_DEFENSE
      default:
        return OcgPosition.FACEUP_ATTACK
    }
  }

  public async createDuelFromState(
    state: DuelPuzzleState,
    options: CreateDuelOptions = {}
  ): Promise<CreateDuelResult> {
    const core = await this.getCore()
    try {
      this.resetRunCounters()
    } catch (err) {
      console.warn('[OcgcoreService] Failed to reset run counters:', err)
    }

    let ruleFlag = OcgDuelMode.MODE_MR5
    if (state.masterRule === 2) ruleFlag = OcgDuelMode.MODE_MR2
    else if (state.masterRule === 3) ruleFlag = OcgDuelMode.MODE_MR3
    else if (state.masterRule === 4) ruleFlag = OcgDuelMode.MODE_MR4

    const flags =
      ruleFlag |
      OcgDuelMode.PSEUDO_SHUFFLE |
      (state.firstTurnAttack ? OcgDuelMode.ATTACK_FIRST_TURN : 0n)

    const handle = await core.createDuel({
      flags,
      seed: DEFAULT_SEED,
      team1: {
        startingLP: state.players[0]?.lp || 8000,
        startingDrawCount: options.startingDrawCount ?? 0,
        drawCountPerTurn: options.drawCountPerTurn ?? 1
      },
      team2: {
        startingLP: state.players[1]?.lp || 8000,
        startingDrawCount: options.startingDrawCount ?? 0,
        drawCountPerTurn: options.drawCountPerTurn ?? 1
      },
      cardReader: (code) => this.readCardData(code),
      scriptReader: (name) => this.readScript(name),
      errorHandler: (type, text) => {
        console.warn(`[OcgcoreService ${type}] ${text}`)
      }
    })

    if (!handle) {
      return { handle: null, core, cardCount: 0 }
    }

    for (const coreScript of CORE_SCRIPT_NAMES) {
      const content = this.readScriptRaw(coreScript)
      if (content !== null) {
        core.loadScript(handle, coreScript, content)
      }
    }

    let cardCount = 0
    const byLocation = new Map<number, FieldCard[]>()
    for (const card of state.cards) {
      if (this.readCardData(card.code) === null) continue
      const list = byLocation.get(card.location) ?? []
      list.push(card)
      byLocation.set(card.location, list)
    }

    const addCard = async (
      card: FieldCard,
      ocgLoc: OcgLocation,
      sequence: number
    ): Promise<void> => {
      const ocgPos = this.mapPosition(card.position)
      await core.duelNewCard(handle, {
        team: card.controller,
        duelist: 0,
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
      await addCard(deckCards[i], OcgLocation.DECK, 0)
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
        await addCard(card, ocgLoc, sequence)
      }
    }

    if (options.skipDrawStandby) this.loadSkipPhaseSnippet(handle)

    if (options.startDuel !== false) {
      core.startDuel(handle)
      this.loadOverlaySnippet(handle, state.cards)
    }

    return { handle, core, cardCount }
  }

  private loadSkipPhaseSnippet(handle: OcgDuelHandle): void {
    const core = this.core
    if (!core) return
    const snippet = [
      'local e1=Effect.GlobalEffect()',
      'e1:SetType(EFFECT_TYPE_FIELD)',
      'e1:SetProperty(EFFECT_FLAG_PLAYER_TARGET)',
      'e1:SetCode(EFFECT_SKIP_DP)',
      'e1:SetTargetRange(1,0)',
      'Duel.RegisterEffect(e1,0)',
      'local e2=Effect.GlobalEffect()',
      'e2:SetType(EFFECT_TYPE_FIELD)',
      'e2:SetProperty(EFFECT_FLAG_PLAYER_TARGET)',
      'e2:SetCode(EFFECT_SKIP_SP)',
      'e2:SetTargetRange(1,0)',
      'Duel.RegisterEffect(e2,0)'
    ].join('\n')
    core.loadScript(handle, 'ygo_duel_editor_skip_phases.lua', snippet)
  }

  public seedCounters(handle: OcgDuelHandle, cards: FieldCard[]): void {
    const core = this.core
    if (!core) return
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
      'local e=Effect.GlobalEffect()',
      'e:SetType(EFFECT_TYPE_FIELD|EFFECT_TYPE_CONTINUOUS)',
      'e:SetCode(EVENT_STARTUP)',
      'e:SetOperation(function()',
      '  for _,info in ipairs(probe_counters) do',
      '    local h=Duel.GetFieldCard(info.con, info.loc, info.seq)',
      '    if h then',
      '      for t,n in pairs(info.counters) do',
      '        h:AddCounter(t, n)',
      '      end',
      '    end',
      '  end',
      'end)',
      'Duel.RegisterEffect(e,0)'
    ].join('\n')
    core.loadScript(handle, 'ygo_duel_editor_counter_seed.lua', snippet)
  }

  private loadOverlaySnippet(handle: OcgDuelHandle, cards: FieldCard[]): void {
    const core = this.core
    if (!core) return
    const hosts = new Map<string, { con: number; loc: OcgLocation; seq: number; codes: number[] }>()
    for (const card of cards) {
      const materials = card.overlayMaterials ?? []
      if (materials.length === 0) continue
      if (card.location !== CardLocation.MZONE) continue
      const key = `${card.controller}:${card.sequence}`
      const host = hosts.get(key) ?? {
        con: card.controller,
        loc: OcgLocation.MZONE,
        seq: card.sequence,
        codes: [] as number[]
      }
      host.codes.push(...materials)
      hosts.set(key, host)
    }
    if (hosts.size === 0) return
    const hostLines = [...hosts.values()].map(
      (h) => `{ con=${h.con}, loc=${h.loc}, seq=${h.seq}, codes={${h.codes.join(',')}} }`
    )
    const snippet = [
      'local probe_mats = {',
      ...hostLines.map((line) => `  ${line},`),
      '}',
      'local e=Effect.GlobalEffect()',
      'e:SetType(EFFECT_TYPE_FIELD|EFFECT_TYPE_CONTINUOUS)',
      'e:SetCode(EVENT_STARTUP)',
      'e:SetOperation(function()',
      '  for _,info in ipairs(probe_mats) do',
      '    local h=Duel.GetFieldCard(info.con, info.loc, info.seq)',
      '    if h then',
      '      local g=Group.CreateGroup()',
      '      for _,c in ipairs(info.codes) do g:AddCard(Duel.CreateToken(info.con, c)) end',
      '      Duel.Overlay(h, g)',
      '    end',
      '  end',
      'end)',
      'Duel.RegisterEffect(e,0)'
    ].join('\n')
    core.loadScript(handle, 'ygo_duel_editor_overlay_setup.lua', snippet)
  }
}

export const ocgcoreService = new OcgcoreService()
