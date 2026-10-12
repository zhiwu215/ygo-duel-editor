import {
  createOcgcoreDuelFromSnapshot,
  OcgcoreWrapper,
  OcgcoreDuel,
  OcgcoreDuelOptionFlag,
  OcgcoreDuelRule,
  _OcgcoreConstants
} from 'koishipro-core.js'
import {
  YGOProMessages,
  YGOProMsgDraw,
  YGOProMsgNewTurn,
  YGOProMsgDamage,
  YGOProMsgRecover,
  YGOProMsgRetry
} from 'ygopro-msg-encode'
import {
  EngineDuelInitParams,
  EnginePendingAction,
  EngineTimelineNode,
  EngineBoardState,
  CardLocation,
  DuelPuzzleState,
  CdbCard
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { BoardTracker } from './board-tracker'
import { EngineTimelineManager, decompressDuelSnapshot } from './timeline-manager'
import { getOcgcoreEngine, bindEngineCapabilities } from './ocgcore-engine'
import { isInteractiveQuery, parsePendingAction } from './message-parser'
import { buildResponseForOption } from './response-builder'
import { computeDiff, EngineDiffResult } from './diff-resolver'

const { OcgcoreScriptConstants } = _OcgcoreConstants

const MAX_PROCESS_LOOPS = 10000

const MASTER_RULE_TO_DUEL_RULE: Record<number, OcgcoreDuelRule> = {
  2: OcgcoreDuelRule.Rule2,
  3: OcgcoreDuelRule.MasterRule3,
  4: OcgcoreDuelRule.NewMasterRule,
  5: OcgcoreDuelRule.MasterRule2020
}

export interface SubmitActionResult {
  boardState: EngineBoardState
  pendingAction: EnginePendingAction | null
  node: EngineTimelineNode
  diff: EngineDiffResult
}

export class DuelSession {
  private ocgcore: OcgcoreWrapper | null = null
  private duel: OcgcoreDuel | null = null
  private boardTracker = new BoardTracker()
  private timeline = new EngineTimelineManager()
  private currentPendingMsg: unknown = null
  private currentPendingAction: EnginePendingAction | null = null
  private currentPendingRaw: Uint8Array | null = null
  private accumulatedLogs: string[] = []
  private lastAdvanceRetried = false

  async init(): Promise<void> {
    if (!this.ocgcore) {
      this.ocgcore = await getOcgcoreEngine()
    }
  }

  async startDuel(params: EngineDuelInitParams): Promise<{
    boardState: EngineBoardState
    pendingAction: EnginePendingAction | null
    initialNode: EngineTimelineNode
  }> {
    await this.init()

    if (this.duel && !this.duel.ended) {
      this.duel.endDuel()
    }

    this.timeline.clear()
    this.accumulatedLogs = []
    this.currentPendingMsg = null
    this.currentPendingAction = null
    this.currentPendingRaw = null

    const seed = params.seed || [
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000)
    ]

    this.duel = this.ocgcore!.createDuelV2(seed)

    if (params.puzzleState) {
      this.setupFromPuzzleState(params.puzzleState)
    } else {
      this.setupFromDeckParams(params)
    }

    this.advanceEngine()
    this.verifyWithEngineQuery()

    const snapshot = this.duel.ended ? new Uint8Array(0) : this.duel.snapshot()
    const initialNode = this.timeline.addStep(
      '决斗开局',
      this.boardTracker.getState().turnPlayer,
      this.boardTracker.getState(),
      this.currentPendingAction,
      [...this.accumulatedLogs],
      snapshot,
      undefined,
      this.currentPendingRaw ?? undefined
    )
    this.accumulatedLogs = []

    return {
      boardState: initialNode.boardState,
      pendingAction: this.currentPendingAction,
      initialNode
    }
  }

  private buildStartDuelOptions(
    masterRule: number,
    firstTurnAttack: boolean
  ): {
    rule: OcgcoreDuelRule
    flags: OcgcoreDuelOptionFlag[]
  } {
    const rule = MASTER_RULE_TO_DUEL_RULE[masterRule] ?? OcgcoreDuelRule.MasterRule2020
    const flags = [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
    if (firstTurnAttack) {
      flags.push(OcgcoreDuelOptionFlag.AttackFirstTurn)
    }
    return { rule, flags }
  }

  private newEngineCard(card: {
    code: number
    owner: number
    player: number
    location: number
    sequence: number
    position: number
  }): void {
    this.duel!.newCard(card)
  }

  private setupFromPuzzleState(state: DuelPuzzleState): void {
    const p0Lp = Number(state.players[0]?.lp ?? 8000)
    const p1Lp = Number(state.players[1]?.lp ?? 8000)
    this.boardTracker.reset(p0Lp, p1Lp)

    this.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: 0, drawCount: 1 })
    this.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: 0, drawCount: 1 })

    const fieldCards = state.cards.filter((c) => c.code > 0)
    const handCounts: [number, number] = [0, 0]

    for (const card of fieldCards) {
      if (
        card.location === CardLocation.DECK ||
        card.location === CardLocation.EXTRA ||
        card.location === CardLocation.MZONE
      ) {
        continue
      }
      if (card.location === CardLocation.HAND) {
        this.newEngineCard({
          code: card.code,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: card.location,
          sequence: handCounts[card.controller]++,
          position: card.position
        })
      } else {
        this.newEngineCard({
          code: card.code,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: card.location,
          sequence: card.sequence,
          position: card.position
        })
      }
    }

    for (const location of [CardLocation.DECK, CardLocation.EXTRA]) {
      const pile = fieldCards
        .filter((c) => c.location === location)
        .sort((a, b) => a.controller - b.controller || b.sequence - a.sequence)
      const pileIndex: [number, number] = [0, 0]
      for (const card of pile) {
        this.newEngineCard({
          code: card.code,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: card.location,
          sequence: pileIndex[card.controller]++,
          position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
        })
      }
    }

    for (const card of fieldCards) {
      if (card.location !== CardLocation.MZONE || !card.overlayMaterials?.length) continue
      for (const matCode of card.overlayMaterials) {
        if (matCode <= 0) continue
        this.newEngineCard({
          code: matCode,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: OcgcoreScriptConstants.LOCATION_OVERLAY,
          sequence: card.sequence,
          position: OcgcoreScriptConstants.POS_FACEUP_ATTACK
        })
      }
    }

    this.boardTracker.initializeFromCards(fieldCards)

    const { rule, flags } = this.buildStartDuelOptions(
      state.masterRule,
      Boolean(state.firstTurnAttack)
    )
    this.duel!.startDuel({ rule, flags })
    this.accumulatedLogs.push(`决斗开始！(MR${state.masterRule})`)
  }

  private setupFromDeckParams(params: EngineDuelInitParams): void {
    const p0Lp = params.p0Lp ?? 8000
    const p1Lp = params.p1Lp ?? 8000
    this.boardTracker.reset(p0Lp, p1Lp)

    const DEFAULT_DECK = [
      89631139, 89631139, 89631139, 46986414, 46986414, 46986414, 70781052, 70781052, 70781052,
      26082229, 26082229, 72302403, 72302403, 72302403, 53129443, 44095762, 44095762, 44095762,
      83764718, 83764718, 83764718, 6368038, 6368038, 6368038, 12580477, 12580477, 12580477,
      74677422, 74677422, 74677422, 4064256, 4064256, 4064256, 89943723, 89943723, 89943723,
      10000000, 10000010, 10000020
    ]

    const p0Deck = params.p0Deck && params.p0Deck.length > 0 ? params.p0Deck : DEFAULT_DECK
    const p1Deck = params.p1Deck && params.p1Deck.length > 0 ? params.p1Deck : DEFAULT_DECK
    if (!params.p0Deck?.length || !params.p1Deck?.length) {
      this.accumulatedLogs.push('未提供卡组，使用默认测试卡组')
    }
    const p0Extra = params.p0Extra || []
    const p1Extra = params.p1Extra || []

    const p0StartHand = params.p0StartHand ?? (p0Deck.length > 0 ? 5 : 0)
    const p1StartHand = params.p1StartHand ?? (p1Deck.length > 0 ? 5 : 0)

    this.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: p0StartHand, drawCount: 1 })
    this.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: p1StartHand, drawCount: 1 })

    for (const code of [...p0Deck].reverse()) {
      this.newEngineCard({
        code,
        owner: 0,
        player: 0,
        location: OcgcoreScriptConstants.LOCATION_DECK,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
    for (const code of p0Extra) {
      this.newEngineCard({
        code,
        owner: 0,
        player: 0,
        location: OcgcoreScriptConstants.LOCATION_EXTRA,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
    for (const code of [...p1Deck].reverse()) {
      this.newEngineCard({
        code,
        owner: 1,
        player: 1,
        location: OcgcoreScriptConstants.LOCATION_DECK,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
    for (const code of p1Extra) {
      this.newEngineCard({
        code,
        owner: 1,
        player: 1,
        location: OcgcoreScriptConstants.LOCATION_EXTRA,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }

    this.boardTracker.initializeDecks(p0Deck, p0Extra, p1Deck, p1Extra)

    this.duel!.startDuel({
      rule: OcgcoreDuelRule.MasterRule2020,
      flags: [OcgcoreDuelOptionFlag.PseudoShuffle]
    })
    this.accumulatedLogs.push('决斗开始！')
  }

  submitAction(optionId: string, payload?: unknown): SubmitActionResult {
    if (!this.duel || this.duel.ended) {
      throw new Error('当前没有进行中的对局。')
    }
    if (
      !this.currentPendingAction ||
      !this.currentPendingMsg ||
      this.currentPendingAction.kind === 'END' ||
      this.currentPendingAction.kind === 'WAITING'
    ) {
      throw new Error('引擎当前没有等待响应的操作。')
    }

    const option = this.currentPendingAction.options.find((o) => o.id === optionId)
    if (!option) {
      throw new Error(`选项 ${optionId} 不存在，请刷新操作列表。`)
    }

    const { response, logText } = buildResponseForOption(this.currentPendingMsg, option, payload)

    const beforeBoard = this.boardTracker.getState()

    this.duel.setResponse(response)
    this.advanceEngine()
    this.verifyWithEngineQuery()

    if (this.lastAdvanceRetried) {
      this.accumulatedLogs = []
      throw new Error('引擎拒绝了该操作 (RETRY)，请选择其他合法操作。')
    }

    this.accumulatedLogs.push(logText)

    const snapshot = this.duel.ended ? new Uint8Array(0) : this.duel.snapshot()
    const boardState = this.boardTracker.getState()
    const diff = computeDiff(beforeBoard, boardState)

    const node = this.timeline.addStep(
      logText,
      this.currentPendingAction.player,
      boardState,
      this.currentPendingAction,
      [...this.accumulatedLogs],
      snapshot,
      response,
      this.currentPendingRaw ?? undefined
    )
    this.accumulatedLogs = []

    return {
      boardState,
      pendingAction: this.currentPendingAction,
      node,
      diff
    }
  }

  async jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    pendingAction: EnginePendingAction | null
    currentStepId: string
  }> {
    const record = this.timeline.getStep(stepId)
    if (!record) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }
    if (!record.snapshot || record.snapshot.length === 0) {
      throw new Error('该步骤没有可用快照（对局已结束）。')
    }

    if (this.duel && !this.duel.ended) {
      this.duel.endDuel()
    }

    const restored = await createOcgcoreDuelFromSnapshot(decompressDuelSnapshot(record.snapshot))
    await bindEngineCapabilities(restored.ocgcoreWrapper)

    this.duel = restored
    this.boardTracker.setState(record.node.boardState)
    this.timeline.setCurrentStepId(stepId)

    this.currentPendingMsg = null
    this.currentPendingAction = record.node.pendingAction
    this.currentPendingRaw = record.pendingMsgRaw ?? null
    if (this.currentPendingRaw && this.currentPendingRaw.length > 0) {
      try {
        const msgs = YGOProMessages.getInstancesFromPayload(this.currentPendingRaw)
        for (const msg of msgs) {
          if (isInteractiveQuery(msg)) {
            this.currentPendingMsg = msg
            this.currentPendingAction = parsePendingAction(
              msg,
              (controller, location, sequence, code) =>
                this.resolveTrackerCard(controller, location, sequence, code)
            )
          }
        }
      } catch (err) {
        console.error('[duel-session] 恢复询问消息失败:', err)
      }
    }

    return {
      boardState: record.node.boardState,
      pendingAction: this.currentPendingAction,
      currentStepId: stepId
    }
  }

  private resolveTrackerCard(
    controller: number,
    location: number,
    sequence: number,
    code?: number
  ): { instanceId: string; card?: CdbCard } | undefined {
    const found = this.boardTracker.findCard(controller, location, sequence, code)
    if (!found) return undefined
    return { instanceId: found.instanceId, card: found.card }
  }

  private advanceEngine(): void {
    if (!this.duel) return

    this.lastAdvanceRetried = false
    let loops = 0
    while (true) {
      loops++
      if (loops > MAX_PROCESS_LOOPS) {
        throw new Error('引擎推进步数超出上限，可能陷入死循环。')
      }

      const res = this.duel.process()
      const msgs = res.messages ?? []

      if (msgs.length > 0) {
        this.boardTracker.applyMessages(msgs)
        this.collectLogs(msgs)

        for (const msg of msgs) {
          if (isInteractiveQuery(msg)) {
            this.currentPendingMsg = msg
            this.currentPendingRaw = res.raw
            this.currentPendingAction = parsePendingAction(
              msg,
              (controller, location, sequence, code) =>
                this.resolveTrackerCard(controller, location, sequence, code)
            )
          }
        }

        if (msgs.some((m) => m instanceof YGOProMsgRetry)) {
          this.lastAdvanceRetried = true
          this.accumulatedLogs.push('引擎拒绝了上一次响应 (RETRY)。')
          break
        }
      }

      if (res.status === 1) {
        break
      }
      if (res.status === 2 || this.duel.ended) {
        this.currentPendingMsg = null
        this.currentPendingRaw = null
        this.currentPendingAction = {
          kind: 'END',
          player: 0,
          title: '决斗已结束',
          options: []
        }
        break
      }
    }
  }

  private verifyWithEngineQuery(): void {
    if (!this.duel || this.duel.ended) return
    try {
      const info = this.duel.queryFieldInfo()
      const field = info.field
      if (!field) return
      const tracked = this.boardTracker.snapshotCounts()
      for (let i = 0; i < 2; i++) {
        const fp = field.players[i]
        const tp = tracked[i]
        if (!fp || !tp) continue
        const mismatches: string[] = []
        if (Number(fp.lp) !== tp.lp) mismatches.push(`LP 引擎=${fp.lp} 镜像=${tp.lp}`)
        if (Number(fp.handCount) !== tp.handCount)
          mismatches.push(`手牌 引擎=${fp.handCount} 镜像=${tp.handCount}`)
        if (Number(fp.deckCount) !== tp.deckCount)
          mismatches.push(`卡组 引擎=${fp.deckCount} 镜像=${tp.deckCount}`)
        if (Number(fp.extraCount) !== tp.extraCount)
          mismatches.push(`额外 引擎=${fp.extraCount} 镜像=${tp.extraCount}`)
        if (Number(fp.graveCount) !== tp.graveCount)
          mismatches.push(`墓地 引擎=${fp.graveCount} 镜像=${tp.graveCount}`)
        if (Number(fp.removedCount) !== tp.removedCount)
          mismatches.push(`除外 引擎=${fp.removedCount} 镜像=${tp.removedCount}`)
        const mzoneOccupied = fp.mzone.filter((z) => z.occupied).length
        if (mzoneOccupied !== tp.mzoneCount)
          mismatches.push(`怪兽区 引擎=${mzoneOccupied} 镜像=${tp.mzoneCount}`)
        if (mismatches.length > 0) {
          console.warn(
            `[duel-session] 场面镜像与引擎不一致 (player ${i}): ${mismatches.join('; ')}`
          )
        }
      }
    } catch (err) {
      console.warn('[duel-session] queryFieldInfo 校验失败:', err)
    }
  }

  private collectLogs(msgs: unknown[]): void {
    for (const msg of msgs) {
      if (msg instanceof YGOProMsgDraw) {
        const names = msg.cards
          .map((c: number) => cdbService.getCardById(c)?.name || String(c))
          .join(', ')
        this.accumulatedLogs.push(`Player ${msg.player} 抽了 ${msg.count} 张卡: [${names}]`)
      } else if (msg instanceof YGOProMsgNewTurn) {
        this.accumulatedLogs.push(`--- 回合推进 (Player ${msg.player} 回合) ---`)
      } else if (msg instanceof YGOProMsgDamage) {
        this.accumulatedLogs.push(`Player ${msg.player} 受到 ${msg.value} 点伤害！`)
      } else if (msg instanceof YGOProMsgRecover) {
        this.accumulatedLogs.push(`Player ${msg.player} 恢复了 ${msg.value} 点 LP`)
      }
    }
  }

  getTimeline(): EngineTimelineNode[] {
    return this.timeline.getAllNodes()
  }

  getBoardState(): EngineBoardState {
    return this.boardTracker.getState()
  }

  getPendingAction(): EnginePendingAction | null {
    return this.currentPendingAction
  }

  getAllTimelineResponses(): Uint8Array[] {
    return this.timeline
      .getHistoryPath()
      .map((n) => this.timeline.getStep(n.id)?.responseToNext)
      .filter((r): r is Uint8Array => Boolean(r))
  }
}

export const duelSession = new DuelSession()
