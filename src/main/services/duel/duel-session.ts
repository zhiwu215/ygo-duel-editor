import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineCard,
  EngineCardRef,
  EngineCardEditResult,
  EngineProvenance,
  CardLocation,
  EngineSessionDoc,
  EngineSessionImportPayload,
  DuelOperation,
  ENGINE_SESSION_DOC_VERSION,
  encodeSessionOp,
  decodeSessionOp,
  parseEngineSessionDoc
} from '@shared/index'
import {
  Answer,
  EngineInjectResult,
  EngineRequest,
  EngineSubmitAnswerResult,
  InjectCommand,
  TimingPolicy,
  normalizeTimingPolicy
} from '@shared/engine/protocol'
import { createDuelFromYrp } from 'koishipro-core.js'
import { getOcgcoreEngine } from './ocgcore-engine'
import { computeDiff } from './diff-resolver'
import { encodeAnswer, describeAnswer } from './answer-encoder'
import { describeInject, executeInject, injectCardName, verifyInject } from './injector'
import { createSessionState } from './session-state'
import { setupFromPuzzleState, setupFromDeckParams } from './session-setup'
import {
  buildReplayTimeline,
  parseYrpReplay,
  setupReplayDuel,
  type EngineReplayStartPayload
} from './replay-session'
import {
  alignProvenance,
  cardSignature,
  initializeProvenance,
  nodeIdForOp,
  trackAdvance,
  trackInject
} from './provenance-tracker'
import { advanceEngine, isAutoFinishableUnselect } from './engine-pump'
import {
  replaceCard as replaceCardOp,
  removeCard as removeCardOp,
  type CardEditorDeps
} from './card-editor'

interface SessionSnapshot {
  seed: number[]
  initParams: EngineDuelInitParams | null
  ops: DuelOperation[]
  timingPolicy: TimingPolicy
  timeline: EngineTimelineNode[]
  currentStepId: string | null
  requestSeq: number
}

const MAX_AUTO_FINISH_LOOPS = 8

export class DuelSession {
  private state = createSessionState()

  setTimingPolicy(policy: TimingPolicy): TimingPolicy {
    this.state.timingPolicy = normalizeTimingPolicy(policy)
    return { ...this.state.timingPolicy }
  }

  async init(): Promise<void> {
    if (!this.state.ocgcore) {
      this.state.ocgcore = await getOcgcoreEngine()
    }
  }

  private disposeDuel(): void {
    const state = this.state
    if (state.duel) {
      state.duel.endDuel()
      state.duel = null
    }
    if (state.ownedWrapper) {
      state.ownedWrapper.finalize()
      state.ownedWrapper = null
    }
  }

  private readBoard(): EngineBoardState {
    const state = this.state
    if (!state.duel) {
      throw new Error('当前没有可查询的对局。')
    }
    return state.fieldReader.readBoard(state.duel)
  }

  private createDuelFromInit(): Uint8Array[] {
    const state = this.state
    if (state.replay) {
      const { duel } = createDuelFromYrp(state.ocgcore!, state.replay.bytes)
      state.duel = duel
      return advanceEngine(state)
    }
    if (!state.initParams) {
      throw new Error('引擎会话尚未初始化。')
    }
    state.duel = state.ocgcore!.createDuelV2(state.seed)
    if (state.initParams.puzzleState) {
      setupFromPuzzleState(state, state.initParams.puzzleState)
    } else {
      setupFromDeckParams(state, state.initParams)
    }
    return advanceEngine(state)
  }

