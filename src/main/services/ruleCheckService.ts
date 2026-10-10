import {
  EngineProbeEntry,
  EngineProbeActivateOption,
  EngineProbeAttackEntry,
  EngineProbeOptionsParams,
  EngineProbeOptionsResult,
  EngineProbeAction,
  EngineProbeActionKind,
  EngineProbeActionParams,
  EngineProbeActionResult,
  EngineProbeCounterEntry,
  EngineProbeSelectParams,
  EnginePendingSelect,
  EngineSelectCandidate,
  EngineGainedCard,
  EngineChainMode,
  EngineExportReplayParams,
  CardLocation,
  DuelPhase,
  DuelPuzzleState,
  OcgDuelHandle,
  OcgLocation,
  OcgMessageType,
  OcgProcessResult,
  OcgResponseType,
  OcgResponse,
  OcgQueryFlags,
  SelectIdleCMDAction
} from '@shared/index'
import {
  nativeOcgcoreService as ocgcoreService,
  NativeOcgcoreService
} from './nativeOcgcoreService'
import { cdbService } from '../db/cdbService'
import { encodeResponseBytes, UnsupportedReplayQuestionError } from './yrpWriter'

class ReplayRecorder {
  public chunks: Uint8Array[] = []

  public record(msgType: number, response: OcgResponse): void {
    this.chunks.push(encodeResponseBytes(msgType, response))
  }

  public retryCheck(messages: ReturnType<NativeOcgcoreService['duelGetMessage']>): void {
    for (const msg of messages) {
      if (Number(msg.type) === OcgMessageType.RETRY && this.chunks.length > 0) this.chunks.pop()
    }
  }
}

const MAX_SETTLE_STEPS = 220
const MAX_FIELD_SCAN = 21
const MAX_SESSIONS = 8

interface TopLevelWait {
  kind: 'idle' | 'battle'
  battle: EngineBattle | null
  messages: ReturnType<NativeOcgcoreService['duelGetMessage']>
}

interface SettleOutcome {
  wait: TopLevelWait | null
  autoAnswers: number
}

interface InteractiveOutcome {
  status: 'settled' | 'parked' | 'end'
  pending: EnginePendingSelect | null
  pendingMsg: number | null
  chainIndexMap: number[] | null
}

type ReplayStepOutcome =
  { status: 'wait'; wait: TopLevelWait } | { status: 'end' } | { status: 'fail' }

interface EngineSession {
  core: NativeOcgcoreService
  handle: OcgDuelHandle
  turnPlayer: 0 | 1
  before: EngineSelectCandidate[]
  beforeHand: EngineSelectCandidate[]
  placed: EngineSelectCandidate[]
  pendingKind: 'CARD' | 'TRIBUTE' | 'CHAIN' | 'POSITION' | 'OPTION' | 'YESNO'
  pendingMsgType: number | null
  chainIndexMap: number[] | null
  chainMode: EngineChainMode
}

interface EngineBattle {
  attacks: { code: number; can_direct: boolean }[]
  toM2: boolean
  toEp: boolean
}

interface RawCardEntry {
  code?: number | bigint
  controller?: number
  location?: number
  sequence?: number
  desc?: number | bigint
  description?: number | bigint
}

interface IdleMessage {
  player: number
  summon: RawCardEntry[]
  spSummon: RawCardEntry[]
  posChange: RawCardEntry[]
  monsterSet: RawCardEntry[]
  spellSet: RawCardEntry[]
  activate: RawCardEntry[]
  toBp: boolean
  toEp: boolean
}

const CHILD_SELECT_KINDS = new Set<number>([
  OcgMessageType.SELECT_CARD,
  OcgMessageType.SELECT_UNSELECT_CARD,
  OcgMessageType.SELECT_TRIBUTE,
  OcgMessageType.SELECT_SUM,
  OcgMessageType.SELECT_PLACE,
  OcgMessageType.SELECT_DISFIELD,
  OcgMessageType.SELECT_COUNTER,
  OcgMessageType.SELECT_YESNO,
  OcgMessageType.SELECT_EFFECTYN,
  OcgMessageType.SELECT_OPTION,
  OcgMessageType.SELECT_POSITION,
  OcgMessageType.SORT_CHAIN,
  OcgMessageType.SORT_CARD
])

export class RuleCheckService {
  private sessions = new Map<string, EngineSession>()
  private sessionSeq = 0

  public async probeOptions(params: EngineProbeOptionsParams): Promise<EngineProbeOptionsResult> {
    if (params.replay) {
      const replayed = await this.probeOptionsWithReplay(params)
      if (replayed) return replayed
      return this.probeOptionsCore(params)
    }
    return this.probeOptionsCore(params)
  }

  private async probeOptionsWithReplay(
    params: EngineProbeOptionsParams
  ): Promise<EngineProbeOptionsResult | null> {
    const replay = params.replay
    if (!replay) return null
    const warnings: string[] = []
    const baseTurnPlayer = (replay.baseline.turnPlayer ?? 0) as 0 | 1

    if ((replay.baseline.duelists || []).length > 2) return null
    try {
      const engineBaseline =
        baseTurnPlayer === 1 ? this.swapSides(replay.baseline) : replay.baseline
      const created = await ocgcoreService.createDuelFromState(engineBaseline, {
        drawCountPerTurn: 0
      })
      if (!created.handle) return null
      ocgcoreService.seedCounters(created.handle, engineBaseline.cards)
      const settle = this.settleToWait(created.core, created.handle)
      if (!settle.wait || settle.wait.kind !== 'idle') return null
      let currentWait = settle.wait
      for (const entry of replay.actions) {
        const index = this.findIdleActionIndex(currentWait.messages, entry.action, baseTurnPlayer)
        if (index === null) {
          warnings.push('回放中断：引擎判定先前操作不可执行')
          return null
        }
        created.core.duelSetResponse(created.handle, {
          type: OcgResponseType.SELECT_IDLECMD,
          action: this.idleActionFor(entry.action.kind),
          index
        } as OcgResponse)
        const stepOutcome = this.advanceReplayStep(
          created.core,
          created.handle,
          entry.selections,
          entry.action.place,
          params.chainMode ?? 'auto'
        )
        if (stepOutcome.status === 'fail') {
          warnings.push('回放中断：历史操作缺少玩家选择记录')
          return null
        }
        if (stepOutcome.status === 'wait') currentWait = stepOutcome.wait
      }
      const wait = this.findWait(created.core.duelGetMessage(created.handle))
      if (!wait || wait.kind !== 'idle') {
        warnings.push('回放后引擎未回到可操作状态')
        return null
      }
      const result = this.collectFromWait(
        created.core,
        created.handle,
        params.currentPhase,
        baseTurnPlayer,
        wait,
        warnings
      )
      return result.ok ? result : null
    } catch {
      return null
    }
  }

