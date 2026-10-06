import {
  OcgCoreSync,
  OcgDuelHandle,
  OcgAttribute,
  OcgLocation,
  OcgMessageType,
  OcgPhase,
  OcgProcessResult,
  OcgQueryFlags,
  OcgResponseType,
  OcgRace,
  SelectBattleCMDAction,
  SelectIdleCMDAction
} from 'ocgcore-wasm'
import {
  CardLocation,
  CardPosition,
  CdbCard,
  DuelPuzzleState,
  DuelActionType,
  DuelPhase,
  EngineDuelStep,
  FieldCard,
  LightweightCardSnapshot,
  AgentDeckArrangeProposal
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { ocgcoreService } from './ocgcoreService'
import { encodeOcgResponse } from './yrpWriter'

export type DeckArrangeErrorCode =
  'deck_empty' | 'duelist_missing' | 'duelist_ambiguous' | 'too_many' | 'unknown_card'

export class DeckArrangeError extends Error {
  public readonly code: DeckArrangeErrorCode
  public readonly offenders: string[]

  constructor(code: DeckArrangeErrorCode, message: string, offenders: string[] = []) {
    super(message)
    this.name = 'DeckArrangeError'
    this.code = code
    this.offenders = offenders
  }
}

export interface EngineOptionView {
  id: number
  label: string
}

export interface EngineFinishInfo {
  winner: 0 | 1 | null
  reason: string
}

export interface EngineRoundResult {
  narration: string[]
  options: EngineOptionView[]
  finished: EngineFinishInfo | null
}

interface ProcessRound {
  narrations: string[]
  options: InternalOption[]
  waiting: boolean
}

type EngineResponse = Parameters<OcgCoreSync['duelSetResponse']>[1]
type EngineMessage = ReturnType<OcgCoreSync['duelGetMessage']>[number]

interface InternalOption {
  id: number
  label: string
  response: EngineResponse
  actionType: DuelActionType
  cardCode?: number
  cardName?: string
  topLevel: boolean
  skipStep?: boolean
}

interface PendingStep {
  turn: number
  phase: DuelPhase
  turnPlayer: 0 | 1
  actionPlayer: 0 | 1
  actionType: DuelActionType
  cardCode?: number
  cardName?: string
  narrations: string[]
  speeches: string[]
  startLp: [number, number]
}

interface EngineSession {
  handle: OcgDuelHandle
  core: OcgCoreSync
  masterRule: number
  duelists: { team: 0 | 1; name: string }[]
  baseIds: { key: string; instanceId: string; duelistId?: string }[]
  initialBoard: LightweightCardSnapshot[]
  currentTurn: number
  currentTurnPlayer: 0 | 1
  currentPhase: DuelPhase
  lp: [number, number]
  activePlayer: 0 | 1
  finished: EngineFinishInfo | null
  pending: PendingStep | null
  steps: EngineDuelStep[]
  lastOptions: InternalOption[]
  nameCache: Map<number, string>
  engineCardCounter: number
  recordedResponses: Uint8Array[]
  recording: boolean
  initialLp: number
}

const MAX_PROCESS_LOOP = 400
const MAX_CHILD_LOOP = 60

const LOCATION_NAMES: Record<number, string> = {
  [CardLocation.MZONE]: '怪兽区',
  [CardLocation.SZONE]: '魔陷区',
  [CardLocation.HAND]: '手牌',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.REMOVED]: '除外',
  [CardLocation.DECK]: '卡组',
  [CardLocation.EXTRA]: '额外'
}

const WIN_REASONS: Record<number, string> = {
  0: 'LP 归零',
  1: 'LP 归零',
  2: '时限到',
  3: '回合耗尽',
  4: '特殊胜利'
}

function isTopLevelType(type: number): boolean {
  return (
    type === OcgMessageType.SELECT_IDLECMD ||
    type === OcgMessageType.SELECT_BATTLECMD ||
    type === OcgMessageType.SELECT_CHAIN ||
    type === OcgMessageType.SELECT_EFFECTYN ||
    type === OcgMessageType.SELECT_YESNO ||
    type === OcgMessageType.SELECT_OPTION
  )
}

function phaseToDuelPhase(raw: number): DuelPhase {
  if (raw === OcgPhase.STANDBY) return 'SP'
  if (raw === OcgPhase.MAIN1) return 'M1'
  if (raw === OcgPhase.MAIN2) return 'M2'
  if (raw === OcgPhase.END) return 'EP'
  if (raw >= OcgPhase.BATTLE_START && raw <= OcgPhase.BATTLE) return 'BP'
  return 'DP'
}

function positionName(raw: number): string {
  if (raw === CardPosition.FACEUP_ATTACK) return '表侧攻击'
  if (raw === CardPosition.FACEDOWN_ATTACK) return '里侧攻击'
  if (raw === CardPosition.FACEUP_DEFENSE) return '表侧守备'
  if (raw === CardPosition.FACEDOWN_DEFENSE) return '里侧守备'
  return '盖放'
}

export class DuelEngineService {
  private session: EngineSession | null = null

  public async start(state: DuelPuzzleState): Promise<EngineRoundResult> {
    this.session = null
    const created = await ocgcoreService.createDuelFromState(state)
    if (!created.handle) {
      throw new Error('ocgcore 引擎建局失败（请确认规则引擎已安装、卡牌数据可读）')
    }
    this.session = {
      handle: created.handle,
      core: created.core,
      masterRule: state.masterRule,
      duelists: (state.duelists || []).map((d) => ({ team: d.team, name: d.name })),
      baseIds: state.cards.map((c) => ({
        key: `${c.controller}:${c.code}`,
        instanceId: c.instanceId,
        duelistId: c.duelistId
      })),
      initialBoard: this.snapshotStatic(state.cards),
      currentTurn: 0,
      currentTurnPlayer: (state.turnPlayer ?? 0) as 0 | 1,
      currentPhase: 'DP',
      lp: [state.players[0]?.lp || 8000, state.players[1]?.lp || 8000],
      activePlayer: (state.turnPlayer ?? 0) as 0 | 1,
      finished: null,
      pending: null,
      steps: [],
      lastOptions: [],
      nameCache: new Map(),
      engineCardCounter: 0,
      recordedResponses: [],
      recording: false,
      initialLp: state.players[0]?.lp || 8000
    }
    const round = await this.ensureWaiting()
    return {
      narration: [...round.narrations, `对局开始，${this.describeTurn()}`],
      options: round.options.map((o) => ({ id: o.id, label: o.label })),
      finished: null
    }
  }