  private replayTo(stepId: string, freshIdentity = false): void {
    const state = this.state
    const target = state.timeline.getStep(stepId)
    if (!target) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.disposeDuel()
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.currentPendingMsg = null
    state.currentPendingRequest = null
    state.lastHintDesc = undefined
    state.replaying = true

    try {
      this.createDuelFromInit()
      initializeProvenance(state, this.readBoard())

      for (let index = 0; index <= target.node.opIndex; index++) {
        const op = state.ops[index]
        if (!op) {
          throw new Error(`操作流缺少第 ${index} 条记录，无法重放。`)
        }
        if (op.type === 'inject') {
          if (op.removed) continue
          const before = this.readBoard()
          executeInject(state.duel!, op.command, before)
          const after = this.readBoard()
          trackInject(state, before, after, index, op.command)
          continue
        }
        for (const response of op.responses) {
          const before = this.readBoard()
          state.duel!.setResponse(response)
          advanceEngine(state)
          if (state.lastAdvanceRetried) {
            throw new Error(`重放第 ${index + 1} 条操作时引擎拒绝了历史响应。`)
          }
          trackAdvance(state, before, this.readBoard(), index)
        }
      }
    } finally {
      state.replaying = false
    }

    state.accumulatedLogs = []
    state.accumulatedEvents = []
    try {
      const replayBoard = state.fieldReader.getState()
      state.sequenceProvenance.clear()
      for (const card of replayBoard.allCards) {
        const record = state.provenance.get(card.instanceId)
        if (record) {
          state.sequenceProvenance.set(cardSignature(card), record)
        }
      }
    } catch {
      state.sequenceProvenance.clear()
    }
    if (!freshIdentity) {
      state.fieldReader.restoreIdentity(target.node.boardState)
    }
    state.timeline.setCurrentStepId(stepId)
  }

  private truncateToCurrentStep(): void {
    const state = this.state
    const current = state.timeline.getCurrentStep()
    if (!current) {
      state.ops.length = 0
      return
    }
    const limit = current.node.opIndex + 1
    if (state.ops.length > limit) state.ops.length = limit
    state.timeline.retainHistory(current.node.id)
  }

  private resetSessionState(): void {
    const state = this.state
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.currentPendingMsg = null
    state.currentPendingRequest = null
    state.requestSeq = 1
    state.lastHintDesc = undefined
    state.replaying = false
    state.replay = null
    state.recordingMessages = null
    state.provenance.clear()
    state.sequenceProvenance.clear()
    state.drawCounts = [0, 0]
    state.deckDirty = [false, false]
    state.lastDrawEvents = []
    state.lastDeckShuffles = []
  }

  private captureSessionState(): SessionSnapshot {
    const state = this.state
    return {
      seed: [...state.seed],
      initParams: state.initParams ? structuredClone(state.initParams) : null,
      ops: structuredClone(state.ops),
      timingPolicy: { ...state.timingPolicy },
      timeline: state.timeline.getAllNodes().map((node) => structuredClone(node)),
      currentStepId: state.timeline.getCurrentStep()?.node.id ?? null,
      requestSeq: state.requestSeq
    }
  }

  private restoreSessionState(snapshot: SessionSnapshot): void {
    const state = this.state
    this.disposeDuel()
    state.timeline.clear()
    this.resetSessionState()
    state.seed = [...snapshot.seed]
    state.initParams = snapshot.initParams
    state.ops = snapshot.ops
    state.timingPolicy = { ...snapshot.timingPolicy }
    state.requestSeq = snapshot.requestSeq
    if (!snapshot.initParams || !snapshot.currentStepId) return
    state.timeline.restore(snapshot.timeline, snapshot.currentStepId)
    try {
      this.replayTo(snapshot.currentStepId)
    } catch (err) {
      console.error('[duel-session] 恢复导入前的对局失败:', err)
    }
  }

