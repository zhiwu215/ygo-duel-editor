import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineSessionDoc,
  EngineSessionImportPayload,
  DuelOperation,
  ENGINE_SESSION_DOC_VERSION,
  encodeSessionOp,
  decodeSessionOp,
  parseEngineSessionDoc,
  resolveMasterRuleFromDuelRule,
  MASTER_RULES,
  CardLocation,
  EngineCard,
  FIELD_ZONE_SEQUENCE,
  withHandShuffleNote
} from '@shared/index'
import {
  Answer,
  EngineCardEditResult,
  EngineCardRef,
  EngineInjectResult,
  EngineProvenance,
  EngineRequest,
  EngineSubmitAnswerResult,
  InjectCommand,
  RecordedAnswer,
  TimingPolicy,
  normalizeTimingPolicy
} from '@shared/engine/protocol'
import { createDuelFromYrp } from 'koishipro-core.js'
import {
  bindEngineCapabilities,
  createDuelFromSnapshot,
  getOcgcoreEngine,
  setScriptErrorListener
} from './ocgcore-engine'
import { computeDiff } from './diff-resolver'
import { encodeAnswer, describeAnswer } from './answer-encoder'
import { describeInject, executeInject, injectCardName, verifyInject } from './injector'
import { resetDuelLogContext } from './duel-log'
import { createSessionState, headPendingQuery } from './session-state'
import { setupFromPuzzleState, setupFromDeckParams } from './session-setup'
import {
  buildReplayTimeline,
  parseYrpReplay,
  setupReplayDuel,
  type EngineReplayStartPayload
} from './replay-session'
import { advanceEngine, isAutoFinishableUnselect } from './engine-pump'
import {
  ReplayDivergenceError,
  createRecordedAnswer,
  defaultOptionalAnswer,
  encodeRecordedAnswer,
  isNewOptionalPrompt,
  samePrompt
} from './replay-policy'
import { attachAnswerInstanceIds } from './answer-remap'
import {
  initializeProvenance,
  nodeIdForOp,
  resolveProvenanceRecord,
  trackInject
} from './provenance-tracker'
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
      setScriptErrorListener((message) => {
        if (!this.state.lastScriptError) this.state.lastScriptError = message
        this.state.accumulatedLogs.push(`脚本执行失败：${message.slice(0, 240)}`)
      })
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
      initializeProvenance(state, this.readBoard())
    } else {
      setupFromDeckParams(state, state.initParams)
    }
    return advanceEngine(state)
  }

  private async replayTo(stepId: string, freshIdentity = false): Promise<void> {
    const state = this.state
    const target = state.timeline.getStep(stepId)
    if (!target) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.disposeDuel()
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
    state.autoAnswers = []
    resetDuelLogContext(state.duelLog)
    state.pendingQueries = []
    state.lastHintDesc = undefined
    state.replaying = true

    try {
      this.createDuelFromInit()
      this.recordInitialReplayNodeState()

      for (let index = 0; index <= target.node.opIndex; index++) {
        const op = state.ops[index]
        if (!op) {
          throw new Error(`操作流缺少第 ${index} 条记录，无法重放。`)
        }
        if (op.type === 'inject') {
          if (op.removed) continue
          await this.rebaseDuelFromRequestSnapshot()
          const before = this.readBoard()
          executeInject(state.duel!, op.command, before)
          trackInject(state, before, this.readBoard(), index, op.command)
          advanceEngine(state)
          if (state.lastAdvanceRetried) {
            throw new Error(`重放第 ${index + 1} 条操作（注入）时引擎拒绝了重放。`)
          }
          if (!state.requestSnapshot && state.duel && !state.duel.ended) {
            try {
              state.requestSnapshot = state.duel.snapshot()
            } catch {
              state.requestSnapshot = null
            }
          }
          this.recordReplayNodeState(index)
          continue
        }
        const answers = op.answers
        for (let responseIndex = 0; responseIndex < op.responses.length; responseIndex++) {
          const recorded = answers?.[responseIndex]
          try {
            this.feedReplayResponse(
              op,
              responseIndex,
              recorded,
              op.type === 'auto' ? '自动应答' : '玩家应答'
            )
          } catch (err) {
            if (err instanceof ReplayDivergenceError) {
              err.opIndex = index
              err.responseIndex = responseIndex
              const fork = this.lastConsistentStep(index)
              err.forkStepId = fork?.id ?? null
              if (!err.expectedTitle) {
                err.expectedTitle = recorded?.prompt.title ?? '未知询问'
              }
              console.error('[duel-session] 历史重放响应被拒绝:', {
                opIndex: index,
                responseIndex,
                opType: op.type,
                expected: err.expectedTitle,
                actual: err.actualTitle
              })
            }
            throw err
          }
        }
        this.recordReplayNodeState(index)
      }
    } finally {
      state.replaying = false
    }

    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
    if (!freshIdentity) {
      state.fieldReader.restoreIdentity(target.node.boardState)
    }
    state.timeline.setCurrentStepId(stepId)
  }

  private sendDuelResponse(response: Uint8Array): void {
    if (this.state.recordingResponses) {
      this.state.recordingResponses.push(new Uint8Array(response))
    }
    this.state.duel!.setResponse(response)
  }

  private feedReplayResponse(
    op: DuelOperation,
    responseIndex: number,
    recorded: RecordedAnswer | undefined,
    kind: string
  ): void {
    const state = this.state
    const raw = op.type === 'inject' ? new Uint8Array(0) : op.responses[responseIndex]
    if (recorded) {
      let inserted = 0
      for (;;) {
        const head = headPendingQuery(state)
        if (!head) {
          throw new ReplayDivergenceError('引擎没有等待响应。')
        }
        if (samePrompt(head.request, recorded.prompt)) {
          let response: Uint8Array
          try {
            response = encodeRecordedAnswer(head.msg, head.request, recorded)
          } catch (err) {
            if (err instanceof ReplayDivergenceError) {
              err.expectedTitle = recorded.prompt.title
              err.actualTitle = head.request.title
            }
            throw err
          }
          if (op.type !== 'inject') {
            op.responses[responseIndex] = response
          }
          this.sendDuelResponse(response)
          advanceEngine(state)
          if (state.lastAdvanceRetried) {
            throw new ReplayDivergenceError(`${kind}被引擎拒绝。`)
          }
          return
        }
        if (isNewOptionalPrompt(head.request)) {
          const answer = defaultOptionalAnswer(head.request)
          if (!answer) {
            throw new ReplayDivergenceError('新增询问不能默认不发动。')
          }
          let optResp: Uint8Array
          try {
            optResp = encodeAnswer(head.msg, answer)
          } catch (err) {
            throw new ReplayDivergenceError(
              err instanceof Error ? err.message : '新增询问无法编码默认应答。'
            )
          }
          this.sendDuelResponse(optResp)
          advanceEngine(state)
          if (state.lastAdvanceRetried) {
            throw new ReplayDivergenceError('新增可选询问的默认应答被引擎拒绝。')
          }
          inserted += 1
          if (inserted > 32) {
            throw new ReplayDivergenceError('新增可选询问过多。')
          }
          continue
        }
        const err = new ReplayDivergenceError(`当前询问与历史${kind}不一致。`)
        err.expectedTitle = recorded.prompt.title
        err.actualTitle = head.request.title || '未知询问'
        throw err
      }
    }

    const headBefore = headPendingQuery(state)
    this.sendDuelResponse(raw)
    advanceEngine(state)
    if (!state.lastAdvanceRetried) return
    if (headBefore && isNewOptionalPrompt(headBefore.request)) {
      const answer = defaultOptionalAnswer(headBefore.request)
      if (!answer) {
        throw new ReplayDivergenceError('新增询问不能默认不发动。')
      }
      this.sendDuelResponse(encodeAnswer(headBefore.msg, answer))
      advanceEngine(state)
      if (state.lastAdvanceRetried) {
        throw new ReplayDivergenceError('新增可选询问的默认应答被引擎拒绝。')
      }
      this.sendDuelResponse(raw)
      advanceEngine(state)
      if (!state.lastAdvanceRetried) return
    }
    const err = new ReplayDivergenceError(`${kind}被引擎拒绝。`)
    err.expectedTitle = headBefore?.request.title ?? '未知询问'
    err.actualTitle = headPendingQuery(state)?.request.title ?? '未知询问'
    throw err
  }

  private lastConsistentStep(opIndex: number): EngineTimelineNode | null {
    let fork: EngineTimelineNode | null = null
    for (const node of this.state.timeline.getHistoryPath()) {
      if (node.opIndex >= opIndex) break
      fork = node
    }
    return fork
  }

  private recordInitialReplayNodeState(): void {
    const state = this.state
    const firstNode = state.timeline.getHistoryPath()[0]
    if (!firstNode) return
    let board: EngineBoardState
    try {
      board = this.readBoard()
    } catch {
      return
    }
    firstNode.boardState = board
    firstNode.pendingRequest = headPendingQuery(state)?.request ?? null
    if (state.accumulatedLogEvents.length > 0) {
      firstNode.logEvents = [...state.accumulatedLogEvents]
    }
    if (state.accumulatedEvents.length > 0) {
      firstNode.events = [...state.accumulatedEvents]
    }
    if (state.accumulatedLogs.length > 0) {
      firstNode.logs = [...state.accumulatedLogs]
    }
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
  }

  private recordReplayNodeState(opIndex: number): void {
    const state = this.state
    const nodes = state.timeline.getHistoryPath().filter((node) => node.opIndex === opIndex)
    if (nodes.length === 0) return
    let board: EngineBoardState
    try {
      board = this.readBoard()
    } catch {
      return
    }
    const request = headPendingQuery(state)?.request ?? null
    const op = state.ops[opIndex]
    const recorded = op?.type === 'answer' ? op.answers?.[0] : undefined
    const answerTitle =
      recorded && op?.type === 'answer'
        ? withHandShuffleNote(
            describeAnswer({ player: recorded.prompt.player }, recorded.answer),
            state.accumulatedEvents
          )
        : undefined

    for (const node of nodes) {
      node.boardState = board
      node.pendingRequest = request
      if (state.accumulatedLogEvents.length > 0) {
        node.logEvents = [...state.accumulatedLogEvents]
      }
      if (state.accumulatedEvents.length > 0) {
        node.events = [...state.accumulatedEvents]
      }
      if (state.accumulatedLogs.length > 0) {
        node.logs = [...state.accumulatedLogs]
      }
      if (answerTitle) {
        node.title = answerTitle
      }
    }
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
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
    state.accumulatedLogEvents = []
    resetDuelLogContext(state.duelLog)
    state.pendingQueries = []
    state.requestSeq = 1
    state.lastHintDesc = undefined
    state.lastParseError = null
    state.lastScriptError = null
    state.replaying = false
    state.autoAnswers = []
    state.replay = null
    state.recordingMessages = null
    state.provenance.clear()
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

  private async restoreSessionState(snapshot: SessionSnapshot): Promise<void> {
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
      await this.replayTo(snapshot.currentStepId)
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
      await this.replayTo(parsed.currentStepId)

      const boardState = this.readBoard()
      const node = state.timeline.getStep(parsed.currentStepId)?.node
      if (!node) throw new Error('找不到剧本指定的当前步骤。')
      node.boardState = boardState
      node.pendingRequest = headPendingQuery(state)?.request ?? null

      return {
        initParams: structuredClone(parsed.initParams),
        boardState,
        pendingRequest: headPendingQuery(state)?.request ?? null,
        timeline: state.timeline.getAllNodes(),
        currentStepId: parsed.currentStepId
      }
    } catch (err) {
      await this.restoreSessionState(previous)
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

    const seed = params.seed
      ? [...params.seed]
      : [
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000),
          Math.floor(Math.random() * 100000)
        ]
    while (seed.length < 8) seed.push(0)
    state.seed = seed
    state.initParams = params

    const initialAutoResponses = this.createDuelFromInit()
    if (initialAutoResponses.length > 0) {
      const answers =
        state.autoAnswers.length === initialAutoResponses.length
          ? [...state.autoAnswers]
          : undefined
      state.ops.push({
        type: 'auto',
        responses: initialAutoResponses,
        ...(answers ? { answers } : {})
      })
    }
    state.autoAnswers = []

    const initialBoard = this.readBoard()
    const pendingRequest = headPendingQuery(state)?.request ?? null
    const initialNode = state.timeline.addStep(
      '决斗开局',
      initialBoard.turnPlayer,
      initialBoard,
      pendingRequest,
      [...state.accumulatedLogs],
      [...state.accumulatedEvents],
      [...state.accumulatedLogEvents],
      state.ops.length - 1
    )
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []

    return {
      boardState: initialNode.boardState,
      pendingRequest,
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
      const duelRule = (yrp.opt >>> 16) & 0xffff
      const resolvedRule = resolveMasterRuleFromDuelRule(duelRule)
      const masterRule = resolvedRule ?? (duelRule === 1 ? 2 : 5)
      const ruleWarning =
        duelRule === 1
          ? '回放使用规则1，编辑器按大师规则2展示。'
          : resolvedRule === null
            ? `回放未记录有效的大师规则（rule=${duelRule}），编辑器按${MASTER_RULES[5].name}展示。`
            : undefined
      const warnings = [warning, ruleWarning].filter((item): item is string => Boolean(item))
      return {
        info: {
          fileName,
          hostName: yrp.hostName,
          clientName: yrp.clientName,
          tagHostName: yrp.tagHostName ?? undefined,
          tagClientName: yrp.tagClientName ?? undefined,
          isTag: yrp.isTag,
          isSingleMode: yrp.isSingleMode,
          totalSteps: yrp.responses.length,
          masterRule,
          ...(warnings.length > 0 ? { warning: warnings.join('；') } : {})
        },
        boardState: this.readBoard(),
        timeline: state.timeline.getAllNodes(),
        currentStepId
      }
    } catch (err) {
      await this.restoreSessionState(previous)
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
    const head = headPendingQuery(state)
    if (!head) {
      throw new Error('引擎当前没有等待响应的操作。')
    }

    const requestMsg = head.msg
    const actingPlayer = head.request.player
    const response = encodeAnswer(requestMsg, answer)
    const beforeBoard = this.readBoard()
    const recorded = createRecordedAnswer(head.request, answer)
    attachAnswerInstanceIds(recorded.answer, beforeBoard)
    const logText = describeAnswer(requestMsg, answer)

    state.autoAnswers = []
    state.duel.setResponse(response)
    const autoResponses = advanceEngine(state)

    if (state.lastAdvanceRetried) {
      state.accumulatedLogs = []
      state.accumulatedEvents = []
      state.autoAnswers = []
      return { retry: true, pendingRequest: headPendingQuery(state)?.request ?? null }
    }

    for (let loops = 0; loops < MAX_AUTO_FINISH_LOOPS; loops++) {
      if (!isAutoFinishableUnselect(state, requestMsg)) break
      const autoHead = headPendingQuery(state)!
      const autoResponse = encodeAnswer(autoHead.msg, { kind: 'unselect', card: null })
      state.autoAnswers.push(
        createRecordedAnswer(autoHead.request, { kind: 'unselect', card: null })
      )
      state.duel.setResponse(autoResponse)
      autoResponses.push(autoResponse, ...advanceEngine(state))
      if (state.lastAdvanceRetried) break
    }

    state.accumulatedLogs.push(logText)

    this.truncateToCurrentStep()
    const boardState = this.readBoard()
    const diff = computeDiff(beforeBoard, boardState)
    const answerOpIndex = state.ops.length
    state.ops.push({
      type: 'answer',
      nodeId: '',
      responses: [response],
      answers: [recorded]
    })
    if (autoResponses.length > 0) {
      const autoAnswers =
        state.autoAnswers.length === autoResponses.length ? [...state.autoAnswers] : undefined
      state.ops.push({
        type: 'auto',
        responses: autoResponses,
        ...(autoAnswers ? { answers: autoAnswers } : {})
      })
    }
    state.autoAnswers = []

    const pendingRequest = headPendingQuery(state)?.request ?? null
    const node = state.timeline.addStep(
      withHandShuffleNote(logText, state.accumulatedEvents),
      actingPlayer,
      boardState,
      pendingRequest,
      [...state.accumulatedLogs],
      [...state.accumulatedEvents],
      [...state.accumulatedLogEvents],
      state.ops.length - 1
    )
    const answerOp = state.ops[answerOpIndex]
    if (answerOp?.type === 'answer') answerOp.nodeId = node.id
    state.requestSeq += 1
    state.accumulatedLogs = []
    state.accumulatedLogEvents = []
    state.accumulatedEvents = []

    return {
      retry: false,
      boardState,
      pendingRequest,
      node,
      diff,
      actTurn: beforeBoard.turn,
      actTurnPlayer: beforeBoard.turnPlayer,
      actPhase: beforeBoard.phase
    }
  }

  private async rebaseDuelFromRequestSnapshot(): Promise<void> {
    const state = this.state
    const replaying = state.replaying
    const snapshot = state.requestSnapshot
    if (!snapshot) {
      if (state.duel && !state.duel.ended) {
        return
      }
      throw new Error('当前请求没有可用的引擎快照，无法重新校验注入。')
    }
    const duel = await createDuelFromSnapshot(snapshot)
    await bindEngineCapabilities(duel.ocgcoreWrapper)
    this.disposeDuel()
    state.duel = duel
    state.ownedWrapper = duel.ocgcoreWrapper
    state.pendingQueries = []
    state.requestSnapshot = null
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.lastHintDesc = undefined
    state.replaying = replaying
  }

  async inject(command: InjectCommand): Promise<EngineInjectResult> {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，请先退出回放。')
    }
    if (!state.duel || state.duel.ended) {
      throw new Error('当前没有进行中的对局，无法执行注入。')
    }

    this.truncateToCurrentStep()
    if (!state.requestSnapshot) {
      const current = state.timeline.getCurrentStep()
      if (current) await this.replayTo(current.node.id)
    }
    await this.rebaseDuelFromRequestSnapshot()
    const before = this.readBoard()
    state.autoAnswers = []
    const outcome = executeInject(state.duel!, command, before)
    advanceEngine(state)
    state.autoAnswers = []
    if (!state.requestSnapshot && state.duel && !state.duel.ended) {
      try {
        state.requestSnapshot = state.duel.snapshot()
      } catch {
        state.requestSnapshot = null
      }
    }
    const boardState = this.readBoard()
    const warning = outcome.warning ?? verifyInject(command, before, boardState)

    const opIndex = state.ops.length
    trackInject(state, before, boardState, opIndex, command)
    const title = describeInject(command, outcome.label, injectCardName(command))
    const logs = [`[注入] ${outcome.label}`]
    if (warning) logs.push(warning)

    const node = state.timeline.addStep(
      title,
      command.player,
      boardState,
      headPendingQuery(state)?.request ?? null,
      logs,
      [...state.accumulatedEvents],
      [...state.accumulatedLogEvents],
      opIndex
    )
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
    state.ops.push({ type: 'inject', command })

    return { boardState, node, warning }
  }

  async jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }> {
    const state = this.state
    const target = state.timeline.getStep(stepId)
    if (!target) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    const previousStepId = state.timeline.getCurrentStep()?.node.id ?? null
    try {
      await this.replayTo(stepId)
    } catch (err) {
      if (previousStepId && previousStepId !== stepId) {
        try {
          await this.replayTo(previousStepId)
        } catch (rollbackError) {
          console.error('[duel-session] 跳转失败后回滚到原步骤也失败:', rollbackError)
        }
      }
      throw err
    }
    if (state.replay) {
      state.pendingQueries = []
    }

    const boardState = this.readBoard()
    const node = state.timeline.getStep(stepId)?.node
    if (node) {
      node.boardState = boardState
      node.pendingRequest = headPendingQuery(state)?.request ?? null
    }

    return {
      boardState,
      currentStepId: stepId
    }
  }

  private resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null {
    let board: EngineBoardState
    try {
      board = this.getBoardState()
    } catch {
      return null
    }
    const exact = ref.instanceId
      ? board.allCards.find((card) => card.instanceId === ref.instanceId)
      : undefined
    if (exact) return { instanceId: exact.instanceId, card: exact }

    const location = ref.location === CardLocation.FZONE ? CardLocation.SZONE : ref.location
    const sequence = ref.location === CardLocation.FZONE ? FIELD_ZONE_SEQUENCE : ref.sequence
    const matchesSeat = (card: EngineCard): boolean =>
      ref.duelistId === undefined ||
      card.duelistId === undefined ||
      card.duelistId === ref.duelistId
    const positional = board.allCards.find(
      (card) =>
        card.controller === ref.controller &&
        card.location === location &&
        card.sequence === sequence &&
        matchesSeat(card)
    )
    if (positional) return { instanceId: positional.instanceId, card: positional }

    const loose = board.allCards.find(
      (card) =>
        card.controller === ref.controller &&
        card.sequence === sequence &&
        ((card.location & location) !== 0 || (location & card.location) !== 0) &&
        matchesSeat(card)
    )
    return loose ? { instanceId: loose.instanceId, card: loose } : null
  }

  private cardEditorDeps(): CardEditorDeps {
    return {
      resolveCard: (ref) => this.resolveCard(ref),
      readBoard: () => this.readBoard(),
      truncateToCurrentStep: () => this.truncateToCurrentStep(),
      replayTo: (stepId, freshIdentity) => this.replayTo(stepId, freshIdentity)
    }
  }

  getProvenance(ref: EngineCardRef): EngineProvenance {
    const state = this.state
    const resolved = this.resolveCard(ref)
    if (!resolved) return { kind: 'unknown' }
    const record = resolveProvenanceRecord(state, resolved.card)
    if (!record?.origin) return { kind: 'unknown' }
    if (record.origin.kind === 'initial') {
      return {
        kind: 'initial',
        controller: record.initial?.controller ?? resolved.card.controller,
        location: record.initial?.location ?? resolved.card.location,
        sequence: record.initial?.sequence ?? resolved.card.sequence,
        code: record.code,
        duelistId: record.initial?.duelistId
      }
    }
    const op = state.ops[record.origin.opIndex]
    if (op?.type !== 'inject') return { kind: 'unknown' }
    return {
      kind: 'inject',
      opIndex: record.origin.opIndex,
      nodeId: nodeIdForOp(state, record.origin.opIndex),
      command: op.command
    }
  }

  async replaceCard(ref: EngineCardRef, newCode: number): Promise<EngineCardEditResult> {
    if (this.state.replay) throw new Error('回放模式为只读，请先退出回放。')
    return replaceCardOp(this.state, this.cardEditorDeps(), ref, newCode)
  }

  async removeCard(ref: EngineCardRef): Promise<EngineCardEditResult> {
    if (this.state.replay) throw new Error('回放模式为只读，请先退出回放。')
    return removeCardOp(this.state, this.cardEditorDeps(), ref)
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
    return headPendingQuery(this.state)?.request ?? null
  }

  async recordMessageStream(): Promise<{
    messages: Uint8Array[]
    responses: Uint8Array[]
  }> {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出 MDPro3 回放。')
    }
    const target = this.timelineTip()
    if (!state.initParams || !target) {
      throw new Error('引擎尚未启动，无法导出 MDPro3 回放。')
    }
    const previous = state.timeline.getCurrentStep()

    state.recordingMessages = []
    const recordedResponses: Uint8Array[] = []
    state.recordingResponses = recordedResponses
    let messages: Uint8Array[]
    try {
      await this.replayTo(target.id)
      messages = state.recordingMessages ?? []
    } finally {
      state.recordingMessages = null
      state.recordingResponses = null
      if (previous && previous.node.id !== target.id) {
        try {
          await this.replayTo(previous.node.id)
        } catch (err) {
          console.error('[duel-session] 导出后恢复原步骤失败:', err)
        }
      }
    }
    if (messages.length === 0) {
      throw new Error('没有录制到任何引擎消息，无法导出 MDPro3 回放。')
    }
    return { messages, responses: recordedResponses }
  }

  async exportReplayResponses(): Promise<Uint8Array[]> {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出录像。')
    }
    const target = this.timelineTip()
    if (!state.initParams || !target) {
      throw new Error('引擎尚未启动，无法导出录像。')
    }
    const previous = state.timeline.getCurrentStep()
    const recordedResponses: Uint8Array[] = []
    state.recordingResponses = recordedResponses
    try {
      await this.replayTo(target.id)
    } finally {
      state.recordingResponses = null
      if (previous && previous.node.id !== target.id) {
        try {
          await this.replayTo(previous.node.id)
        } catch (err) {
          console.error('[duel-session] 导出后恢复原步骤失败:', err)
        }
      }
    }
    return recordedResponses
  }

  private timelineTip(): EngineTimelineNode | null {
    const nodes = this.state.timeline.getAllNodes()
    return nodes[nodes.length - 1] ?? null
  }

  getAllTimelineResponses(): Uint8Array[] {
    const state = this.state
    if (state.replay) {
      throw new Error('回放模式为只读，无法导出录像。')
    }
    const lastOpIndex = this.timelineTip()?.opIndex ?? -1
    return state.ops
      .slice(0, lastOpIndex + 1)
      .flatMap((op) => (op.type === 'inject' ? [] : op.responses))
  }

  getSeed(): number[] {
    return [...this.state.seed]
  }

  getInitParams(): EngineDuelInitParams | null {
    return this.state.initParams
  }

  hasInjectOps(): boolean {
    return this.state.ops.some((op) => op.type === 'inject' && !op.removed)
  }
}

export const duelSession = new DuelSession()