  public prepareArrangement(
    state: DuelPuzzleState,
    proposal: AgentDeckArrangeProposal
  ): { state: DuelPuzzleState; narration: string } {
    const side = (proposal.side === 1 ? 1 : 0) as 0 | 1
    const sideName = this.sideNameOf(state, side)
    let scope = state.cards.filter((c) => c.controller === side && c.location === CardLocation.DECK)

    const teamDuelists = (state.duelists || []).filter((d) => d.team === side)
    if (proposal.duelistName) {
      const duelist = teamDuelists.find((d) => d.name === proposal.duelistName)
      if (!duelist) {
        throw new DeckArrangeError(
          'duelist_missing',
          `阵营「${sideName}」中没有决斗者「${proposal.duelistName}」`,
          teamDuelists.map((d) => d.name)
        )
      }
      const scoped = scope.filter((c) => c.duelistId === duelist.id)
      if (scoped.length > 0) {
        scope = scoped
      }
    } else if (teamDuelists.length > 1) {
      throw new DeckArrangeError(
        'duelist_ambiguous',
        `阵营「${sideName}」有多名决斗者，重排卡组必须指定 duelistName`,
        teamDuelists.map((d) => d.name)
      )
    }

    if (scope.length === 0) {
      throw new DeckArrangeError(
        'deck_empty',
        `${sideName}的卡组区是空的（请先在决斗档案里装填卡组）`
      )
    }

    const current = new Map<number, number>()
    scope.forEach((c) => current.set(c.code, (current.get(c.code) ?? 0) + 1))
    const proposed = new Map<number, number>()
    for (const code of proposal.codes) {
      proposed.set(code, (proposed.get(code) ?? 0) + 1)
    }
    if (proposal.codes.length > scope.length) {
      throw new DeckArrangeError(
        'too_many',
        `codes 列表有 ${proposal.codes.length} 项，但「${sideName}」牌堆只有 ${scope.length} 张，超出牌堆数量`
      )
    }
    const extra: string[] = []
    proposed.forEach((n, code) => {
      const p = current.get(code) ?? 0
      if (n > p) extra.push(`${code} ×${n - p}`)
    })
    if (extra.length > 0) {
      throw new DeckArrangeError(
        'unknown_card',
        `牌序提案里这些卡不在「${sideName}」当前卡组中：${extra.join('、')}。codes 里的每张卡都必须是牌堆里真实存在的（不能加牌，只能调整现有卡的顺序）`,
        extra
      )
    }

    const remaining = [...scope]
    const reassign = new Map<string, number>()
    let seq = 0
    for (const code of proposal.codes) {
      const idx = remaining.findIndex((c) => c.code === code)
      if (idx === -1) {
        throw new DeckArrangeError(
          'unknown_card',
          `卡密 ${code} 在「${sideName}」牌堆中定位失败，请重新提交`,
          [String(code)]
        )
      }
      const card = remaining[idx]
      remaining.splice(idx, 1)
      reassign.set(card.instanceId, seq)
      seq += 1
    }
    for (const card of remaining) {
      reassign.set(card.instanceId, seq)
      seq += 1
    }
    const newCards = state.cards.map((c) =>
      reassign.has(c.instanceId) ? { ...c, sequence: reassign.get(c.instanceId)! } : c
    )
    const preview = proposal.codes
      .slice(0, 5)
      .map((c) => this.nameOf(c))
      .join('、')
    const arrangedCount = proposal.codes.length
    return {
      state: { ...state, cards: newCards },
      narration: `「${sideName}」牌堆重排完成：前 ${arrangedCount} 张已按你的剧本排列（顶部依次：${preview}${
        arrangedCount > 5 ? ` 等 ${arrangedCount} 张` : ''
      }），其余 ${scope.length - arrangedCount} 张按原顺序跟在后面`
    }
  }

  public describeDeck(state: DuelPuzzleState, side: 0 | 1, duelistName?: string): string {
    return this.deckList(state, side, duelistName).text
  }

  public deckList(
    state: DuelPuzzleState,
    side: 0 | 1,
    duelistName?: string,
    limit?: number
  ): { text: string; count: number } {
    let scope = state.cards.filter((c) => c.controller === side && c.location === CardLocation.DECK)
    if (duelistName) {
      const duelist = (state.duelists || []).find((d) => d.name === duelistName && d.team === side)
      if (duelist) {
        const scoped = scope.filter((c) => c.duelistId === duelist.id)
        if (scoped.length > 0) scope = scoped
      }
    }
    const ordered = [...scope].sort((a, b) => a.sequence - b.sequence)
    if (ordered.length === 0) {
      return { text: '该方牌堆是空的（卡组尚未装填）', count: 0 }
    }
    const capped =
      limit !== undefined && limit > 0 && limit < ordered.length ? ordered.slice(0, limit) : ordered
    const lines = capped.map(
      (c, i) => `${i}. ${c.card?.name || `卡密${c.code}`}（卡密: ${c.code}）`
    )
    const tail =
      capped.length < ordered.length
        ? `\n（只列了前 ${capped.length} 张，共 ${ordered.length} 张；传更大的 limit 可看完整清单）`
        : ''
    const text = `「${this.sideNameOf(state, side)}」牌堆共 ${ordered.length} 张（第 0 行最接近下一张抽到的牌）：\n${lines.join('\n')}${tail}`
    return { text, count: ordered.length }
  }

  public collectInitialBoard(): LightweightCardSnapshot[] {
    return (this.session?.initialBoard ?? []).map((c) => ({ ...c }))
  }

  public collectCurrentBoard(): LightweightCardSnapshot[] {
    if (!this.session) return []
    return this.snapshotBoard()
  }

  private recordResponse(response: EngineResponse): void {
    const session = this.session
    if (!session?.recording) return
    session.recordedResponses.push(encodeOcgResponse(response))
  }

  public startRecording(): void {
    if (this.session) {
      this.session.recording = true
      this.session.recordedResponses = []
    }
  }