  private async probeOptionsCore(
    params: EngineProbeOptionsParams
  ): Promise<EngineProbeOptionsResult> {
    const state = params.state
    const warnings: string[] = []
    const turnPlayer = (state.turnPlayer ?? 0) as 0 | 1
    const emptyFor = (ok: boolean, degraded: boolean): EngineProbeOptionsResult => ({
      ok,
      turnPlayer,
      degraded,
      warnings: [...warnings],
      summon: [],
      spSummon: [],
      posChange: [],
      monsterSet: [],
      spellSet: [],
      activate: [],
      attack: []
    })

    if ((state.duelists || []).length > 2) {
      warnings.push('多人对局暂不支持规则校验')
      return emptyFor(false, true)
    }

    try {
      const engineState = turnPlayer === 1 ? this.swapSides(state) : state
      const created = await ocgcoreService.createDuelFromState(engineState, {
        drawCountPerTurn: 0
      })
      if (!created.handle) {
        warnings.push('ocgcore 引擎建局失败，请检查 YGO 目录配置')
        return emptyFor(false, true)
      }
      ocgcoreService.seedCounters(created.handle, engineState.cards)
      const settle = this.settleToWait(created.core, created.handle)
      if (settle.autoAnswers > 0) {
        warnings.push(`推进阶段时自动处理了 ${settle.autoAnswers} 个引擎询问（触发效果）`)
      }
      if (!settle.wait) {
        warnings.push('引擎未进入可操作状态，本次校验不可用')
        return emptyFor(false, true)
      }
      return this.collectFromWait(
        created.core,
        created.handle,
        params.currentPhase,
        turnPlayer,
        settle.wait,
        warnings
      )
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : '规则校验异常')
      return emptyFor(false, true)
    }
  }

  public async probeAction(params: EngineProbeActionParams): Promise<EngineProbeActionResult> {
    const state = params.state
    const turnPlayer = (state.turnPlayer ?? 0) as 0 | 1
    const warnings: string[] = []
    const fail = (ok: boolean, degraded: boolean): EngineProbeActionResult => ({
      ok,
      degraded,
      warnings: [...warnings],
      counters: []
    })

    if ((state.duelists || []).length > 2) {
      warnings.push('多人对局暂不支持引擎动作重放')
      return fail(false, true)
    }

    try {
      const engineState = turnPlayer === 1 ? this.swapSides(state) : state
      const created = await ocgcoreService.createDuelFromState(engineState, {
        drawCountPerTurn: 0
      })
      if (!created.handle) {
        warnings.push('ocgcore 引擎建局失败，请检查 YGO 目录配置')
        return fail(false, true)
      }
      ocgcoreService.seedCounters(created.handle, engineState.cards)
      const settle = this.settleToWait(created.core, created.handle)
      if (!settle.wait) {
        warnings.push('引擎未进入可操作状态，无法重放该动作')
        return fail(false, true)
      }

      if (params.action.kind === 'TO_BP') {
        const battleWait = this.advanceToPhase(created.core, created.handle, settle.wait)
        if (!battleWait || battleWait.kind !== 'battle') {
          return fail(false, false)
        }
        return { ok: true, degraded: false, warnings: [], counters: [] }
      }

      if (params.action.kind === 'TO_EP') {
        created.core.duelSetResponse(created.handle, {
          type: OcgResponseType.SELECT_IDLECMD,
          action: SelectIdleCMDAction.TO_EP,
          index: null
        } as OcgResponse)
        this.advanceUntilWait(created.core, created.handle)
        return { ok: true, degraded: false, warnings: [], counters: [] }
      }

      if (params.action.kind === 'TO_M2') {
        const battleWait = this.advanceToPhase(created.core, created.handle, settle.wait)
        if (battleWait?.battle?.toM2) {
          created.core.duelSetResponse(created.handle, {
            type: OcgResponseType.SELECT_BATTLECMD,
            action: 2,
            index: null
          } as OcgResponse)
          this.advanceUntilWait(created.core, created.handle)
          return { ok: true, degraded: false, warnings: [], counters: [] }
        }
        return fail(false, false)
      }

      if (params.action.kind === 'ATTACK') {
        const battleWait = this.advanceToPhase(created.core, created.handle, settle.wait)
        if (!battleWait || battleWait.kind !== 'battle') return fail(false, false)
        const attacks = battleWait.battle?.attacks ?? []
        const attackIndex = attacks.findIndex(
          (a, i) =>
            Number(a.code) === params.action.code &&
            (params.action.fromSequence === undefined ||
              Number((a as { sequence?: number }).sequence ?? i) === params.action.fromSequence)
        )
        if (attackIndex < 0) return fail(false, false)
        const before = this.readFieldEntries(created.core, created.handle, turnPlayer)
        const beforeHand = this.readHandEntries(created.core, created.handle, turnPlayer)
        created.core.duelSetResponse(created.handle, {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: 1,
          index: attackIndex
        } as OcgResponse)
        const outcome = this.advanceInteractive(
          created.core,
          created.handle,
          turnPlayer,
          undefined,
          params.chainMode ?? 'auto'
        )
        if (outcome.status === 'parked' && outcome.pending) {
          const sessionId = this.createSession(
            {
              core: created.core,
              handle: created.handle,
              turnPlayer,
              before,
              beforeHand,
              placed: [],
              pendingKind: outcome.pending.kind,
              pendingMsgType: outcome.pendingMsg,
              chainIndexMap: outcome.chainIndexMap,
              chainMode: params.chainMode ?? 'auto'
            },
            outcome.pending.canCancel
          )
          return {
            ok: true,
            degraded: false,
            warnings: [...warnings],
            counters: [],
            pendingSelect: outcome.pending,
            sessionId
          }
        }
        return this.finalizeAction(
          created.core,
          created.handle,
          turnPlayer,
          before,
          beforeHand,
          [],
          warnings
        )
      }

      const index = this.findIdleActionIndex(settle.wait.messages, params.action, turnPlayer)
      if (index === null) {
        warnings.push('引擎判定该操作当前不可执行')
        return fail(false, false)
      }
      const before = this.readFieldEntries(created.core, created.handle, turnPlayer)
      const beforeHand = this.readHandEntries(created.core, created.handle, turnPlayer)
      const placed: EngineSelectCandidate[] = params.action.place
        ? [
            {
              code: params.action.code,
              controller: params.action.controller,
              location: params.action.place.location,
              sequence: params.action.place.sequence
            }
          ]
        : []
      created.core.duelSetResponse(created.handle, {
        type: OcgResponseType.SELECT_IDLECMD,
        action: this.idleActionFor(params.action.kind),
        index
      } as OcgResponse)
      const outcome = this.advanceInteractive(
        created.core,
        created.handle,
        turnPlayer,
        params.action.place,
        params.chainMode ?? 'auto'
      )
      if (outcome.status === 'parked' && outcome.pending) {
        const sessionId = this.createSession(
          {
            core: created.core,
            handle: created.handle,
            turnPlayer,
            before,
            beforeHand,
            placed,
            pendingKind: outcome.pending.kind,
            pendingMsgType: outcome.pendingMsg,
            chainIndexMap: outcome.chainIndexMap,
            chainMode: params.chainMode ?? 'auto'
          },
          outcome.pending.canCancel
        )
        return {
          ok: true,
          degraded: false,
          warnings: [...warnings],
          counters: [],
          pendingSelect: outcome.pending,
          sessionId
        }
      }
      return this.finalizeAction(
        created.core,
        created.handle,
        turnPlayer,
        before,
        beforeHand,
        placed,
        warnings
      )
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : '引擎动作重放异常')
      return fail(false, true)
    }
  }

  public async probeSelect(params: EngineProbeSelectParams): Promise<EngineProbeActionResult> {
    const session = this.sessions.get(params.sessionId)
    const fail = (msg: string): EngineProbeActionResult => ({
      ok: false,
      degraded: true,
      warnings: [msg],
      counters: []
    })
    if (!session) return fail('引擎会话已失效，请重试该操作')
    const {
      core,
      handle,
      turnPlayer,
      before,
      beforeHand,
      placed,
      pendingKind,
      pendingMsgType,
      chainIndexMap
    } = session
    const canceling = params.indices === null
    if (canceling && !this.sessionCanCancel.get(params.sessionId)) {
      return fail('该选择不可取消')
    }
    if (pendingMsgType === OcgMessageType.SELECT_EFFECTYN) {
      core.duelSetResponse(handle, {
        type: OcgResponseType.SELECT_EFFECTYN,
        yes: !canceling
      } as OcgResponse)
    } else if (pendingMsgType === OcgMessageType.SELECT_YESNO) {
      core.duelSetResponse(handle, {
        type: OcgResponseType.SELECT_YESNO,
        yes: !canceling && (params.indices?.[0] === 1 || params.indices?.[0] === 0)
      } as OcgResponse)
    } else if (pendingMsgType === OcgMessageType.SELECT_OPTION) {
      core.duelSetResponse(handle, {
        type: OcgResponseType.SELECT_OPTION,
        index: params.indices?.[0] ?? 0
      } as OcgResponse)
    } else if (pendingMsgType === OcgMessageType.SELECT_POSITION) {
      core.duelSetResponse(handle, {
        type: OcgResponseType.SELECT_POSITION,
        position: params.indices?.[0] ?? 1
      } as OcgResponse)
    } else if (pendingMsgType === OcgMessageType.SELECT_CHAIN) {
      const ownIndex = canceling ? null : (params.indices?.[0] ?? null)
      const index = ownIndex === null ? null : (chainIndexMap?.[ownIndex] ?? 0)
      core.duelSetResponse(handle, {
        type: OcgResponseType.SELECT_CHAIN,
        index
      } as OcgResponse)
    } else {
      core.duelSetResponse(handle, {
        type:
          pendingKind === 'TRIBUTE' ? OcgResponseType.SELECT_TRIBUTE : OcgResponseType.SELECT_CARD,
        indicies: params.indices
      } as OcgResponse)
    }
    const outcome = this.advanceInteractive(core, handle, turnPlayer, undefined, session.chainMode)
    if (outcome.status === 'parked' && outcome.pending) {
      session.pendingKind = outcome.pending.kind
      session.pendingMsgType = outcome.pendingMsg
      session.chainIndexMap = outcome.chainIndexMap
      this.sessionCanCancel.set(params.sessionId, outcome.pending.canCancel)
      return {
        ok: true,
        degraded: false,
        warnings: [],
        counters: [],
        pendingSelect: outcome.pending,
        sessionId: params.sessionId
      }
    }
    this.sessions.delete(params.sessionId)
    this.sessionCanCancel.delete(params.sessionId)
    return this.finalizeAction(core, handle, turnPlayer, before, beforeHand, placed, [])
  }

  public async cancelSelect(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    this.sessionCanCancel.delete(sessionId)
  }

  public async exportReplay(
    params: EngineExportReplayParams
  ): Promise<{ responses: Uint8Array[]; engineState: DuelPuzzleState } | { error: string }> {
    const fail = (msg: string): { error: string } => ({ error: msg })
    if (params.entries.length === 0) return fail('没有可导出的操作')
    const turnPlayer = (params.state.turnPlayer ?? 0) as 0 | 1
    const engineState = turnPlayer === 1 ? this.swapSides(params.state) : params.state
    let created: Awaited<ReturnType<typeof ocgcoreService.createDuelFromState>>
    try {
      created = await ocgcoreService.createDuelFromState(engineState, {
        drawCountPerTurn: 0,
        startingDrawCount: Math.max(
          Number(engineState.players[0]?.startHand ?? 0),
          Number(engineState.players[1]?.startHand ?? 0)
        )
      })
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
    if (!created.handle) return fail('引擎初始化失败，无法生成录像')
    const { core, handle } = created
    const rec = new ReplayRecorder()
    try {
      const settle = this.settleToWait(core, handle, rec)
      let wait: TopLevelWait | null = settle.wait
      if (!wait || wait.kind !== 'idle') return fail('引擎未能进入初始主要阶段')

      const driveTo = (target: 'BP' | 'M2' | 'EP'): string | null => {
        if (!wait) return '引擎对局已提前结束'
        if (target === 'BP') {
          if (wait.kind !== 'idle') return null
          const idle = this.readIdleMessage(wait.messages)
          if (!idle || !idle.toBp) return '引擎判定当前无法进入战斗阶段'
          this.respond(
            core,
            handle,
            OcgMessageType.SELECT_IDLECMD,
            { type: OcgResponseType.SELECT_IDLECMD, action: 6, index: null } as OcgResponse,
            rec
          )
          wait = this.advanceUntilWait(core, handle, rec)
          if (!wait || wait.kind !== 'battle') return '进入战斗阶段后引擎未进入战斗指令状态'
          return null
        }
        if (target === 'M2') {
          if (wait.kind !== 'battle') return null
          if (!wait.battle?.toM2) return '引擎判定当前无法进入主要阶段2'
          this.respond(
            core,
            handle,
            OcgMessageType.SELECT_BATTLECMD,
            { type: OcgResponseType.SELECT_BATTLECMD, action: 2, index: null } as OcgResponse,
            rec
          )
          wait = this.advanceUntilWait(core, handle, rec)
          if (!wait || wait.kind !== 'idle') return '进入主要阶段2后引擎未回到可操作状态'
          return null
        }
        if (wait.kind === 'idle') {
          this.respond(
            core,
            handle,
            OcgMessageType.SELECT_IDLECMD,
            { type: OcgResponseType.SELECT_IDLECMD, action: 7, index: null } as OcgResponse,
            rec
          )
        } else {
          this.respond(
            core,
            handle,
            OcgMessageType.SELECT_BATTLECMD,
            { type: OcgResponseType.SELECT_BATTLECMD, action: 3, index: null } as OcgResponse,
            rec
          )
        }
        wait = this.advanceUntilWait(core, handle, rec)
        return null
      }

      if (params.initialPhase === 'BP') {
        const err = driveTo('BP')
        if (err) return fail(err)
      } else if (params.initialPhase === 'M2') {
        const err = driveTo('BP') ?? driveTo('M2')
        if (err) return fail(err)
      } else if (params.initialPhase === 'EP') {
        const err = driveTo('EP')
        if (err) return fail(err)
      }

      let ordinal = 0
      for (const entry of params.entries) {
        if (entry.type === 'phase') {
          const err = driveTo(entry.to)
          if (err) return fail(err)
          continue
        }
        if (entry.type === 'nextTurn') {
          const err = driveTo('EP')
          if (err) return fail(err)
          continue
        }
        ordinal += 1
        if (!wait || wait.kind !== 'idle') {
          return fail(`第 ${ordinal} 个操作回放时引擎不在主要阶段`)
        }
        const index = this.findIdleActionIndex(wait.messages, entry.action, turnPlayer)
        if (index === null) {
          return fail(`第 ${ordinal} 个操作无法被引擎重现（编排中可能包含自由改动）`)
        }
        this.respond(
          core,
          handle,
          OcgMessageType.SELECT_IDLECMD,
          {
            type: OcgResponseType.SELECT_IDLECMD,
            action: this.idleActionFor(entry.action.kind),
            index
          } as OcgResponse,
          rec
        )
        const outcome = this.advanceReplayStep(
          core,
          handle,
          entry.selections,
          entry.action.place,
          entry.chainMode,
          rec
        )
        if (outcome.status === 'fail') return fail(`第 ${ordinal} 个操作缺少玩家选择记录`)
        wait = outcome.status === 'wait' ? outcome.wait : null
      }
      return { responses: rec.chunks, engineState }
    } catch (err) {
      if (err instanceof UnsupportedReplayQuestionError) {
        return fail('录像导出暂不支持该操作涉及的引擎询问（指示物选择/卡牌排序/数值合计类效果）')
      }
      return fail(err instanceof Error ? err.message : String(err))
    }
  }

  private sessionCanCancel = new Map<string, boolean>()

  private createSession(session: EngineSession, canCancel: boolean): string {
    this.sessionSeq += 1
    const sessionId = `engsel_${Date.now()}_${this.sessionSeq}`
    this.sessions.set(sessionId, session)
    while (this.sessions.size > MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value
      if (oldest === undefined) break
      this.sessions.delete(oldest)
      this.sessionCanCancel.delete(oldest)
    }
    this.sessionCanCancel.set(sessionId, canCancel)
    return sessionId
  }

  private finalizeAction(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1,
    before: EngineSelectCandidate[],
    beforeHand: EngineSelectCandidate[],
    placed: EngineSelectCandidate[],
    warnings: string[]
  ): EngineProbeActionResult {
    const afterField = this.readFieldEntries(core, handle, turnPlayer)
    const afterDeep = this.readDeepEntries(core, handle, turnPlayer)
    const afterHand = afterDeep.filter((c) => c.location === CardLocation.HAND)
    const counters = this.readFieldCounters(core, handle, turnPlayer)
    const stillThere = (c: EngineSelectCandidate): boolean =>
      afterField.some(
        (a) =>
          a.controller === c.controller &&
          a.location === c.location &&
          a.sequence === c.sequence &&
          a.code === c.code
      )
    const missing = [...before, ...placed]
      .filter((c) => !stillThere(c))
      .map((c) => {
        const dest = afterDeep.find(
          (a) => a.code === c.code && a.controller === c.controller && a.location !== c.location
        )
        return { ...c, toLocation: dest ? dest.location : CardLocation.GRAVE }
      })
    const gained: EngineGainedCard[] = []
    const beforeCount = new Map<string, number>()
    for (const e of beforeHand) {
      const key = `${e.controller}:${e.code}`
      beforeCount.set(key, (beforeCount.get(key) ?? 0) + 1)
    }
    const afterCount = new Map<string, number>()
    for (const e of afterHand) {
      const key = `${e.controller}:${e.code}`
      afterCount.set(key, (afterCount.get(key) ?? 0) + 1)
    }
    for (const [key, count] of afterCount) {
      const delta = count - (beforeCount.get(key) ?? 0)
      const [controllerStr, codeStr] = key.split(':')
      for (let i = 0; i < delta; i++) {
        gained.push({
          code: Number(codeStr),
          controller: (Number(controllerStr) === 1 ? 1 : 0) as 0 | 1
        })
      }
    }
    const placedCard = afterField.find(
      (a) =>
        !before.some(
          (b) =>
            b.code === a.code &&
            b.controller === a.controller &&
            b.location === a.location &&
            b.sequence === a.sequence
        )
    )
    return {
      ok: true,
      degraded: false,
      warnings: [...warnings],
      counters,
      missing,
      gained,
      placedCard
    }
  }

  private idleActionFor(kind: EngineProbeActionKind): SelectIdleCMDAction {
    switch (kind) {
      case 'SUMMON':
        return SelectIdleCMDAction.SELECT_SUMMON
      case 'SP_SUMMON':
        return SelectIdleCMDAction.SELECT_SPECIAL_SUMMON
      case 'REPOS':
        return SelectIdleCMDAction.SELECT_POS_CHANGE
      case 'SET_MONSTER':
        return SelectIdleCMDAction.SELECT_MONSTER_SET
      case 'SET_SPELL':
        return SelectIdleCMDAction.SELECT_SPELL_SET
      case 'ACTIVATE':
        return SelectIdleCMDAction.SELECT_ACTIVATE
      case 'TO_BP':
        return SelectIdleCMDAction.TO_BP
      case 'TO_EP':
        return SelectIdleCMDAction.TO_EP
      default:
        return SelectIdleCMDAction.SELECT_ACTIVATE
    }
  }

  private findIdleActionIndex(
    messages: ReturnType<NativeOcgcoreService['duelGetMessage']>,
    action: EngineProbeAction,
    turnPlayer: 0 | 1
  ): number | null {
    const idle = this.readIdleMessage(messages)
    if (!idle) return null
    if (action.kind === 'TO_BP' || action.kind === 'TO_EP' || action.kind === 'TO_M2') return null
    const list =
      action.kind === 'SUMMON'
        ? idle.summon
        : action.kind === 'SP_SUMMON'
          ? idle.spSummon
          : action.kind === 'REPOS'
            ? idle.posChange
            : action.kind === 'SET_MONSTER'
              ? idle.monsterSet
              : action.kind === 'SET_SPELL'
                ? idle.spellSet
                : idle.activate
    const engineController = action.controller === turnPlayer ? 0 : 1
    if (action.kind === 'ACTIVATE' && typeof action.effectIndex === 'number') {
      if (action.effectIndex >= 0 && action.effectIndex < list.length) {
        return action.effectIndex
      }
    }
    const isHand = action.fromLocation === CardLocation.HAND
    const index = list.findIndex(
      (raw) =>
        Number(raw.code ?? 0) === action.code &&
        Number(raw.controller ?? 0) === engineController &&
        this.mapLocationBack(Number(raw.location ?? 0)) === action.fromLocation &&
        (isHand ||
          action.fromSequence === undefined ||
          Number(raw.sequence ?? 0) === action.fromSequence)
    )
    return index >= 0 ? index : null
  }

  private readFieldCounters(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1
  ): EngineProbeCounterEntry[] {
    const out: EngineProbeCounterEntry[] = []
    const flags = (OcgQueryFlags.CODE | OcgQueryFlags.COUNTERS) as OcgQueryFlags
    for (const engineController of [0, 1] as const) {
      const editorController: 0 | 1 =
        engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
      for (const ocgLoc of [OcgLocation.MZONE, OcgLocation.SZONE, OcgLocation.PZONE]) {
        for (let sequence = 0; sequence < MAX_FIELD_SCAN; sequence++) {
          const info = core.duelQuery(handle, {
            flags,
            controller: engineController,
            location: ocgLoc,
            sequence,
            overlaySequence: 0
          })
          if (!info?.code) continue
          const raw = (info.counters ?? {}) as Record<string, number>
          const counters: Record<number, number> = {}
          for (const [typeStr, countUnknown] of Object.entries(raw)) {
            const type = Number(typeStr)
            const count = Number(countUnknown)
            if (count > 0 && type > 0) counters[type] = count
          }
          if (Object.keys(counters).length === 0) continue
          out.push({
            code: Number(info.code),
            controller: editorController,
            location: this.mapLocationBack(Number(ocgLoc)),
            sequence,
            counters
          })
        }
      }
    }
    return out
  }

  private swapSides(state: DuelPuzzleState): DuelPuzzleState {
    return {
      ...state,
      turnPlayer: 0 as const,
      players: [state.players[1], state.players[0]],
      cards: state.cards.map((c) => ({
        ...c,
        controller: (1 - c.controller) as 0 | 1,
        owner: (1 - c.owner) as 0 | 1
      }))
    }
  }

  private respond(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    msgType: number,
    response: OcgResponse,
    rec: ReplayRecorder | null
  ): void {
    if (rec) rec.record(msgType, response)
    core.duelSetResponse(handle, response)
  }

  private settleToWait(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    rec: ReplayRecorder | null = null
  ): SettleOutcome {
    let autoAnswers = 0
    let result = core.duelProcess(handle)
    for (let guard = 0; guard < MAX_SETTLE_STEPS; guard++) {
      const messages = core.duelGetMessage(handle)
      rec?.retryCheck(messages)
      const wait = this.findWait(messages)
      if (wait) return { wait, autoAnswers }
      if (this.autoAnswerNext(core, handle, messages, rec)) {
        autoAnswers++
        result = core.duelProcess(handle)
        continue
      }
      if (result === OcgProcessResult.END) break
      result = core.duelProcess(handle)
    }
    return { wait: null, autoAnswers }
  }

  private findWait(
    messages: ReturnType<NativeOcgcoreService['duelGetMessage']>
  ): TopLevelWait | null {
    for (const msg of messages) {
      const kind = Number(msg.type)
      if (kind === OcgMessageType.SELECT_IDLECMD) {
        return { kind: 'idle', battle: null, messages }
      }
      if (kind === OcgMessageType.SELECT_BATTLECMD) {
        const m = msg as unknown as {
          attacks: { code: number; can_direct: boolean }[]
          to_m2: boolean
          to_ep: boolean
        }
        return {
          kind: 'battle',
          battle: { attacks: m.attacks ?? [], toM2: m.to_m2 === true, toEp: m.to_ep === true },
          messages
        }
      }
    }
    return null
  }

  private autoAnswerNext(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    messages: ReturnType<NativeOcgcoreService['duelGetMessage']>,
    rec: ReplayRecorder | null = null
  ): boolean {
    for (const msg of messages) {
      const kind = Number(msg.type)
      if (kind === OcgMessageType.SELECT_CHAIN) {
        const m = msg as unknown as { forced: boolean; selects: unknown[] }
        const hasOptions = (m.selects ?? []).length > 0
        this.respond(
          core,
          handle,
          kind,
          {
            type: OcgResponseType.SELECT_CHAIN,
            index: hasOptions && m.forced === true ? 0 : null
          } as OcgResponse,
          rec
        )
        return true
      }
      if (CHILD_SELECT_KINDS.has(kind)) {
        this.autoAnswerSelect(core, handle, msg, rec)
        return true
      }
    }
    return false
  }

  private autoAnswerSelect(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    msg: unknown,
    rec: ReplayRecorder | null = null
  ): void {
    const kind = Number((msg as { type: number }).type)
    const m = msg as Record<string, unknown>
    const respond = (response: OcgResponse): void => this.respond(core, handle, kind, response, rec)
    if (kind === OcgMessageType.SELECT_EFFECTYN) {
      respond({ type: OcgResponseType.SELECT_EFFECTYN, yes: false } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_YESNO) {
      respond({ type: OcgResponseType.SELECT_YESNO, yes: false } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_OPTION) {
      respond({ type: OcgResponseType.SELECT_OPTION, index: 0 } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_UNSELECT_CARD) {
      respond({ type: OcgResponseType.SELECT_UNSELECT_CARD, index: null } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_CARD) {
      const count = ((m.selects as unknown[]) ?? []).length
      const canCancel = (m.can_cancel as boolean) === true
      respond({
        type: OcgResponseType.SELECT_CARD,
        indicies: canCancel || count === 0 ? null : [0]
      } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_TRIBUTE) {
      const count = ((m.selects as unknown[]) ?? []).length
      const canCancel = (m.can_cancel as boolean) === true
      const min = Math.max(1, Number(m.min ?? 1))
      respond({
        type: OcgResponseType.SELECT_TRIBUTE,
        indicies:
          canCancel || count === 0
            ? null
            : Array.from({ length: Math.min(min, count) }, (_, i) => i)
      } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_SUM) {
      const must = ((m.selects_must as unknown[]) ?? []).length
      respond({
        type: OcgResponseType.SELECT_SUM,
        indicies: Array.from({ length: must }, (_, i) => i)
      } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_PLACE) {
      const place = this.pickFirstPlace(m)
      respond({
        type: OcgResponseType.SELECT_PLACE,
        places: place
          ? [{ player: place.player, location: place.location, sequence: place.sequence }]
          : []
      } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_DISFIELD) {
      const place = this.pickFirstPlace(m)
      respond({
        type: OcgResponseType.SELECT_DISFIELD,
        places: place
          ? [{ player: place.player, location: place.location, sequence: place.sequence }]
          : []
      } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_COUNTER) {
      const cards = (m.cards as { count?: number }[] | undefined) ?? []
      const total = Number(m.count ?? 0)
      const alloc: number[] = []
      let remain = total
      for (const c of cards) {
        const take = Math.min(Math.max(0, remain), Math.max(0, Number(c.count ?? 0)))
        alloc.push(take)
        remain -= take
      }
      respond({ type: OcgResponseType.SELECT_COUNTER, counters: alloc } as OcgResponse)
      return
    }
    if (kind === OcgMessageType.SELECT_POSITION) {
      respond({ type: OcgResponseType.SELECT_POSITION, position: 1 } as OcgResponse)
      return
    }
    respond({ type: OcgResponseType.SORT_CARD, order: null } as OcgResponse)
  }

  private pickFirstPlace(m: Record<string, unknown>): {
    player: number
    location: number
    sequence: number
  } | null {
    const player = Number(m.player ?? 0)
    const mask = ~Number(m.field_mask ?? 0) >>> 0
    const ownMzone = (mask >>> 0) & 0x7f
    const ownSzone = (mask >>> 8) & 0x3f
    for (let seq = 0; seq < 7; seq++) {
      if (ownMzone & (1 << seq)) return { player, location: OcgLocation.MZONE, sequence: seq }
    }
    for (let seq = 0; seq < 6; seq++) {
      if (ownSzone & (1 << seq)) return { player, location: OcgLocation.SZONE, sequence: seq }
    }
    return null
  }

  private collectFromWait(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    currentPhase: DuelPhase,
    turnPlayer: 0 | 1,
    wait: TopLevelWait,
    warnings: string[]
  ): EngineProbeOptionsResult {
    const result = (): EngineProbeOptionsResult => ({
      ok: true,
      turnPlayer,
      degraded: false,
      warnings: [...warnings],
      summon: [],
      spSummon: [],
      posChange: [],
      monsterSet: [],
      spellSet: [],
      activate: [],
      attack: []
    })

    if (currentPhase === 'BP') {
      const reached = this.advanceToPhase(core, handle, wait)
      if (!reached || reached.kind !== 'battle') {
        warnings.push('引擎判定不能进入战斗阶段')
        return result()
      }
      const attacks = reached.battle?.attacks ?? []
      const mapped: EngineProbeAttackEntry[] = attacks.map((a, i) => ({
        code: Number(a.code),
        controller: turnPlayer,
        location: CardLocation.MZONE,
        sequence: Number((a as { sequence?: number }).sequence ?? i),
        canDirect: a.can_direct === true
      }))
      return {
        ...result(),
        attack: mapped,
        toM2: reached.battle?.toM2 === true,
        toEp: reached.battle?.toEp === true
      }
    }

    if (currentPhase === 'M2') {
      const inBattle = this.advanceToPhase(core, handle, wait)
      if (!inBattle || inBattle.kind !== 'battle') {
        return result()
      }
      if (inBattle.battle?.toM2) {
        core.duelSetResponse(handle, {
          type: OcgResponseType.SELECT_BATTLECMD,
          action: 2,
          index: null
        } as OcgResponse)
        const m2wait = this.advanceUntilWait(core, handle)
        if (m2wait && m2wait.kind === 'idle') {
          const idle = this.readIdleMessage(m2wait.messages)
          if (idle) return { ...result(), ...this.mapIdle(idle, turnPlayer), toEp: idle.toEp }
        }
        return result()
      }
      return result()
    }

    if (currentPhase !== 'M1') {
      return result()
    }

    if (wait.kind === 'battle') {
      return result()
    }
    const idle = this.readIdleMessage(wait.messages)
    if (!idle) return result()
    return {
      ...result(),
      ...this.mapIdle(idle, turnPlayer),
      toBp: idle.toBp,
      toEp: idle.toEp
    }
  }

  private mapIdle(
    idle: IdleMessage,
    turnPlayer: 0 | 1
  ): Pick<
    EngineProbeOptionsResult,
    'summon' | 'spSummon' | 'posChange' | 'monsterSet' | 'spellSet' | 'activate'
  > {
    const mapAll = (list: RawCardEntry[]): EngineProbeEntry[] =>
      list.map((raw) => {
        const engineController = (Number(raw.controller ?? 0) === 1 ? 1 : 0) as 0 | 1
        const editorController: 0 | 1 =
          engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
        return {
          code: Number(raw.code ?? 0),
          controller: editorController,
          location: this.mapLocationBack(Number(raw.location ?? 0)),
          sequence: Number(raw.sequence ?? 0)
        }
      })

    const activateMap = new Map<
      string,
      { entry: EngineProbeEntry; options: EngineProbeActivateOption[] }
    >()
    idle.activate.forEach((raw, effectIndex) => {
      const engineController = (Number(raw.controller ?? 0) === 1 ? 1 : 0) as 0 | 1
      const editorController: 0 | 1 =
        engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
      const code = Number(raw.code ?? 0)
      const location = this.mapLocationBack(Number(raw.location ?? 0))
      const sequence = Number(raw.sequence ?? 0)
      const desc = Number(raw.description ?? raw.desc ?? 0)
      const descText = cdbService.getEffectDescription(desc, code)
      const key = `${editorController}:${location}:${sequence}:${code}`
      let existing = activateMap.get(key)
      if (!existing) {
        existing = {
          entry: { code, controller: editorController, location, sequence },
          options: []
        }
        activateMap.set(key, existing)
      }
      existing.options.push({ desc, descText, effectIndex })
    })

    const activate: EngineProbeEntry[] = Array.from(activateMap.values()).map(
      ({ entry, options }) => ({
        ...entry,
        options
      })
    )

    return {
      summon: mapAll(idle.summon),
      spSummon: mapAll(idle.spSummon),
      posChange: mapAll(idle.posChange),
      monsterSet: mapAll(idle.monsterSet),
      spellSet: mapAll(idle.spellSet),
      activate
    }
  }

  private advanceToPhase(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    wait: TopLevelWait
  ): TopLevelWait | null {
    if (wait.kind === 'battle') return wait
    const idle = this.readIdleMessage(wait.messages)
    if (!idle || !idle.toBp) return null
    core.duelSetResponse(handle, {
      type: OcgResponseType.SELECT_IDLECMD,
      action: 6,
      index: null
    } as OcgResponse)
    return this.advanceUntilWait(core, handle)
  }

  private advanceUntilWait(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    rec: ReplayRecorder | null = null
  ): TopLevelWait | null {
    let result = core.duelProcess(handle)
    for (let guard = 0; guard < MAX_SETTLE_STEPS; guard++) {
      const messages = core.duelGetMessage(handle)
      rec?.retryCheck(messages)
      const wait = this.findWait(messages)
      if (wait) return wait
      if (this.autoAnswerNext(core, handle, messages, rec)) {
        result = core.duelProcess(handle)
        continue
      }
      if (result === OcgProcessResult.END) break
      result = core.duelProcess(handle)
    }
    return null
  }

  private advanceInteractive(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1,
    place?: { location: number; sequence: number },
    chainMode: EngineChainMode = 'auto'
  ): InteractiveOutcome {
    let result = core.duelProcess(handle)
    for (let guard = 0; guard < MAX_SETTLE_STEPS; guard++) {
      const messages = core.duelGetMessage(handle)
      const wait = this.findWait(messages)
      if (wait) return { status: 'settled', pending: null, pendingMsg: null, chainIndexMap: null }
      let handled = false
      for (const msg of messages) {
        const kind = Number(msg.type)
        if (kind === OcgMessageType.SELECT_PLACE) {
          this.respondPlace(core, handle, msg, place)
          handled = true
          break
        }
        if (kind === OcgMessageType.SELECT_CHAIN) {
          const m = msg as { forced?: boolean; spe_count?: number; selects?: RawCardEntry[] }
          if (!this.shouldAskChain(m, chainMode)) {
            core.duelSetResponse(handle, {
              type: OcgResponseType.SELECT_CHAIN,
              index: null
            } as OcgResponse)
            handled = true
            break
          }
          const prompt = this.chainPromptFrom(msg, turnPlayer)
          if (prompt) {
            return {
              status: 'parked',
              pending: prompt.pending,
              pendingMsg: kind,
              chainIndexMap: prompt.indexMap
            }
          }
          continue
        }
        if (kind === OcgMessageType.SELECT_EFFECTYN) {
          const pending = this.effectYnPromptFrom(msg, turnPlayer)
          if (pending) return { status: 'parked', pending, pendingMsg: kind, chainIndexMap: null }
          continue
        }
        if (kind === OcgMessageType.SELECT_YESNO) {
          const pending = this.yesNoPromptFrom(msg)
          if (pending) return { status: 'parked', pending, pendingMsg: kind, chainIndexMap: null }
          continue
        }
        if (kind === OcgMessageType.SELECT_OPTION) {
          const pending = this.optionPromptFrom(msg)
          if (pending) return { status: 'parked', pending, pendingMsg: kind, chainIndexMap: null }
          continue
        }
        if (kind === OcgMessageType.SELECT_POSITION) {
          const pending = this.positionPromptFrom(msg, turnPlayer)
          if (pending) return { status: 'parked', pending, pendingMsg: kind, chainIndexMap: null }
          continue
        }
        const pending = this.selectPromptFrom(msg, turnPlayer)
        if (pending) return { status: 'parked', pending, pendingMsg: kind, chainIndexMap: null }
      }
      if (handled) {
        result = core.duelProcess(handle)
        continue
      }
      if (this.autoAnswerNext(core, handle, messages)) {
        result = core.duelProcess(handle)
        continue
      }
      if (result === OcgProcessResult.END) break
      result = core.duelProcess(handle)
    }
    return { status: 'end', pending: null, pendingMsg: null, chainIndexMap: null }
  }

  private advanceReplayStep(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    selections?: (number[] | null)[] | null,
    place?: { location: number; sequence: number },
    chainMode: EngineChainMode = 'auto',
    rec: ReplayRecorder | null = null
  ): ReplayStepOutcome {
    const queue = [...(selections ?? [])]
    let result = core.duelProcess(handle)
    for (let guard = 0; guard < MAX_SETTLE_STEPS; guard++) {
      const messages = core.duelGetMessage(handle)
      rec?.retryCheck(messages)
      const wait = this.findWait(messages)
      if (wait) return { status: 'wait', wait }
      let handled = false
      for (const msg of messages) {
        const kind = Number(msg.type)
        if (kind === OcgMessageType.SELECT_EFFECTYN) {
          const m = msg as { controller?: number }
          const own = Number(m.controller ?? 0) === 0
          const next = own ? queue.shift() : null
          const yes = own && next !== undefined && next !== null && next.length > 0
          this.respond(
            core,
            handle,
            kind,
            {
              type: OcgResponseType.SELECT_EFFECTYN,
              yes
            } as OcgResponse,
            rec
          )
          handled = true
          break
        }
        if (kind === OcgMessageType.SELECT_CHAIN) {
          const m = msg as { forced?: boolean; spe_count?: number; selects?: RawCardEntry[] }
          if (!this.shouldAskChain(m, chainMode)) {
            this.respond(
              core,
              handle,
              kind,
              {
                type: OcgResponseType.SELECT_CHAIN,
                index: null
              } as OcgResponse,
              rec
            )
            handled = true
            break
          }
          const own = this.ownChainIndices(m.selects ?? [])
          const next = queue.shift()
          let ownIndex: number | null =
            next === undefined || next === null ? null : (next[0] ?? null)
          if (ownIndex === null && m.forced === true) ownIndex = 0
          const index = ownIndex === null ? null : (own[ownIndex] ?? 0)
          this.respond(
            core,
            handle,
            kind,
            {
              type: OcgResponseType.SELECT_CHAIN,
              index
            } as OcgResponse,
            rec
          )
          handled = true
          break
        }
        if (kind === OcgMessageType.SELECT_POSITION) {
          const m = msg as { player?: number; positions?: number }
          if (Number(m.player ?? 0) !== 0) continue
          const mask = Number(m.positions ?? 0)
          const next = queue.shift()
          const chosen = next?.[0]
          const position =
            chosen !== undefined && (mask & chosen) !== 0 ? chosen : this.lowestPositionBit(mask)
          this.respond(
            core,
            handle,
            kind,
            {
              type: OcgResponseType.SELECT_POSITION,
              position
            } as OcgResponse,
            rec
          )
          handled = true
          break
        }
        if (kind === OcgMessageType.SELECT_CARD || kind === OcgMessageType.SELECT_TRIBUTE) {
          const next = queue.shift()
          if (next === undefined) {
            const m = msg as { can_cancel?: boolean; selects?: unknown[] }
            if (m.can_cancel === true || (m.selects ?? []).length === 0) {
              this.respond(
                core,
                handle,
                kind,
                {
                  type:
                    kind === OcgMessageType.SELECT_TRIBUTE
                      ? OcgResponseType.SELECT_TRIBUTE
                      : OcgResponseType.SELECT_CARD,
                  indicies: null
                } as OcgResponse,
                rec
              )
              handled = true
              break
            }
            return { status: 'fail' }
          }
          this.respond(
            core,
            handle,
            kind,
            {
              type:
                kind === OcgMessageType.SELECT_TRIBUTE
                  ? OcgResponseType.SELECT_TRIBUTE
                  : OcgResponseType.SELECT_CARD,
              indicies: next
            } as OcgResponse,
            rec
          )
          handled = true
          break
        }
        if (kind === OcgMessageType.SELECT_PLACE) {
          this.respondPlace(core, handle, msg, place, rec)
          handled = true
          break
        }
      }
      if (handled) {
        result = core.duelProcess(handle)
        continue
      }
      if (this.autoAnswerNext(core, handle, messages, rec)) {
        result = core.duelProcess(handle)
        continue
      }
      if (result === OcgProcessResult.END) break
      result = core.duelProcess(handle)
    }
    return { status: 'end' }
  }

  private lowestPositionBit(mask: number): number {
    for (const bit of [1, 4, 8, 2]) {
      if ((mask & bit) !== 0) return bit
    }
    return 1
  }

  private shouldAskChain(
    m: { forced?: boolean; spe_count?: number; selects?: RawCardEntry[] },
    chainMode: EngineChainMode
  ): boolean {
    const ownCount = this.ownChainIndices(m.selects ?? []).length
    if (ownCount === 0) return false
    if (m.forced === true) return true
    if (chainMode === 'always') return true
    const speCount = Number(m.spe_count ?? 0)
    if (chainMode === 'ignore') return speCount === 0x7f
    return speCount > 0
  }

  private chainPromptFrom(
    msg: unknown,
    turnPlayer: 0 | 1
  ): { pending: EnginePendingSelect; indexMap: number[] } | null {
    const m = msg as {
      forced?: boolean
      selects?: RawCardEntry[]
    }
    const selects = m.selects ?? []
    const indexMap: number[] = []
    selects.forEach((raw, i) => {
      if (Number(raw.controller ?? 0) === 0) indexMap.push(i)
    })
    if (indexMap.length === 0) return null
    const candidates: EngineSelectCandidate[] = indexMap.map((i) => {
      const raw = selects[i]
      return {
        code: Number(raw.code ?? 0),
        controller: turnPlayer,
        location: this.mapLocationBack(Number(raw.location ?? 0)),
        sequence: Number(raw.sequence ?? 0)
      }
    })
    return {
      pending: {
        kind: 'CHAIN',
        min: 1,
        max: 1,
        canCancel: m.forced !== true,
        candidates
      },
      indexMap
    }
  }

  private effectYnPromptFrom(msg: unknown, turnPlayer: 0 | 1): EnginePendingSelect | null {
    const m = msg as {
      controller?: number
      code?: number
      location?: number
      sequence?: number
    }
    if (Number(m.controller ?? 0) !== 0) return null
    return {
      kind: 'CHAIN',
      min: 1,
      max: 1,
      canCancel: true,
      candidates: [
        {
          code: Number(m.code ?? 0),
          controller: turnPlayer,
          location: this.mapLocationBack(Number(m.location ?? 0)),
          sequence: Number(m.sequence ?? 0)
        }
      ]
    }
  }

  private yesNoPromptFrom(msg: unknown): EnginePendingSelect | null {
    const m = msg as { player?: number; description?: number | bigint }
    if (Number(m.player ?? 0) !== 0) return null
    const descText = cdbService.getEffectDescription(Number(m.description ?? 0))
    return {
      kind: 'YESNO',
      min: 1,
      max: 1,
      canCancel: false,
      candidates: [],
      hint: descText
    }
  }

  private optionPromptFrom(msg: unknown): EnginePendingSelect | null {
    const m = msg as { player?: number; options?: (number | bigint)[] }
    if (Number(m.player ?? 0) !== 0) return null
    const options = (m.options ?? []).map((desc) => cdbService.getEffectDescription(Number(desc)))
    return {
      kind: 'OPTION',
      min: 1,
      max: 1,
      canCancel: false,
      candidates: [],
      options
    }
  }

  private ownChainIndices(selects: RawCardEntry[]): number[] {
    const out: number[] = []
    selects.forEach((raw, i) => {
      if (Number(raw.controller ?? 0) === 0) out.push(i)
    })
    return out
  }

  private positionPromptFrom(msg: unknown, turnPlayer: 0 | 1): EnginePendingSelect | null {
    const m = msg as {
      player?: number
      code?: number
      controller?: number
      location?: number
      sequence?: number
      positions?: number
    }
    if (Number(m.player ?? 0) !== 0) return null
    const mask = Number(m.positions ?? 0)
    if (mask === 0) return null
    return {
      kind: 'POSITION',
      min: 1,
      max: 1,
      canCancel: false,
      candidates: [
        {
          code: Number(m.code ?? 0),
          controller: (Number(m.controller ?? 0) === 0
            ? turnPlayer
            : ((1 - turnPlayer) as 0 | 1)) as 0 | 1,
          location: this.mapLocationBack(Number(m.location ?? 0)),
          sequence: Number(m.sequence ?? 0)
        }
      ],
      positions: mask
    }
  }

  private selectPromptFrom(msg: unknown, turnPlayer: 0 | 1): EnginePendingSelect | null {
    const kind = Number((msg as { type: number }).type)
    if (kind !== OcgMessageType.SELECT_CARD && kind !== OcgMessageType.SELECT_TRIBUTE) return null
    const m = msg as {
      can_cancel?: boolean
      min?: number
      max?: number
      selects?: RawCardEntry[]
    }
    const selects = m.selects ?? []
    if (selects.length === 0) return null
    const candidates = selects.map((raw) => {
      const engineController = (Number(raw.controller ?? 0) === 1 ? 1 : 0) as 0 | 1
      return {
        code: Number(raw.code ?? 0),
        controller: (engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)) as 0 | 1,
        location: this.mapLocationBack(Number(raw.location ?? 0)),
        sequence: Number(raw.sequence ?? 0)
      }
    })
    const min = Math.max(kind === OcgMessageType.SELECT_TRIBUTE ? 1 : 0, Number(m.min ?? 1))
    return {
      kind: kind === OcgMessageType.SELECT_TRIBUTE ? 'TRIBUTE' : 'CARD',
      min,
      max: Math.max(min, Number(m.max ?? min)),
      canCancel: m.can_cancel === true,
      candidates
    }
  }

  private respondPlace(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    msg: unknown,
    place?: { location: number; sequence: number },
    rec: ReplayRecorder | null = null
  ): void {
    const m = msg as { player?: number; field_mask?: number }
    const player = Number(m.player ?? 0)
    let target: { player: number; location: number; sequence: number } | null = null
    if (place) {
      const mask = ~Number(m.field_mask ?? 0) >>> 0
      const ownMzone = mask & 0x7f
      const ownSzone = (mask >>> 8) & 0x3f
      const allowed =
        place.location === CardLocation.MZONE
          ? place.sequence < 7 && (ownMzone & (1 << place.sequence)) !== 0
          : place.location === CardLocation.SZONE
            ? place.sequence < 6 && (ownSzone & (1 << place.sequence)) !== 0
            : false
      if (allowed) target = { player, location: place.location, sequence: place.sequence }
    }
    if (!target) target = this.pickFirstPlace(m as Record<string, unknown>)
    this.respond(
      core,
      handle,
      OcgMessageType.SELECT_PLACE,
      {
        type: OcgResponseType.SELECT_PLACE,
        places: target ? [target] : []
      } as OcgResponse,
      rec
    )
  }

  private readFieldEntries(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1
  ): EngineSelectCandidate[] {
    const out: EngineSelectCandidate[] = []
    const flags = OcgQueryFlags.CODE as OcgQueryFlags
    for (const engineController of [0, 1] as const) {
      const editorController: 0 | 1 =
        engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
      for (const ocgLoc of [OcgLocation.MZONE, OcgLocation.SZONE, OcgLocation.PZONE]) {
        for (let sequence = 0; sequence < MAX_FIELD_SCAN; sequence++) {
          const info = core.duelQuery(handle, {
            flags,
            controller: engineController,
            location: ocgLoc,
            sequence,
            overlaySequence: 0
          })
          if (!info?.code) continue
          out.push({
            code: Number(info.code),
            controller: editorController,
            location: this.mapLocationBack(Number(ocgLoc)),
            sequence
          })
        }
      }
    }
    return out
  }

  private readHandEntries(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1
  ): EngineSelectCandidate[] {
    const out: EngineSelectCandidate[] = []
    const flags = OcgQueryFlags.CODE as OcgQueryFlags
    for (const engineController of [0, 1] as const) {
      const editorController: 0 | 1 =
        engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
      for (let sequence = 0; sequence < 10; sequence++) {
        const info = core.duelQuery(handle, {
          flags,
          controller: engineController,
          location: OcgLocation.HAND,
          sequence,
          overlaySequence: 0
        })
        if (!info?.code) continue
        out.push({
          code: Number(info.code),
          controller: editorController,
          location: CardLocation.HAND,
          sequence
        })
      }
    }
    return out
  }

  private readDeepEntries(
    core: NativeOcgcoreService,
    handle: OcgDuelHandle,
    turnPlayer: 0 | 1
  ): EngineSelectCandidate[] {
    const out: EngineSelectCandidate[] = []
    const flags = OcgQueryFlags.CODE as OcgQueryFlags
    const scans: [OcgLocation, number][] = [
      [OcgLocation.MZONE, 7],
      [OcgLocation.SZONE, 8],
      [OcgLocation.PZONE, 2],
      [OcgLocation.HAND, 10],
      [OcgLocation.GRAVE, 60],
      [OcgLocation.REMOVED, 60],
      [OcgLocation.EXTRA, 15],
      [OcgLocation.DECK, 60]
    ]
    for (const engineController of [0, 1] as const) {
      const editorController: 0 | 1 =
        engineController === 0 ? turnPlayer : ((1 - turnPlayer) as 0 | 1)
      for (const [loc, cap] of scans) {
        for (let sequence = 0; sequence < cap; sequence++) {
          const info = core.duelQuery(handle, {
            flags,
            controller: engineController,
            location: loc,
            sequence,
            overlaySequence: 0
          })
          if (!info?.code) continue
          out.push({
            code: Number(info.code),
            controller: editorController,
            location: this.mapLocationBack(Number(loc)),
            sequence
          })
        }
      }
    }
    return out
  }

  private readIdleMessage(
    messages: ReturnType<NativeOcgcoreService['duelGetMessage']>
  ): IdleMessage | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (Number(msg.type) !== OcgMessageType.SELECT_IDLECMD) continue
      const m = msg as unknown as {
        player: number
        summons: RawCardEntry[]
        special_summons: RawCardEntry[]
        pos_changes: RawCardEntry[]
        monster_sets: RawCardEntry[]
        spell_sets: RawCardEntry[]
        activates: RawCardEntry[]
        to_bp: boolean
        to_ep: boolean
      }
      return {
        player: Number(m.player),
        summon: m.summons ?? [],
        spSummon: m.special_summons ?? [],
        posChange: m.pos_changes ?? [],
        monsterSet: m.monster_sets ?? [],
        spellSet: m.spell_sets ?? [],
        activate: m.activates ?? [],
        toBp: m.to_bp === true,
        toEp: m.to_ep === true
      }
    }
    return null
  }

  private mapLocationBack(raw: number): number {
    switch (raw) {
      case OcgLocation.DECK:
        return CardLocation.DECK
      case OcgLocation.HAND:
        return CardLocation.HAND
      case OcgLocation.MZONE:
        return CardLocation.MZONE
      case OcgLocation.SZONE:
        return CardLocation.SZONE
      case OcgLocation.FZONE:
        return CardLocation.FZONE
      case OcgLocation.GRAVE:
        return CardLocation.GRAVE
      case OcgLocation.REMOVED:
        return CardLocation.REMOVED
      case OcgLocation.EXTRA:
        return CardLocation.EXTRA
      case OcgLocation.PZONE:
        return CardLocation.PZONE
      default:
        return raw
    }
  }
}

export const ruleCheckService = new RuleCheckService()