  exportSessionDoc(): EngineSessionDoc {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出对局剧本。')
    }
    const current = state.timeline.getCurrentStep()
    if (!state.initParams || !current) {
      throw new Error('引擎尚未启动，无法导出对局剧本。')
    }
    return {
      version: ENGINE_SESSION_DOC_VERSION,
      seed: [...state.seed],
      initParams: structuredClone(state.initParams),
      ops: state.ops.map((op) => encodeSessionOp(op)),
      timeline: state.timeline.getAllNodes().map((node) => structuredClone(node)),
      currentStepId: current.node.id,
      timingPolicy: { ...state.timingPolicy }
    }
  }

  async importSessionDoc(doc: EngineSessionDoc): Promise<EngineSessionImportPayload> {
    const state = this.state
    let parsed: EngineSessionDoc
    let ops: DuelOperation[]
    try {
      parsed = parseEngineSessionDoc(doc)
      ops = parsed.ops.map((op) => decodeSessionOp(op))
    } catch (err) {
      throw new Error(`导入对局剧本失败：${err instanceof Error ? err.message : String(err)}`)
    }

    await this.init()
    const previous = this.captureSessionState()

    try {
      this.resetSessionState()
      state.seed = [...parsed.seed]
      state.initParams = structuredClone(parsed.initParams)
      state.ops = ops
      state.timingPolicy = { ...parsed.timingPolicy }
      state.timeline.restore(parsed.timeline, parsed.currentStepId)
      this.replayTo(parsed.currentStepId)

      const boardState = this.readBoard()
      alignProvenance(state, boardState)
      const node = state.timeline.getStep(parsed.currentStepId)?.node
      if (!node) throw new Error('找不到剧本指定的当前步骤。')
      node.boardState = boardState
      node.pendingRequest = state.currentPendingRequest

      return {
        boardState,
        pendingRequest: state.currentPendingRequest,
        timeline: state.timeline.getAllNodes(),
        currentStepId: parsed.currentStepId
      }
    } catch (err) {
      this.restoreSessionState(previous)
      throw new Error(`导入对局剧本失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async startDuel(params: EngineDuelInitParams): Promise<{
    boardState: EngineBoardState
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }> {
    const state = this.state
    await this.init()

    this.disposeDuel()

    state.timeline.clear()
    state.ops = []
    this.resetSessionState()

    state.seed = params.seed || [
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000)
    ]
    state.initParams = params

    const initialAutoResponses = this.createDuelFromInit()
    if (initialAutoResponses.length > 0) {
      state.ops.push({ type: 'auto', responses: initialAutoResponses })
    }

    const initialBoard = this.readBoard()
    initializeProvenance(state, initialBoard)
    const initialNode = state.timeline.addStep(
      '决斗开局',
      initialBoard.turnPlayer,
      initialBoard,
      state.currentPendingRequest,
      [...state.accumulatedLogs],
      [...state.accumulatedEvents],
      state.ops.length - 1
    )
    state.accumulatedLogs = []
    state.accumulatedEvents = []

    return {
      boardState: initialNode.boardState,
      pendingRequest: state.currentPendingRequest,
      initialNode
    }
  }

  async startReplay(bytes: Uint8Array, fileName: string): Promise<EngineReplayStartPayload> {
    const state = this.state
    await this.init()

    const { yrp, bytes: yrpBytes } = parseYrpReplay(bytes, fileName)
    const previous = this.captureSessionState()

    try {
      this.disposeDuel()
      state.timeline.clear()
      this.resetSessionState()
      setupReplayDuel(state, yrp, yrpBytes, fileName)
      const warning = buildReplayTimeline(state, yrp)
      const currentStepId = state.timeline.getCurrentStep()?.node.id
      if (!currentStepId) {
        throw new Error('回放时间线构建失败。')
      }
      return {
        info: {
          fileName,
          hostName: yrp.hostName,
          clientName: yrp.clientName,
          isSingleMode: yrp.isSingleMode,
          totalSteps: yrp.responses.length,
          ...(warning ? { warning } : {})
        },
        boardState: this.readBoard(),
        timeline: state.timeline.getAllNodes(),
        currentStepId
      }
    } catch (err) {
      this.restoreSessionState(previous)
      throw err
    }
  }

  exitReplay(): void {
    const state = this.state
    this.disposeDuel()
    state.timeline.clear()
    this.resetSessionState()
  }

  submitAnswer(answer: Answer): EngineSubmitAnswerResult {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，请先退出回放。')
    }
    if (!state.duel || state.duel.ended) {
      throw new Error('当前没有进行中的对局。')
    }
    if (!state.currentPendingMsg || !state.currentPendingRequest) {
      throw new Error('引擎当前没有等待响应的操作。')
    }

    const requestMsg = state.currentPendingMsg
    const actingPlayer = state.currentPendingRequest.player
    const response = encodeAnswer(requestMsg, answer)
    const logText = describeAnswer(requestMsg, answer)

    const baseOpIndex = (state.timeline.getCurrentStep()?.node.opIndex ?? -1) + 1
    const beforeBoard = this.readBoard()
    state.duel.setResponse(response)
    const autoResponses = advanceEngine(state)

    if (state.lastAdvanceRetried) {
      state.accumulatedLogs = []
      state.accumulatedEvents = []
      return { retry: true, pendingRequest: state.currentPendingRequest }
    }
    trackAdvance(state, beforeBoard, this.readBoard(), baseOpIndex)

    for (let loops = 0; loops < MAX_AUTO_FINISH_LOOPS; loops++) {
      if (!isAutoFinishableUnselect(state, requestMsg)) break
      const autoResponse = encodeAnswer(state.currentPendingMsg, { kind: 'unselect', card: null })
      const beforeAuto = this.readBoard()
      state.duel.setResponse(autoResponse)
      autoResponses.push(autoResponse, ...advanceEngine(state))
      if (state.lastAdvanceRetried) break
      trackAdvance(state, beforeAuto, this.readBoard(), baseOpIndex + 1)
    }

    state.accumulatedLogs.push(logText)

    this.truncateToCurrentStep()
    const boardState = this.readBoard()
    const diff = computeDiff(beforeBoard, boardState)
    const answerOpIndex = state.ops.length
    state.ops.push({ type: 'answer', nodeId: '', responses: [response] })
    if (autoResponses.length > 0) {
      state.ops.push({ type: 'auto', responses: autoResponses })
    }

    const shuffledHands = state.accumulatedEvents.some((event) => event.kind === 'shuffle-hand')
    const node = state.timeline.addStep(
      shuffledHands ? `${logText}（手牌切洗）` : logText,
      actingPlayer,
      boardState,
      state.currentPendingRequest,
      [...state.accumulatedLogs],
      [...state.accumulatedEvents],
      state.ops.length - 1
    )
    const answerOp = state.ops[answerOpIndex]
    if (answerOp?.type === 'answer') answerOp.nodeId = node.id
    state.requestSeq += 1
    state.accumulatedLogs = []
    state.accumulatedEvents = []

    return {
      retry: false,
      boardState,
      pendingRequest: state.currentPendingRequest,
      node,
      diff
    }
  }

  inject(command: InjectCommand): EngineInjectResult {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，请先退出回放。')
    }
    if (!state.duel || state.duel.ended) {
      throw new Error('当前没有进行中的对局，无法执行剧情安排。')
    }

    const before = this.readBoard()
    this.truncateToCurrentStep()
    const outcome = executeInject(state.duel, command, before)
    const boardState = this.readBoard()
    const warning = outcome.warning ?? verifyInject(command, before, boardState)

    const opIndex = state.ops.length
    trackInject(state, before, boardState, opIndex, command)
    const title = describeInject(command, outcome.label, injectCardName(command))
    const logs = [`[剧情安排] ${outcome.label}`]
    if (warning) logs.push(warning)

    const node = state.timeline.addStep(
      title,
      command.player,
      boardState,
      state.currentPendingRequest,
      logs,
      [...state.accumulatedEvents],
      opIndex
    )
    state.accumulatedEvents = []
    state.ops.push({ type: 'inject', command })

    return { boardState, node, warning }
  }

  async jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }> {
    const state = this.state
    if (!state.timeline.getStep(stepId)) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.replayTo(stepId)
    if (state.replay) {
      state.currentPendingMsg = null
      state.currentPendingRequest = null
    }

    const boardState = this.readBoard()
    alignProvenance(state, boardState)
    const node = state.timeline.getStep(stepId)?.node
    if (node) {
      node.boardState = boardState
      node.pendingRequest = state.currentPendingRequest
    }

    return {
      boardState,
      currentStepId: stepId
    }
  }

  private resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null {
    const state = this.state
    let board: EngineBoardState
    try {
      board = this.getBoardState()
    } catch {
      return null
    }
    alignProvenance(state, board)
    const exact = ref.instanceId
      ? board.allCards.find((card) => card.instanceId === ref.instanceId)
      : undefined
    if (exact) return { instanceId: exact.instanceId, card: exact }

    const location = ref.location === CardLocation.FZONE ? CardLocation.SZONE : ref.location
    const sequence = ref.location === CardLocation.FZONE ? 5 : ref.sequence
    const positional = board.allCards.find(
      (card) =>
        card.controller === ref.controller &&
        card.location === location &&
        card.sequence === sequence
    )
    if (positional) return { instanceId: positional.instanceId, card: positional }

    const loose = board.allCards.find(
      (card) =>
        card.controller === ref.controller &&
        card.sequence === sequence &&
        ((card.location & location) !== 0 || (location & card.location) !== 0)
    )
    return loose ? { instanceId: loose.instanceId, card: loose } : null
  }

  getProvenance(ref: EngineCardRef): EngineProvenance {
    const state = this.state
    const resolved = this.resolveCard(ref)
    if (!resolved) return { kind: 'unknown' }
    const record = state.provenance.get(resolved.instanceId)
    if (!record) return { kind: 'unknown' }
    if (record.provenance.kind === 'inject' || record.provenance.kind === 'drawn') {
      return {
        ...record.provenance,
        nodeId: nodeIdForOp(state, record.provenance.opIndex)
      }
    }
    return record.provenance
  }

  replaceCard(ref: EngineCardRef, newCode: number): EngineCardEditResult {
    if (this.state.replay) {
      throw new Error('回放模式为只读，请先退出回放。')
    }
    return replaceCardOp(this.state, this.cardEditorDeps(), ref, newCode)
  }

  removeCard(ref: EngineCardRef): EngineCardEditResult {
    if (this.state.replay) {
      throw new Error('回放模式为只读，请先退出回放。')
    }
    return removeCardOp(this.state, this.cardEditorDeps(), ref)
  }

  private cardEditorDeps(): CardEditorDeps {
    return {
      resolveCard: (ref) => this.resolveCard(ref),
      readBoard: () => this.readBoard(),
      truncateToCurrentStep: () => this.truncateToCurrentStep(),
      replayTo: (stepId, freshIdentity) => this.replayTo(stepId, freshIdentity)
    }
  }

  getTimeline(): EngineTimelineNode[] {
    return this.state.timeline.getAllNodes()
  }

  getBoardState(): EngineBoardState {
    const state = this.state
    if (state.duel && !state.duel.ended) {
      return this.readBoard()
    }
    return state.fieldReader.getState()
  }

  getPendingRequest(): EngineRequest | null {
    return this.state.currentPendingRequest
  }

  recordMessageStream(): { messages: Uint8Array[]; responses: Uint8Array[] } {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出 MDPro3 回放。')
    }
    const current = state.timeline.getCurrentStep()
    if (!state.initParams || !current) {
      throw new Error('引擎尚未启动，无法导出 MDPro3 回放。')
    }

    state.recordingMessages = []
    let messages: Uint8Array[]
    try {
      this.replayTo(current.node.id)
      messages = state.recordingMessages ?? []
    } finally {
      state.recordingMessages = null
    }
    if (messages.length === 0) {
      throw new Error('没有录制到任何引擎消息，无法导出 MDPro3 回放。')
    }
    return { messages, responses: this.getAllTimelineResponses() }
  }

  getAllTimelineResponses(): Uint8Array[] {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出录像。')
    }
    const lastOpIndex = state.timeline.getCurrentStep()?.node.opIndex ?? -1
    return state.ops
      .slice(0, lastOpIndex + 1)
      .flatMap((op) => (op.type === 'inject' ? [] : op.responses))
  }
}

export const duelSession = new DuelSession()
