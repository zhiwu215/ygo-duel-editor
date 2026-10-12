import {
  createOcgcoreDuelFromSnapshot,
  OcgcoreWrapper,
  OcgcoreDuel,
  _OcgcoreConstants
} from 'koishipro-core.js'
import {
  YGOProMessages,
  YGOProMsgDraw,
  YGOProMsgNewTurn,
  YGOProMsgDamage,
  YGOProMsgRecover
} from 'ygopro-msg-encode'
import {
  EngineDuelInitParams,
  EnginePendingAction,
  EngineTimelineNode,
  EngineBoardState,
  CardLocation,
  DuelPuzzleState
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { BoardTracker } from './board-tracker'
import { EngineTimelineManager } from './timeline-manager'
import { getOcgcoreEngine } from './ocgcore-engine'
import { isInteractiveQuery, parsePendingAction } from './message-parser'
import { buildResponseForOption } from './response-builder'
import { computeDiff, EngineDiffResult } from './diff-resolver'

const { OcgcoreScriptConstants } = _OcgcoreConstants

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
  private accumulatedLogs: string[] = []

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

    const snapshot = this.duel.snapshot()
    const initialNode = this.timeline.addStep(
      '决斗开局',
      this.boardTracker.getState().turnPlayer,
      this.boardTracker.getState(),
      this.currentPendingAction,
      [...this.accumulatedLogs],
      snapshot
    )
    this.accumulatedLogs = []

    return {
      boardState: initialNode.boardState,
      pendingAction: this.currentPendingAction,
      initialNode
    }
  }

  private setupFromPuzzleState(state: DuelPuzzleState): void {
    const p0Lp = Number(state.players[0]?.lp ?? 8000)
    const p1Lp = Number(state.players[1]?.lp ?? 8000)
    this.boardTracker.reset(p0Lp, p1Lp)

    this.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: 0, drawCount: 1 })
    this.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: 0, drawCount: 1 })

    const handCounts: [number, number] = [0, 0]
    for (const card of state.cards) {
      if (card.code > 0) {
        const seq =
          card.location === CardLocation.HAND ? handCounts[card.controller]++ : card.sequence
        this.duel!.newCard({
          code: card.code,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: card.location,
          sequence: seq,
          position: card.position
        })
      }
    }

    this.boardTracker.initializeFromCards(state.cards)

    let flags = 0
    if (state.firstTurnAttack) flags |= 0x20
    if (state.masterRule >= 4) flags |= 0x100
    this.duel!.startDuel(flags)
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
    const p0Extra = params.p0Extra || []
    const p1Extra = params.p1Extra || []

    const p0StartHand = params.p0StartHand ?? (p0Deck.length > 0 ? 5 : 0)
    const p1StartHand = params.p1StartHand ?? (p1Deck.length > 0 ? 5 : 0)

    this.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: p0StartHand, drawCount: 1 })
    this.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: p1StartHand, drawCount: 1 })

    const p0Cards = [...p0Deck].reverse()
    const p1Cards = [...p1Deck].reverse()

    for (const code of p0Cards) {
      this.duel!.newCard({
        code,
        owner: 0,
        player: 0,
        location: OcgcoreScriptConstants.LOCATION_DECK,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }

    for (const code of p0Extra) {
      this.duel!.newCard({
        code,
        owner: 0,
        player: 0,
        location: OcgcoreScriptConstants.LOCATION_EXTRA,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }

    for (const code of p1Cards) {
      this.duel!.newCard({
        code,
        owner: 1,
        player: 1,
        location: OcgcoreScriptConstants.LOCATION_DECK,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }

    for (const code of p1Extra) {
      this.duel!.newCard({
        code,
        owner: 1,
        player: 1,
        location: OcgcoreScriptConstants.LOCATION_EXTRA,
        sequence: 0,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }

    this.boardTracker.initializeDecks(p0Deck, p0Extra, p1Deck, p1Extra)

    this.duel!.startDuel(0)
    this.accumulatedLogs.push('决斗开始！')
  }

  submitAction(optionId: string, payload?: unknown): SubmitActionResult {
    if (!this.duel || !this.currentPendingAction || !this.currentPendingMsg) {
      throw new Error('No pending action or active duel.')
    }

    const option = this.currentPendingAction.options.find((o) => o.id === optionId)
    if (!option) {
      throw new Error(`Option with id ${optionId} not found.`)
    }

    const { response, logText } = buildResponseForOption(this.currentPendingMsg, option, payload)
    this.accumulatedLogs.push(logText)

    const beforeBoard = structuredClone(this.boardTracker.getState())

    this.duel.setResponse(response)
    this.advanceEngine()

    const snapshot = this.duel.snapshot()
    const boardState = this.boardTracker.getState()
    const diff = computeDiff(beforeBoard, boardState)

    const node = this.timeline.addStep(
      logText,
      this.currentPendingAction?.player ?? boardState.turnPlayer,
      boardState,
      this.currentPendingAction,
      [...this.accumulatedLogs],
      snapshot,
      response
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
      throw new Error(`Step ${stepId} not found.`)
    }

    if (this.duel && !this.duel.ended) {
      this.duel.endDuel()
    }

    this.duel = await createOcgcoreDuelFromSnapshot(record.snapshot)
    this.boardTracker.setState(record.node.boardState)
    this.timeline.setCurrentStepId(stepId)
    this.currentPendingAction = record.node.pendingAction

    return {
      boardState: record.node.boardState,
      pendingAction: record.node.pendingAction,
      currentStepId: stepId
    }
  }

  private advanceEngine(): void {
    if (!this.duel) return

    while (true) {
      const res = this.duel.process({ noParse: true })
      if (res.raw.length > 0) {
        const msgs = YGOProMessages.getInstancesFromPayload(res.raw)
        this.boardTracker.applyMessages(msgs)
        this.collectLogs(msgs)

        for (const msg of msgs) {
          if (isInteractiveQuery(msg)) {
            this.currentPendingMsg = msg
            this.currentPendingAction = parsePendingAction(msg)
          }
        }
      }

      if (res.status === 1) {
        break
      }
      if (res.status === 2 || this.duel.ended) {
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

  private collectLogs(msgs: unknown[]): void {
    for (const msg of msgs) {
      if (msg instanceof YGOProMsgDraw) {
        const names = msg.cards.map((c: number) => cdbService.getCardById(c)?.name || c).join(', ')
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