  public collectReplayData(): {
    names: [string, string]
    startLp: number
    decks: [{ main: number[]; extra: number[] }, { main: number[]; extra: number[] }]
    responses: Uint8Array[]
    masterRule: number
  } | null {
    const session = this.session
    if (!session) return null
    const decks = [0, 1].map((p) => ({
      main: session.initialBoard
        .filter((c) => c.controller === p && c.location === CardLocation.DECK)
        .sort((a, b) => a.sequence - b.sequence)
        .map((c) => c.code),
      extra: session.initialBoard
        .filter((c) => c.controller === p && c.location === CardLocation.EXTRA)
        .sort((a, b) => a.sequence - b.sequence)
        .map((c) => c.code)
    })) as [{ main: number[]; extra: number[] }, { main: number[]; extra: number[] }]

    return {
      names: [
        session.duelists.find((d) => d.team === 0)?.name || 'Player 0',
        session.duelists.find((d) => d.team === 1)?.name || 'Player 1'
      ],
      startLp: session.initialLp,
      decks,
      responses: [...session.recordedResponses],
      masterRule: session.masterRule
    }
  }

  public reset(): void {
    this.session = null
  }

  public isRunning(): boolean {
    return this.session !== null
  }

  public collectSteps(): EngineDuelStep[] {
    return (this.session?.steps ?? []).map((s) => ({ ...s }))
  }

  public collectFinish(): EngineFinishInfo | null {
    return this.session?.finished ?? null
  }

  public async choose(picks: number[], speech: string | undefined): Promise<EngineRoundResult> {
    const session = this.requireSession()
    const option = session.lastOptions.find((o) => picks.includes(o.id))
    if (!option) {
      throw new Error(`编号 ${picks.join(',')} 不在当前可选项中，请从上一次返回的操作列表里选`)
    }

    const narration: string[] = []
    if (option.topLevel && !option.skipStep) {
      session.pending = {
        turn: session.currentTurn,
        phase: session.currentPhase,
        turnPlayer: session.currentTurnPlayer,
        actionPlayer: session.activePlayer,
        actionType: option.actionType,
        cardCode: option.cardCode,
        cardName: option.cardName,
        narrations: [],
        speeches: speech?.trim() ? [speech.trim()] : [],
        startLp: [...session.lp]
      }
    } else if (session.pending && speech?.trim()) {
      session.pending.speeches.push(speech.trim())
    }

    session.core.duelSetResponse(session.handle, option.response)
    this.recordResponse(option.response)
    let round = await this.ensureWaiting()
    session.pending?.narrations.push(...round.narrations)
    narration.push(...round.narrations)

    let child = 0
    while (round.waiting && !this.isTopWaiting() && child < MAX_CHILD_LOOP) {
      const fallback = this.buildFallbackResponse()
      if (!fallback) break
      session.core.duelSetResponse(session.handle, fallback)
      this.recordResponse(fallback)
      round = await this.ensureWaiting()
      session.pending?.narrations.push(...round.narrations)
      narration.push(...round.narrations)
      child++
    }

    this.sealPendingStep()

    return {
      narration,
      options: round.options.map((o) => ({ id: o.id, label: o.label })),
      finished: session.finished
    }
  }

  private requireSession(): EngineSession {
    if (!this.session) throw new Error('引擎对局尚未开始，请先调用 duel_engine_start')
    return this.session
  }

  private isTopWaiting(): boolean {
    const options = this.buildCurrentOptions()
    return options.length === 0 || options[0].topLevel
  }

  private async ensureWaiting(): Promise<ProcessRound> {
    const session = this.requireSession()
    const narrations: string[] = []
    let result = await session.core.duelProcess(session.handle)
    let guard = 0
    while (guard < MAX_PROCESS_LOOP) {
      narrations.push(...this.consumeMessages())
      if (result === OcgProcessResult.END) break
      const options = this.buildCurrentOptions()
      if (options.length > 0) break
      if (result !== OcgProcessResult.CONTINUE && result !== OcgProcessResult.WAITING) break
      result = await session.core.duelProcess(session.handle)
      guard++
    }
    if (guard >= MAX_PROCESS_LOOP) {
      narrations.push('引擎连续结算超过安全上限，推进暂停。')
    }
    narrations.push(...this.consumeMessages())

    const options = result === OcgProcessResult.END ? [] : this.buildCurrentOptions()
    session.lastOptions = options
    if (result === OcgProcessResult.END) {
      if (!session.finished) {
        session.finished = { winner: null, reason: '对局结束' }
      }
      return { narrations, options: [], waiting: false }
    }
    return { narrations, options, waiting: options.length > 0 }
  }

  private consumeMessages(): string[] {
    const session = this.requireSession()
    const messages = session.core.duelGetMessage(session.handle)
    if (messages.length === 0) return []
    const out: string[] = []
    for (const msg of messages) {
      const kind = Number(msg.type)
      if (kind === OcgMessageType.RETRY) {
        out.push('引擎判定刚才的指令非法，已回退，请换一种选择')
        continue
      }
      if (kind === OcgMessageType.NEW_TURN) {
        const player = (Number((msg as { player: number }).player) === 1 ? 1 : 0) as 0 | 1
        session.currentTurn += 1
        session.currentTurnPlayer = player
        session.currentPhase = 'DP'
        session.pending = null
        out.push(`第 ${session.currentTurn} 回合（${this.sideName(player)}回合）`)
      } else if (kind === OcgMessageType.NEW_PHASE) {
        session.currentPhase = phaseToDuelPhase(Number((msg as { phase: number }).phase))
      } else if (kind === OcgMessageType.DRAW) {
        const m = msg as unknown as { player: number; drawn: { code: number }[] }
        const drawn = m.drawn ?? []
        if (drawn.length > 0) {
          out.push(
            `${this.sideName(m.player)}抽卡 ×${drawn.length}（${drawn
              .map((d) => this.cardName(Number(d.code)))
              .join('、')}）`
          )
        }
      } else if (kind === OcgMessageType.DAMAGE || kind === OcgMessageType.RECOVER) {
        const m = msg as unknown as { player: number; amount: number }
        const side = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
        const oldLp = session.lp[side]
        const delta = kind === OcgMessageType.DAMAGE ? -Math.abs(m.amount) : Math.abs(m.amount)
        const newLp = Math.max(0, oldLp + delta)
        session.lp[side] = newLp
        if (newLp !== oldLp) {
          out.push(
            `${this.sideName(side)}LP ${oldLp} → ${newLp}（${delta > 0 ? '+' : '-'}${Math.abs(delta)}）`
          )
        }
      } else if (kind === OcgMessageType.LPUPDATE) {
        const m = msg as unknown as { player: number; lp: number }
        session.lp[(Number(m.player) === 1 ? 1 : 0) as 0 | 1] = Number(m.lp)
      } else if (kind === OcgMessageType.SUMMONING) {
        out.push(
          `${this.sideName(session.activePlayer)}召唤【${this.cardName(Number((msg as unknown as { code: number }).code))}】`
        )
      } else if (kind === OcgMessageType.SPSUMMONING) {
        out.push(
          `${this.sideName(session.activePlayer)}特殊召唤【${this.cardName(Number((msg as unknown as { code: number }).code))}】`
        )
      } else if (kind === OcgMessageType.FLIPSUMMONING) {
        out.push(
          `${this.sideName(session.activePlayer)}反转召唤【${this.cardName(Number((msg as unknown as { code: number }).code))}】`
        )
      } else if (kind === OcgMessageType.SET) {
        const code = Number((msg as unknown as { code: number }).code)
        const name = this.cardName(code)
        out.push(
          name === '未知卡'
            ? `${this.sideName(session.activePlayer)}盖放了一张卡`
            : `${this.sideName(session.activePlayer)}盖放【${name}】`
        )
      } else if (kind === OcgMessageType.MOVE) {
        const m = msg as unknown as {
          card: number
          from: { location: number }
          to: { location: number }
        }
        const fromName = LOCATION_NAMES[this.mapLocationBack(Number(m.from.location))] ?? '未知区域'
        const toName = LOCATION_NAMES[this.mapLocationBack(Number(m.to.location))] ?? '未知区域'
        if (fromName !== toName) {
          out.push(`【${this.cardName(Number(m.card))}】${fromName} → ${toName}`)
        }
      } else if (kind === OcgMessageType.POS_CHANGE) {
        const m = msg as unknown as { code: number; position: number }
        out.push(`【${this.cardName(Number(m.code))}】变为${positionName(Number(m.position))}`)
      } else if (kind === OcgMessageType.ATTACK) {
        const m = msg as unknown as { card?: unknown; target?: unknown }
        const attacker = this.resolveLocName(m.card) ?? '未知怪兽'
        const target = this.resolveLocName(m.target)
        out.push(
          target
            ? `${this.sideName(session.activePlayer)}【${attacker}】攻击【${target}】`
            : `${this.sideName(session.activePlayer)}【${attacker}】直接攻击玩家`
        )
      } else if (kind === OcgMessageType.BATTLE) {
        const m = msg as unknown as {
          card?: { destroyed?: boolean }
          target?: { attack?: number; defense?: number; position?: number; destroyed?: boolean }
        }
        const attacker = this.resolveLocName(m.card) ?? '未知怪兽'
        const target = this.resolveLocName(m.target)
        if (!target) {
          out.push(`战斗结算：【${attacker}】直接攻击`)
        } else {
          const pos = Number(m.target?.position ?? 0)
          const isAttackPos =
            pos === CardPosition.FACEUP_ATTACK || pos === CardPosition.FACEDOWN_ATTACK
          const stat = isAttackPos ? Number(m.target?.attack ?? 0) : Number(m.target?.defense ?? 0)
          const verdict =
            m.target?.destroyed === true ? `【${target}】被战斗破坏` : `【${target}】未被战斗破坏`
          const backfire = m.card?.destroyed === true ? `；【${attacker}】反被战斗破坏` : ''
          out.push(
            `战斗结算：【${attacker}】vs【${target}】（${isAttackPos ? '攻' : '防'}${stat}）→ ${verdict}${backfire}`
          )
        }
      } else if (kind === OcgMessageType.CHAINING) {
        out.push(`【${this.cardName(Number((msg as unknown as { card: number }).card))}】发动效果`)
      } else if (kind === OcgMessageType.WIN) {
        const m = msg as unknown as { player: number; reason: number }
        const winner = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
        session.finished = {
          winner,
          reason: WIN_REASONS[Number(m.reason)] ?? `判定结束(${Number(m.reason)})`
        }
        out.push(`对局终了：${this.sideName(winner)}获胜（${session.finished.reason}）`)
      }
    }
    return out
  }

  private buildCurrentOptions(): InternalOption[] {
    const session = this.requireSession()
    const messages = session.core.duelGetMessage(session.handle)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const kind = Number(msg.type)
      if (kind === OcgMessageType.RETRY) continue
      if (!isTopLevelType(kind) && !this.isChildSelectType(kind)) continue
      const options = this.buildOptionsFor(msg)
      if (options.length > 0) {
        session.activePlayer = (
          Number((msg as unknown as { player: number }).player) === 1 ? 1 : 0
        ) as 0 | 1
        return options
      }
    }
    return []
  }

  private isChildSelectType(type: number): boolean {
    const childTypes = [
      OcgMessageType.SELECT_CARD,
      OcgMessageType.SELECT_TRIBUTE,
      OcgMessageType.SELECT_PLACE,
      OcgMessageType.SELECT_POSITION,
      OcgMessageType.SELECT_SUM,
      OcgMessageType.SELECT_COUNTER,
      OcgMessageType.SELECT_DISFIELD,
      OcgMessageType.SORT_CHAIN,
      OcgMessageType.SORT_CARD,
      OcgMessageType.SELECT_UNSELECT_CARD,
      OcgMessageType.ANNOUNCE_RACE,
      OcgMessageType.ANNOUNCE_ATTRIB,
      OcgMessageType.ANNOUNCE_CARD,
      OcgMessageType.ANNOUNCE_NUMBER
    ]
    return childTypes.includes(type as OcgMessageType)
  }

  private buildOptionsFor(msg: EngineMessage): InternalOption[] {
    const kind = Number(msg.type)
    if (kind === OcgMessageType.SELECT_IDLECMD) {
      return this.buildIdleOptions(
        msg as unknown as {
          summons: { code: number }[]
          special_summons: { code: number }[]
          pos_changes: { code: number }[]
          monster_sets: { code: number }[]
          spell_sets: { code: number }[]
          activates: { code: number }[]
          to_bp: boolean
          to_ep: boolean
        }
      )
    }
    if (kind === OcgMessageType.SELECT_BATTLECMD) {
      return this.buildBattleOptions(
        msg as unknown as {
          player: number
          chains: { code: number }[]
          attacks: { code: number; can_direct: boolean }[]
          to_m2: boolean
          to_ep: boolean
        }
      )
    }
    if (kind === OcgMessageType.SELECT_CHAIN) {
      const m = msg as unknown as { forced: boolean; selects: { code: number }[] }
      const options: InternalOption[] = (m.selects ?? []).map((c, i) => ({
        id: 0,
        label: `连锁发动【${this.cardName(Number(c.code))}】的效果`,
        response: { type: OcgResponseType.SELECT_CHAIN, index: i } as EngineResponse,
        actionType: 'CHAIN',
        cardCode: Number(c.code),
        cardName: this.cardName(Number(c.code)),
        topLevel: true
      }))
      if (!m.forced) {
        options.push({
          id: 0,
          label: '不连锁，让对方结算',
          response: { type: OcgResponseType.SELECT_CHAIN, index: null } as EngineResponse,
          actionType: 'DIALOGUE',
          topLevel: true
        })
      }
      return this.numberOptions(options)
    }
    if (kind === OcgMessageType.SELECT_EFFECTYN) {
      const code = Number((msg as unknown as { code: number }).code)
      return [
        {
          id: 1,
          label: `发动【${this.cardName(code)}】的效果`,
          response: { type: OcgResponseType.SELECT_EFFECTYN, yes: true } as EngineResponse,
          actionType: 'ACTIVATE',
          cardCode: code,
          cardName: this.cardName(code),
          topLevel: true
        },
        {
          id: 2,
          label: '不发动',
          response: { type: OcgResponseType.SELECT_EFFECTYN, yes: false } as EngineResponse,
          actionType: 'DIALOGUE',
          topLevel: true,
          skipStep: true
        }
      ]
    }
    if (kind === OcgMessageType.SELECT_YESNO) {
      return [
        {
          id: 1,
          label: '选择「是」',
          response: { type: OcgResponseType.SELECT_YESNO, yes: true } as EngineResponse,
          actionType: 'ACTIVATE',
          topLevel: true
        },
        {
          id: 2,
          label: '选择「否」',
          response: { type: OcgResponseType.SELECT_YESNO, yes: false } as EngineResponse,
          actionType: 'DIALOGUE',
          topLevel: true,
          skipStep: true
        }
      ]
    }
    if (kind === OcgMessageType.SELECT_OPTION) {
      const count = ((msg as unknown as { options: bigint[] }).options ?? []).length
      return this.numberOptions(
        Array.from({ length: count }, (_, i) => ({
          id: 0,
          label: `处理方式 ${i + 1}`,
          response: { type: OcgResponseType.SELECT_OPTION, index: i } as EngineResponse,
          actionType: 'ACTIVATE',
          topLevel: true
        }))
      )
    }
    if (kind === OcgMessageType.SELECT_CARD) {
      const m = msg as unknown as { selects: { code: number }[] }
      return this.numberOptions(
        (m.selects ?? []).map((c, i) => ({
          id: 0,
          label: `选择【${this.cardName(Number(c.code))}】`,
          response: { type: OcgResponseType.SELECT_CARD, indicies: [i] } as EngineResponse,
          actionType: 'ACTIVATE',
          topLevel: false
        }))
      )
    }
    if (kind === OcgMessageType.SELECT_TRIBUTE) {
      const m = msg as unknown as { selects: { code: number }[] }
      return this.numberOptions(
        (m.selects ?? []).map((c, i) => ({
          id: 0,
          label: `作为祭品解除【${this.cardName(Number(c.code))}】`,
          response: { type: OcgResponseType.SELECT_TRIBUTE, indicies: [i] } as EngineResponse,
          actionType: 'TO_GRAVE',
          topLevel: false
        }))
      )
    }
    if (kind === OcgMessageType.SELECT_PLACE) {
      const m = msg as unknown as { player: number; count: number; field_mask: number }
      return this.numberOptions(this.buildPlaceOptions(m))
    }
    if (kind === OcgMessageType.SELECT_POSITION) {
      const mask = Number((msg as unknown as { positions: number }).positions)
      const options: InternalOption[] = []
      const candidates: Array<[number, number, string]> = [
        [CardPosition.FACEUP_ATTACK, 1, '表侧攻击表示'],
        [CardPosition.FACEDOWN_DEFENSE, 8, '里侧守备表示'],
        [CardPosition.FACEUP_DEFENSE, 4, '表侧守备表示'],
        [CardPosition.FACEDOWN_ATTACK, 2, '里侧攻击表示']
      ]
      for (const [pos, bit, name] of candidates) {
        if (mask & bit) {
          options.push({
            id: 0,
            label: `以${name}放置`,
            response: { type: OcgResponseType.SELECT_POSITION, position: pos } as EngineResponse,
            actionType: 'CHANGE_POS',
            topLevel: false
          })
        }
      }
      return this.numberOptions(options)
    }
    return []
  }

  private buildPlaceOptions(m: {
    player: number
    count: number
    field_mask: number
  }): InternalOption[] {
    const player = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
    const mask = ~Number(m.field_mask) >>> 0
    const tactical = this.isPlacementTactical(mask)
    const options: InternalOption[] = []
    const push = (location: number, sequence: number, label: string): void => {
      options.push({
        id: 0,
        label,
        response: {
          type: OcgResponseType.SELECT_PLACE,
          places: [{ player, location, sequence }]
        } as EngineResponse,
        actionType: 'CHANGE_POS',
        topLevel: tactical
      })
    }
    const own = this.sideName(player)
    const foe = this.sideName((player === 0 ? 1 : 0) as 0 | 1)
    const emitMzone = (base: number, side: string): void => {
      const chunk = (mask >>> base) & 0x7f
      for (let seq = 0; seq < 7; seq++) {
        if (!(chunk & (1 << seq))) continue
        const zone = seq >= 5 ? `额外怪兽区（${seq === 5 ? '左' : '右'}）` : `怪兽区 ${seq + 1}`
        push(CardLocation.MZONE, seq, `${side}${zone}`)
      }
    }
    const emitSzone = (base: number, side: string): void => {
      const chunk = (mask >>> base) & 0x3f
      for (let seq = 0; seq < 6; seq++) {
        if (!(chunk & (1 << seq))) continue
        const zone = seq === 5 ? '场地魔法区' : `魔陷区 ${seq + 1}`
        push(CardLocation.SZONE, seq, `${side}${zone}`)
      }
    }
    const emitPzone = (base: number, side: string): void => {
      const chunk = (mask >>> base) & 0x3
      if (chunk & 0x1) push(CardLocation.PZONE, 6, `${side}灵摆区（左）`)
      if (chunk & 0x2) push(CardLocation.PZONE, 7, `${side}灵摆区（右）`)
    }
    emitMzone(0, own)
    emitSzone(8, own)
    emitPzone(14, own)
    emitMzone(16, foe)
    emitSzone(24, foe)
    emitPzone(30, foe)
    return options
  }

  private isPlacementTactical(mask: number): boolean {
    const ownMzone = (mask >>> 0) & 0x7f
    const ownSzone = (mask >>> 8) & 0x3f
    const ownPzone = (mask >>> 14) & 0x3
    const foeMzone = (mask >>> 16) & 0x7f
    const foeSzone = (mask >>> 24) & 0x3f
    const foePzone = (mask >>> 30) & 0x3
    if (ownPzone !== 0 || foePzone !== 0) return true
    if (ownMzone & 0x60 || foeMzone & 0x60) return true
    if (ownMzone !== 0 && ownSzone !== 0) return true
    if (foeMzone !== 0 && foeSzone !== 0) return true
    if (ownSzone & 0x20 || foeSzone & 0x20) return true
    return false
  }

  private buildIdleOptions(m: {
    summons: { code: number }[]
    special_summons: { code: number }[]
    pos_changes: { code: number }[]
    monster_sets: { code: number }[]
    spell_sets: { code: number }[]
    activates: { code: number }[]
    to_bp: boolean
    to_ep: boolean
  }): InternalOption[] {
    const options: InternalOption[] = []
    const group = (
      list: { code: number }[] | undefined,
      action: SelectIdleCMDAction,
      label: string,
      actionType: DuelActionType
    ): void => {
      ;(list ?? []).forEach((c, i) => {
        options.push({
          id: 0,
          label: `${label}【${this.cardName(Number(c.code))}】`,
          response: {
            type: OcgResponseType.SELECT_IDLECMD,
            action,
            index: i
          } as EngineResponse,
          actionType,
          cardCode: Number(c.code),
          cardName: this.cardName(Number(c.code)),
          topLevel: true
        })
      })
    }
    group(m.summons, SelectIdleCMDAction.SELECT_SUMMON, '通常召唤', 'NORMAL_SUMMON')
    group(
      m.special_summons,
      SelectIdleCMDAction.SELECT_SPECIAL_SUMMON,
      '特殊召唤',
      'SPECIAL_SUMMON'
    )
    group(m.pos_changes, SelectIdleCMDAction.SELECT_POS_CHANGE, '变更表示形式', 'CHANGE_POS')
    group(m.monster_sets, SelectIdleCMDAction.SELECT_MONSTER_SET, '盖放怪兽', 'SET_MONSTER')
    group(m.spell_sets, SelectIdleCMDAction.SELECT_SPELL_SET, '盖放魔陷', 'SET_SPELL_TRAP')
    group(m.activates, SelectIdleCMDAction.SELECT_ACTIVATE, '发动', 'ACTIVATE')
    if (m.to_bp) {
      options.push({
        id: 0,
        label: '进入战斗阶段',
        response: {
          type: OcgResponseType.SELECT_IDLECMD,
          action: SelectIdleCMDAction.TO_BP,
          index: null
        } as EngineResponse,
        actionType: 'PHASE_CHANGE',
        topLevel: true
      })
    }
    if (m.to_ep) {
      options.push({
        id: 0,
        label: '结束回合',
        response: {
          type: OcgResponseType.SELECT_IDLECMD,
          action: SelectIdleCMDAction.TO_EP,
          index: null
        } as EngineResponse,
        actionType: 'TURN_CHANGE',
        topLevel: true
      })
    }
    return this.numberOptions(options)
  }

  private buildBattleOptions(m: {
    player: number
    chains: { code: number }[]
    attacks: { code: number; can_direct: boolean }[]
    to_m2: boolean
    to_ep: boolean
  }): InternalOption[] {
    const options: InternalOption[] = []
    const side = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
    let targetsCache: string[] | null = null
    const targets = (): string[] => {
      if (targetsCache === null) targetsCache = this.attackTargetDescriptions(side)
      return targetsCache
    }
    ;(m.chains ?? []).forEach((c, i) => {
      options.push({
        id: 0,
        label: `战斗阶段发动【${this.cardName(Number(c.code))}】的效果`,
        response: {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.SELECT_CHAIN,
          index: i
        } as EngineResponse,
        actionType: 'ACTIVATE',
        cardCode: Number(c.code),
        cardName: this.cardName(Number(c.code)),
        topLevel: true
      })
    })
    ;(m.attacks ?? []).forEach((c, i) => {
      const foes = targets()
      const foeText = foes.length === 0 ? '对方场上没有怪兽' : `对方场上: ${foes.join('、')}`
      const directText = c.can_direct ? ' · 可直接攻击玩家' : ''
      options.push({
        id: 0,
        label: `宣告攻击：${this.cardName(Number(c.code))}（${foeText}${directText}）`,
        response: {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.SELECT_BATTLE,
          index: i
        } as EngineResponse,
        actionType: 'ATTACK',
        cardCode: Number(c.code),
        cardName: this.cardName(Number(c.code)),
        topLevel: true
      })
    })
    if (m.to_m2) {
      options.push({
        id: 0,
        label: '进入主要阶段 2',
        response: {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.TO_M2,
          index: null
        } as EngineResponse,
        actionType: 'PHASE_CHANGE',
        topLevel: true
      })
    }
    if (m.to_ep) {
      options.push({
        id: 0,
        label: '结束回合',
        response: {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.TO_EP,
          index: null
        } as EngineResponse,
        actionType: 'TURN_CHANGE',
        topLevel: true
      })
    }
    return this.numberOptions(options)
  }

  private buildFallbackResponse(): EngineResponse | null {
    const session = this.requireSession()
    const messages = session.core.duelGetMessage(session.handle)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const kind = Number(msg.type)
      if (kind === OcgMessageType.SELECT_CARD) {
        const m = msg as unknown as { min: number; selects: unknown[] }
        const count = Math.max(1, Number(m.min) || 1)
        return {
          type: OcgResponseType.SELECT_CARD,
          indicies: m.selects.slice(0, count).map((_, i) => i)
        } as EngineResponse
      }
      if (kind === OcgMessageType.SELECT_TRIBUTE) {
        const m = msg as unknown as { min: number; selects: unknown[] }
        const count = Math.max(1, Number(m.min) || 1)
        return {
          type: OcgResponseType.SELECT_TRIBUTE,
          indicies: m.selects.slice(0, count).map((_, i) => i)
        } as EngineResponse
      }
      if (kind === OcgMessageType.SELECT_PLACE) {
        const place = this.pickDefaultPlace(
          msg as unknown as { player: number; count: number; field_mask: number }
        )
        if (place) {
          return {
            type: OcgResponseType.SELECT_PLACE,
            places: [{ player: place.player, location: place.location, sequence: place.sequence }]
          } as EngineResponse
        }
      }
      if (kind === OcgMessageType.SELECT_POSITION) {
        const mask = Number((msg as unknown as { positions: number }).positions)
        const first = [
          CardPosition.FACEUP_ATTACK,
          CardPosition.FACEDOWN_DEFENSE,
          CardPosition.FACEUP_DEFENSE
        ].find((p) => mask & p)
        if (first) {
          return { type: OcgResponseType.SELECT_POSITION, position: first } as EngineResponse
        }
      }
      if (kind === OcgMessageType.SELECT_SUM) {
        const must = (msg as unknown as { select_must?: unknown[] }).select_must ?? []
        return {
          type: OcgResponseType.SELECT_SUM,
          indicies: must.map((_, i) => i)
        } as EngineResponse
      }
      if (kind === OcgMessageType.SORT_CHAIN) {
        return { type: OcgResponseType.SORT_CARD, order: null } as EngineResponse
      }
      if (kind === OcgMessageType.SORT_CARD) {
        return { type: OcgResponseType.SORT_CARD, order: null } as EngineResponse
      }
      if (kind === OcgMessageType.SELECT_COUNTER) {
        const m = msg as unknown as { counters?: number[] }
        return {
          type: OcgResponseType.SELECT_COUNTER,
          counters: (m.counters ?? []).slice(0, 1)
        } as EngineResponse
      }
      if (kind === OcgMessageType.SELECT_DISFIELD) {
        return {
          type: OcgResponseType.SELECT_DISFIELD,
          places: [{ player: 0, location: OcgLocation.SZONE, sequence: 0 }]
        } as EngineResponse
      }
      if (kind === OcgMessageType.SELECT_UNSELECT_CARD) {
        return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: null } as EngineResponse
      }
      if (kind === OcgMessageType.ANNOUNCE_RACE) {
        return { type: OcgResponseType.ANNOUNCE_RACE, races: [OcgRace.WARRIOR] } as EngineResponse
      }
      if (kind === OcgMessageType.ANNOUNCE_ATTRIB) {
        return {
          type: OcgResponseType.ANNOUNCE_ATTRIB,
          attributes: [OcgAttribute.EARTH]
        } as EngineResponse
      }
      if (kind === OcgMessageType.ANNOUNCE_CARD) {
        return { type: OcgResponseType.ANNOUNCE_CARD, card: 0 } as EngineResponse
      }
      if (kind === OcgMessageType.ANNOUNCE_NUMBER) {
        return { type: OcgResponseType.ANNOUNCE_NUMBER, value: 1 } as EngineResponse
      }
    }
    return null
  }

  private pickDefaultPlace(m: {
    player: number
    count: number
    field_mask: number
  }): { player: number; location: number; sequence: number } | null {
    const player = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
    const mask = ~Number(m.field_mask) >>> 0
    const ownMzone = (mask >>> 0) & 0x7f
    const ownSzone = (mask >>> 8) & 0x3f
    const ownPzone = (mask >>> 14) & 0x3
    const foeMzone = (mask >>> 16) & 0x7f
    const foeSzone = (mask >>> 24) & 0x3f
    const foePzone = (mask >>> 30) & 0x3
    const pickBit = (chunk: number, order: number[]): number => {
      for (const bit of order) if (chunk & (1 << bit)) return bit
      return -1
    }
    const mainM = pickBit(ownMzone, [2, 1, 3, 0, 4, 5, 6])
    const mainS = pickBit(ownSzone, [0, 1, 2, 3, 4, 5])
    if (ownMzone !== 0 && ownSzone === 0 && mainM >= 0) {
      return { player, location: CardLocation.MZONE, sequence: mainM }
    }
    if (ownSzone !== 0 && ownMzone === 0 && mainS >= 0) {
      return { player, location: CardLocation.SZONE, sequence: mainS }
    }
    if (mainM >= 0) return { player, location: CardLocation.MZONE, sequence: mainM }
    if (mainS >= 0) return { player, location: CardLocation.SZONE, sequence: mainS }
    if (ownPzone & 0x1) return { player, location: CardLocation.PZONE, sequence: 6 }
    if (ownPzone & 0x2) return { player, location: CardLocation.PZONE, sequence: 7 }
    const foeM = pickBit(foeMzone, [0, 1, 2, 3, 4, 5, 6])
    if (foeM >= 0) return { player, location: CardLocation.MZONE, sequence: foeM }
    const foeS = pickBit(foeSzone, [0, 1, 2, 3, 4, 5])
    if (foeS >= 0) return { player, location: CardLocation.SZONE, sequence: foeS }
    if (foePzone & 0x1) return { player, location: CardLocation.PZONE, sequence: 6 }
    if (foePzone & 0x2) return { player, location: CardLocation.PZONE, sequence: 7 }
    return null
  }

  private sealPendingStep(): void {
    const session = this.requireSession()
    const pending = session.pending
    session.pending = null
    if (!pending) return
    const dialogue = pending.speeches.filter(Boolean).join('\n')
    if (pending.narrations.length === 0 && !dialogue) return

    let lpChange: EngineDuelStep['lpChange']
    const side =
      Math.abs(session.lp[0] - pending.startLp[0]) >= Math.abs(session.lp[1] - pending.startLp[1])
        ? 0
        : 1
    if (session.lp[side] !== pending.startLp[side]) {
      lpChange = { player: side as 0 | 1, oldLp: pending.startLp[side], newLp: session.lp[side] }
    }

    session.steps.push({
      turn: pending.turn,
      phase: pending.phase,
      turnPlayer: pending.turnPlayer,
      actionPlayer: pending.actionPlayer,
      actionType: pending.actionType,
      cardCode: pending.cardCode,
      cardName: pending.cardName,
      speaker: this.duelistName(pending.actionPlayer),
      dialogue: dialogue || undefined,
      description: pending.narrations.length > 0 ? pending.narrations.join('；') : undefined,
      lpChange,
      boardAfter: this.snapshotBoard()
    })
  }

  private snapshotBoard(): LightweightCardSnapshot[] {
    const session = this.requireSession()
    const out: LightweightCardSnapshot[] = []
    const pool = new Map<string, { instanceId: string; duelistId?: string }[]>()
    for (const b of session.baseIds) {
      const list = pool.get(b.key) ?? []
      list.push({ instanceId: b.instanceId, duelistId: b.duelistId })
      pool.set(b.key, list)
    }
    const areas: Array<[OcgLocation, number]> = [
      [OcgLocation.MZONE, CardLocation.MZONE],
      [OcgLocation.SZONE, CardLocation.SZONE],
      [OcgLocation.HAND, CardLocation.HAND],
      [OcgLocation.GRAVE, CardLocation.GRAVE],
      [OcgLocation.REMOVED, CardLocation.REMOVED],
      [OcgLocation.DECK, CardLocation.DECK],
      [OcgLocation.EXTRA, CardLocation.EXTRA]
    ]
    const flags: OcgQueryFlags = (OcgQueryFlags.CODE |
      OcgQueryFlags.POSITION |
      OcgQueryFlags.IS_PUBLIC |
      OcgQueryFlags.OWNER) as OcgQueryFlags
    for (const controller of [0, 1] as const) {
      for (const [ocgLoc, cardLoc] of areas) {
        const rows = session.core.duelQueryLocation(session.handle, {
          flags,
          controller,
          location: ocgLoc
        })
        rows?.forEach((row, seq) => {
          if (!row || row.code === undefined) return
          const code = Number(row.code ?? 0)
          const key = `${controller}:${code}`
          const match = pool.get(key)?.shift()
          const instanceId = match?.instanceId ?? `engine_${session.engineCardCounter++}`
          const seqOf = Number((row as { sequence?: number }).sequence ?? seq)
          out.push({
            instanceId,
            code,
            controller,
            owner: controller,
            location: cardLoc,
            sequence: seqOf,
            position: Number(row.position ?? CardPosition.FACEDOWN),
            duelistId: match?.duelistId,
            overlayMaterials: []
          })
        })
      }
    }
    return out
  }

  private mapLocationBack(raw: number): number {
    const value = Number(raw)
    switch (value) {
      case OcgLocation.DECK:
        return CardLocation.DECK
      case OcgLocation.HAND:
        return CardLocation.HAND
      case OcgLocation.MZONE:
        return CardLocation.MZONE
      case OcgLocation.SZONE:
        return CardLocation.SZONE
      case OcgLocation.GRAVE:
        return CardLocation.GRAVE
      case OcgLocation.REMOVED:
        return CardLocation.REMOVED
      case OcgLocation.EXTRA:
        return CardLocation.EXTRA
      default:
        return value
    }
  }

  private cardName(code: number): string {
    const session = this.requireSession()
    const key = Number(code)
    if (!key || key <= 0) return '未知卡'
    const cached = session.nameCache.get(key)
    if (cached) return cached
    const dict = cdbService.getCardsByIds([key])
    const card: CdbCard | undefined = dict[key]
    const name = card?.name ?? '未知卡'
    session.nameCache.set(key, name)
    return name
  }

  private resolveLocCode(loc: unknown): number {
    if (!loc || typeof loc !== 'object') return 0
    const p = loc as { controller?: number; location?: number; sequence?: number }
    const controller = Number(p.controller)
    const location = Number(p.location)
    const sequence = Number(p.sequence)
    if (!Number.isFinite(controller) || !Number.isFinite(location) || !Number.isFinite(sequence)) {
      return 0
    }
    const session = this.requireSession()
    try {
      const rows = session.core.duelQueryLocation(session.handle, {
        flags: OcgQueryFlags.CODE as OcgQueryFlags,
        controller: (controller === 1 ? 1 : 0) as 0 | 1,
        location: location as OcgLocation
      })
      const code = Number(rows?.[sequence]?.code ?? 0)
      return code > 0 ? code : 0
    } catch {
      return 0
    }
  }

  private resolveLocName(loc: unknown): string | null {
    const code = this.resolveLocCode(loc)
    if (!code) return null
    const name = this.cardName(code)
    return name === '未知卡' ? null : name
  }

  private attackTargetDescriptions(player: 0 | 1): string[] {
    const foe = (player === 1 ? 0 : 1) as 0 | 1
    const session = this.requireSession()
    try {
      const rows = session.core.duelQueryLocation(session.handle, {
        flags: (OcgQueryFlags.CODE |
          OcgQueryFlags.POSITION |
          OcgQueryFlags.ATTACK |
          OcgQueryFlags.DEFENSE) as OcgQueryFlags,
        controller: foe,
        location: OcgLocation.MZONE
      })
      const out: string[] = []
      rows?.forEach((row) => {
        const code = Number(row?.code ?? 0)
        if (!row || code <= 0) return
        const pos = Number(row.position ?? 0)
        const isAttackPos =
          pos === CardPosition.FACEUP_ATTACK || pos === CardPosition.FACEDOWN_ATTACK
        const stat = isAttackPos ? Number(row.attack ?? 0) : Number(row.defense ?? 0)
        out.push(`${this.cardName(code)}(${positionName(pos)} ${isAttackPos ? '攻' : '防'}${stat})`)
      })
      return out
    } catch {
      return []
    }
  }

  private nameOf(code: number): string {
    const key = Number(code)
    if (!key || key <= 0) return '未知卡'
    const dict = cdbService.getCardsByIds([key])
    return dict[key]?.name ?? '未知卡'
  }

  private sideNameOf(state: DuelPuzzleState, side: 0 | 1): string {
    const duelist = (state.duelists || []).find((d) => d.team === side)
    return duelist?.name || (side === 0 ? '我方' : '对方')
  }

  private snapshotStatic(cards: FieldCard[]): LightweightCardSnapshot[] {
    return cards.map((c) => ({
      instanceId: c.instanceId,
      code: c.code,
      controller: c.controller,
      owner: c.controller,
      location: c.location,
      sequence: c.sequence,
      position: c.position,
      duelistId: c.duelistId,
      overlayMaterials: [...(c.overlayMaterials ?? [])]
    }))
  }

  private sideName(player: unknown): string {
    const session = this.requireSession()
    const side = (Number(player ?? session.activePlayer) === 1 ? 1 : 0) as 0 | 1
    const duelist = session.duelists.find((d) => d.team === side)
    return duelist?.name || (side === 0 ? '我方' : '对方')
  }

  private duelistName(side: 0 | 1): string {
    const session = this.requireSession()
    return session.duelists.find((d) => d.team === side)?.name || (side === 0 ? '我方' : '对方')
  }

  private describeTurn(): string {
    const session = this.requireSession()
    return `第 ${session.currentTurn} 回合 · ${this.sideName(session.currentTurnPlayer)}回合 · ${session.currentPhase}`
  }

  private numberOptions(options: InternalOption[]): InternalOption[] {
    return options.map((o, i) => ({
      ...o,
      id: i + 1,
      label: `${i + 1}. ${o.label}`
    }))
  }
}

export const duelEngineService = new DuelEngineService()
