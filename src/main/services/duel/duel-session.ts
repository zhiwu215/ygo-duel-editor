import {
  OcgcoreWrapper,
  OcgcoreDuel,
  OcgcoreDuelOptionFlag,
  OcgcoreDuelRule,
  _OcgcoreConstants
} from 'koishipro-core.js'
import {
  IndexResponse,
  YGOProMsgDraw,
  YGOProMsgNewTurn,
  YGOProMsgDamage,
  YGOProMsgRecover,
  YGOProMsgRetry,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectUnselectCard,
  YGOProMsgShuffleDeck
} from 'ygopro-msg-encode'
import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineCard,
  EngineCardRef,
  EngineCardEditResult,
  EngineProvenance,
  EngineStepEvent,
  CardLocation,
  DuelPuzzleState,
  FieldCard,
  EngineSessionDoc,
  EngineSessionImportPayload,
  SerializedOp,
  ENGINE_SESSION_DOC_VERSION,
  base64ToBytes,
  bytesToBase64,
  parseEngineSessionDoc
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { FieldReader } from './field-reader'
import { EngineTimelineManager } from './timeline-manager'
import { getOcgcoreEngine } from './ocgcore-engine'
import { isInteractiveQuery } from './message-parser'
import { computeDiff } from './diff-resolver'
import { routeRequest } from './request-router'
import { encodeAnswer, describeAnswer } from './answer-encoder'
import {
  Answer,
  DEFAULT_TIMING_POLICY,
  EngineInjectResult,
  EngineRequest,
  EngineSubmitAnswerResult,
  InjectCommand,
  TimingPolicy,
  normalizeTimingPolicy
} from '@shared/engine/protocol'
import { YGOProMsgHint, YGOProMsgSelectChain, YGOProMsgShuffleHand } from 'ygopro-msg-encode'
import { describeInject, executeInject, injectCardName, verifyInject } from './injector'

const HINT_TYPE_SELECTMSG = 3

export interface SubmitAnswerResult extends EngineSubmitAnswerResult {}

export type DuelOperation =
  | { type: 'answer'; nodeId: string; responses: Uint8Array[] }
  | { type: 'auto'; responses: Uint8Array[] }
  | { type: 'inject'; command: InjectCommand; removed?: boolean }

type ProvenanceOrigin =
  { kind: 'initial'; puzzleCardId: string; code: number } | { kind: 'inject'; opIndex: number }

interface ProvenanceRecord {
  provenance: EngineProvenance
  origin?: ProvenanceOrigin
  orderStable?: boolean
}

interface DrawEvent {
  player: 0 | 1
  codes: number[]
}

interface SessionSnapshot {
  seed: number[]
  initParams: EngineDuelInitParams | null
  ops: DuelOperation[]
  timingPolicy: TimingPolicy
  timeline: EngineTimelineNode[]
  currentStepId: string | null
  requestSeq: number
}

const { OcgcoreScriptConstants } = _OcgcoreConstants

const MAX_PROCESS_LOOPS = 10000
const MAX_AUTO_FINISH_LOOPS = 8
const FIELD_ZONE_SEQUENCE = 5

const MASTER_RULE_TO_DUEL_RULE: Record<number, OcgcoreDuelRule> = {
  2: OcgcoreDuelRule.Rule2,
  3: OcgcoreDuelRule.MasterRule3,
  4: OcgcoreDuelRule.NewMasterRule,
  5: OcgcoreDuelRule.MasterRule2020
}

export class DuelSession {
  private ocgcore: OcgcoreWrapper | null = null
  private duel: OcgcoreDuel | null = null
  private ownedWrapper: OcgcoreWrapper | null = null
  private fieldReader = new FieldReader()
  private timeline = new EngineTimelineManager()
  private currentPendingMsg: unknown = null
  private currentPendingRequest: EngineRequest | null = null
  private requestSeq = 1
  private lastHintDesc: number | undefined = undefined
  private accumulatedLogs: string[] = []
  private accumulatedEvents: EngineStepEvent[] = []
  private lastAdvanceRetried = false
  private seed: number[] = []
  private initParams: EngineDuelInitParams | null = null
  private ops: DuelOperation[] = []
  private timingPolicy: TimingPolicy = { ...DEFAULT_TIMING_POLICY }
  private replaying = false
  private provenance = new Map<string, ProvenanceRecord>()
  private sequenceProvenance = new Map<string, ProvenanceRecord>()
  private drawCounts: [number, number] = [0, 0]
  private deckDirty: [boolean, boolean] = [false, false]
  private lastDrawEvents: DrawEvent[] = []
  private lastDeckShuffles: (0 | 1)[] = []

  setTimingPolicy(policy: TimingPolicy): TimingPolicy {
    this.timingPolicy = normalizeTimingPolicy(policy)
    return { ...this.timingPolicy }
  }

  async init(): Promise<void> {
    if (!this.ocgcore) {
      this.ocgcore = await getOcgcoreEngine()
    }
  }

  private disposeDuel(): void {
    if (this.duel) {
      this.duel.endDuel()
      this.duel = null
    }
    if (this.ownedWrapper) {
      this.ownedWrapper.finalize()
      this.ownedWrapper = null
    }
  }

  /** 全量查询引擎当前场地（引擎是唯一真相） */
  private readBoard(): EngineBoardState {
    if (!this.duel) {
      throw new Error('当前没有可查询的对局。')
    }
    return this.fieldReader.readBoard(this.duel)
  }

  private createDuelFromInit(): Uint8Array[] {
    if (!this.initParams) {
      throw new Error('引擎会话尚未初始化。')
    }
    this.duel = this.ocgcore!.createDuelV2(this.seed)
    if (this.initParams.puzzleState) {
      this.setupFromPuzzleState(this.initParams.puzzleState)
    } else {
      this.setupFromDeckParams(this.initParams)
    }
    return this.advanceEngine()
  }

  private replayTo(stepId: string, freshIdentity = false): void {
    const target = this.timeline.getStep(stepId)
    if (!target) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.disposeDuel()
    this.accumulatedLogs = []
    this.accumulatedEvents = []
    this.currentPendingMsg = null
    this.currentPendingRequest = null
    this.lastHintDesc = undefined
    this.replaying = true

    try {
      this.createDuelFromInit()
      this.initializeProvenance(this.readBoard())

      for (let index = 0; index <= target.node.opIndex; index++) {
        const op = this.ops[index]
        if (!op) {
          throw new Error(`操作流缺少第 ${index} 条记录，无法重放。`)
        }
        if (op.type === 'inject') {
          if (op.removed) continue
          const before = this.readBoard()
          executeInject(this.duel!, op.command, before)
          const after = this.readBoard()
          this.trackInject(before, after, index, op.command)
          continue
        }
        for (const response of op.responses) {
          const before = this.readBoard()
          this.duel!.setResponse(response)
          this.advanceEngine()
          if (this.lastAdvanceRetried) {
            throw new Error(`重放第 ${index + 1} 条操作时引擎拒绝了历史响应。`)
          }
          this.trackAdvance(before, this.readBoard(), index)
        }
      }
    } finally {
      this.replaying = false
    }

    this.accumulatedLogs = []
    this.accumulatedEvents = []
    try {
      const replayBoard = this.fieldReader.getState()
      this.sequenceProvenance.clear()
      for (const card of replayBoard.allCards) {
        const record = this.provenance.get(card.instanceId)
        if (record) {
          this.sequenceProvenance.set(this.cardSignature(card), record)
        }
      }
    } catch {
      this.sequenceProvenance.clear()
    }
    if (!freshIdentity) {
      this.fieldReader.restoreIdentity(target.node.boardState)
    }
    this.timeline.setCurrentStepId(stepId)
  }

  private truncateToCurrentStep(): void {
    const current = this.timeline.getCurrentStep()
    if (!current) {
      this.ops.length = 0
      return
    }
    const limit = current.node.opIndex + 1
    if (this.ops.length > limit) this.ops.length = limit
    this.timeline.retainHistory(current.node.id)
  }

  private resetSessionState(): void {
    this.accumulatedLogs = []
    this.accumulatedEvents = []
    this.currentPendingMsg = null
    this.currentPendingRequest = null
    this.requestSeq = 1
    this.lastHintDesc = undefined
    this.replaying = false
    this.provenance.clear()
    this.sequenceProvenance.clear()
    this.drawCounts = [0, 0]
    this.deckDirty = [false, false]
    this.lastDrawEvents = []
    this.lastDeckShuffles = []
  }

  private captureSessionState(): SessionSnapshot {
    return {
      seed: [...this.seed],
      initParams: this.initParams ? structuredClone(this.initParams) : null,
      ops: structuredClone(this.ops),
      timingPolicy: { ...this.timingPolicy },
      timeline: this.timeline.getAllNodes().map((node) => structuredClone(node)),
      currentStepId: this.timeline.getCurrentStep()?.node.id ?? null,
      requestSeq: this.requestSeq
    }
  }

  private restoreSessionState(snapshot: SessionSnapshot): void {
    this.disposeDuel()
    this.timeline.clear()
    this.resetSessionState()
    this.seed = [...snapshot.seed]
    this.initParams = snapshot.initParams
    this.ops = snapshot.ops
    this.timingPolicy = { ...snapshot.timingPolicy }
    this.requestSeq = snapshot.requestSeq
    if (!snapshot.initParams || !snapshot.currentStepId) return
    this.timeline.restore(snapshot.timeline, snapshot.currentStepId)
    try {
      this.replayTo(snapshot.currentStepId)
    } catch (err) {
      console.error('[duel-session] 恢复导入前的对局失败:', err)
    }
  }

  private encodeSessionOp(op: DuelOperation): SerializedOp {
    if (op.type === 'inject') {
      return op.removed
        ? { type: 'inject', command: structuredClone(op.command), removed: true }
        : { type: 'inject', command: structuredClone(op.command) }
    }
    if (op.type === 'answer') {
      return { type: 'answer', nodeId: op.nodeId, responses: op.responses.map(bytesToBase64) }
    }
    return { type: 'auto', responses: op.responses.map(bytesToBase64) }
  }

  private decodeSessionOp(op: SerializedOp): DuelOperation {
    if (op.type === 'inject') {
      const command = structuredClone(op.command)
      return op.removed
        ? { type: 'inject', command, removed: true }
        : { type: 'inject', command }
    }
    if (op.type === 'answer') {
      return { type: 'answer', nodeId: op.nodeId, responses: op.responses.map(base64ToBytes) }
    }
    return { type: 'auto', responses: op.responses.map(base64ToBytes) }
  }

  exportSessionDoc(): EngineSessionDoc {
    const current = this.timeline.getCurrentStep()
    if (!this.initParams || !current) {
      throw new Error('引擎尚未启动，无法导出对局剧本。')
    }
    return {
      version: ENGINE_SESSION_DOC_VERSION,
      seed: [...this.seed],
      initParams: structuredClone(this.initParams),
      ops: this.ops.map((op) => this.encodeSessionOp(op)),
      timeline: this.timeline.getAllNodes().map((node) => structuredClone(node)),
      currentStepId: current.node.id,
      timingPolicy: { ...this.timingPolicy }
    }
  }

  async importSessionDoc(doc: EngineSessionDoc): Promise<EngineSessionImportPayload> {
    let parsed: EngineSessionDoc
    let ops: DuelOperation[]
    try {
      parsed = parseEngineSessionDoc(doc)
      ops = parsed.ops.map((op) => this.decodeSessionOp(op))
    } catch (err) {
      throw new Error(
        `导入对局剧本失败：${err instanceof Error ? err.message : String(err)}`
      )
    }

    await this.init()
    const previous = this.captureSessionState()

    try {
      this.resetSessionState()
      this.seed = [...parsed.seed]
      this.initParams = structuredClone(parsed.initParams)
      this.ops = ops
      this.timingPolicy = { ...parsed.timingPolicy }
      this.timeline.restore(parsed.timeline, parsed.currentStepId)
      this.replayTo(parsed.currentStepId)

      const boardState = this.readBoard()
      this.alignProvenance(boardState)
      const node = this.timeline.getStep(parsed.currentStepId)?.node
      if (!node) throw new Error('找不到剧本指定的当前步骤。')
      node.boardState = boardState
      node.pendingRequest = this.currentPendingRequest

      return {
        boardState,
        pendingRequest: this.currentPendingRequest,
        timeline: this.timeline.getAllNodes(),
        currentStepId: parsed.currentStepId
      }
    } catch (err) {
      this.restoreSessionState(previous)
      throw new Error(
        `导入对局剧本失败：${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  async startDuel(params: EngineDuelInitParams): Promise<{
    boardState: EngineBoardState
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }> {
    await this.init()

    this.disposeDuel()

    this.timeline.clear()
    this.ops = []
    this.resetSessionState()

    this.seed = params.seed || [
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000)
    ]
    this.initParams = params

    const initialAutoResponses = this.createDuelFromInit()
    if (initialAutoResponses.length > 0) {
      this.ops.push({ type: 'auto', responses: initialAutoResponses })
    }

    const initialBoard = this.readBoard()
    this.initializeProvenance(initialBoard)
    const initialNode = this.timeline.addStep(
      '决斗开局',
      initialBoard.turnPlayer,
      initialBoard,
      this.currentPendingRequest,
      [...this.accumulatedLogs],
      [...this.accumulatedEvents],
      this.ops.length - 1
    )
    this.accumulatedLogs = []
    this.accumulatedEvents = []

    return {
      boardState: initialNode.boardState,
      pendingRequest: this.currentPendingRequest,
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
    this.fieldReader.reset([p0Lp, p1Lp], state.turnPlayer)

    this.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: 0, drawCount: 1 })
    this.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: 0, drawCount: 1 })

    // 灵摆区物理映射（与 ygopro-core get_pzone_sequence 一致）：
    // MR4+ → szone 序号 0/4（魔陷区两端格）；MR2/3 → szone 序号 6/7
    const pzoneSeq = state.masterRule >= 4 ? [0, 4] : [6, 7]

    const fieldCards = state.cards.filter((c) => c.code > 0)
    // 手牌进引擎的 sequence 必须按编辑器手牌顺序（sequence 升序）编号（S1 身份对齐）：
    // cards 数组顺序不一定等于 sequence 顺序（例如中途插入手牌是数组尾部追加 + 序号插入），
    // 若按数组顺序编号，引擎手牌顺序会与编辑器错位，导致开局身份映射/选卡全部错卡。
    const handSequenceByInstance = new Map<string, number>()
    for (const controller of [0, 1] as const) {
      state.cards
        .filter((c) => c.controller === controller && c.location === CardLocation.HAND)
        .sort((a, b) => a.sequence - b.sequence)
        .forEach((c, index) => handSequenceByInstance.set(c.instanceId, index))
    }
    const handFallback: [number, number] = [0, 0]
    let unsupportedPendulum = 0

    // 预扫描：已占用的 szone 序号（灵摆格与魔陷格物理上共用，冲突时跳过）
    const takenSzone = new Set<number>()
    for (const card of fieldCards) {
      if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
      if (card.location === CardLocation.FZONE) takenSzone.add(FIELD_ZONE_SEQUENCE)
    }

    for (const card of fieldCards) {
      if (card.location === CardLocation.DECK || card.location === CardLocation.EXTRA) {
        continue
      }
      if (card.location === CardLocation.PZONE) {
        const seq = pzoneSeq[card.sequence]
        if (seq === undefined || takenSzone.has(seq)) {
          unsupportedPendulum++
          continue
        }
        takenSzone.add(seq)
        this.newEngineCard({
          code: card.code,
          owner: card.owner ?? card.controller,
          player: card.controller,
          location: CardLocation.SZONE,
          sequence: seq,
          position: OcgcoreScriptConstants.POS_FACEUP
        })
        continue
      }
      const isFieldZone = card.location === CardLocation.FZONE
      const sequence =
        card.location === CardLocation.HAND
          ? (handSequenceByInstance.get(card.instanceId) ?? handFallback[card.controller]++)
          : isFieldZone
            ? FIELD_ZONE_SEQUENCE
            : card.sequence
      this.newEngineCard({
        code: card.code,
        owner: card.owner ?? card.controller,
        player: card.controller,
        location: isFieldZone ? CardLocation.SZONE : card.location,
        sequence,
        position: card.position
      })
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

    let unsupportedOverlay = 0
    for (const card of fieldCards) {
      if (card.location !== CardLocation.MZONE || !card.overlayMaterials?.length) continue
      unsupportedOverlay += card.overlayMaterials.filter((matCode) => matCode > 0).length
    }

    const { rule, flags } = this.buildStartDuelOptions(
      state.masterRule,
      Boolean(state.firstTurnAttack)
    )
    this.duel!.startDuel({ rule, flags })
    this.accumulatedLogs.push(`决斗开始！(MR${state.masterRule})`)
    if (unsupportedPendulum > 0) {
      this.accumulatedLogs.push(
        `有 ${unsupportedPendulum} 张灵摆区卡片未能还原（物理格冲突或规则版本不支持）`
      )
    }
    if (unsupportedOverlay > 0) {
      this.accumulatedLogs.push(
        `引擎无法还原 ${unsupportedOverlay} 张超量素材（ocgcore 建卡不接受 LOCATION_OVERLAY）`
      )
    }
  }

  private setupFromDeckParams(params: EngineDuelInitParams): void {
    const p0Lp = params.p0Lp ?? 8000
    const p1Lp = params.p1Lp ?? 8000
    this.fieldReader.reset([p0Lp, p1Lp], 0)

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

    this.duel!.startDuel({
      rule: OcgcoreDuelRule.MasterRule2020,
      flags: [OcgcoreDuelOptionFlag.PseudoShuffle]
    })
    this.accumulatedLogs.push('决斗开始！')
  }

  /**
   * 提交语义化答案（R2 新模型）。
   * RETRY 时返回 { retry: true }，同一条请求保持待答状态（面板应重新打开）。
   */
  submitAnswer(answer: Answer): SubmitAnswerResult {
    if (!this.duel || this.duel.ended) {
      throw new Error('当前没有进行中的对局。')
    }
    if (!this.currentPendingMsg || !this.currentPendingRequest) {
      throw new Error('引擎当前没有等待响应的操作。')
    }

    const requestMsg = this.currentPendingMsg
    const actingPlayer = this.currentPendingRequest.player
    const response = encodeAnswer(requestMsg, answer)
    const logText = describeAnswer(requestMsg, answer)

    const baseOpIndex = (this.timeline.getCurrentStep()?.node.opIndex ?? -1) + 1
    const beforeBoard = this.readBoard()
    this.duel.setResponse(response)
    const autoResponses = this.advanceEngine()

    if (this.lastAdvanceRetried) {
      this.accumulatedLogs = []
      this.accumulatedEvents = []
      return { retry: true, pendingRequest: this.currentPendingRequest }
    }
    this.trackAdvance(beforeBoard, this.readBoard(), baseOpIndex)

    for (let loops = 0; loops < MAX_AUTO_FINISH_LOOPS; loops++) {
      if (!this.isAutoFinishableUnselect(requestMsg)) break
      const autoResponse = encodeAnswer(this.currentPendingMsg, { kind: 'unselect', card: null })
      const beforeAuto = this.readBoard()
      this.duel.setResponse(autoResponse)
      autoResponses.push(autoResponse, ...this.advanceEngine())
      if (this.lastAdvanceRetried) break
      this.trackAdvance(beforeAuto, this.readBoard(), baseOpIndex + 1)
    }

    this.accumulatedLogs.push(logText)

    this.truncateToCurrentStep()
    const boardState = this.readBoard()
    const diff = computeDiff(beforeBoard, boardState)
    const answerOpIndex = this.ops.length
    this.ops.push({ type: 'answer', nodeId: '', responses: [response] })
    if (autoResponses.length > 0) {
      this.ops.push({ type: 'auto', responses: autoResponses })
    }

    const shuffledHands = this.accumulatedEvents.some((event) => event.kind === 'shuffle-hand')
    const node = this.timeline.addStep(
      shuffledHands ? `${logText}（手牌切洗）` : logText,
      actingPlayer,
      boardState,
      this.currentPendingRequest,
      [...this.accumulatedLogs],
      [...this.accumulatedEvents],
      this.ops.length - 1
    )
    const answerOp = this.ops[answerOpIndex]
    if (answerOp?.type === 'answer') answerOp.nodeId = node.id
    this.requestSeq += 1
    this.accumulatedLogs = []
    this.accumulatedEvents = []

    return {
      retry: false,
      boardState,
      pendingRequest: this.currentPendingRequest,
      node,
      diff
    }
  }

  inject(command: InjectCommand): EngineInjectResult {
    if (!this.duel || this.duel.ended) {
      throw new Error('当前没有进行中的对局，无法执行剧情安排。')
    }

    const before = this.readBoard()
    this.truncateToCurrentStep()
    const outcome = executeInject(this.duel, command, before)
    const boardState = this.readBoard()
    const warning = outcome.warning ?? verifyInject(command, before, boardState)

    const opIndex = this.ops.length
    this.trackInject(before, boardState, opIndex, command)
    const title = describeInject(command, outcome.label, injectCardName(command))
    const logs = [`[剧情安排] ${outcome.label}`]
    if (warning) logs.push(warning)

    const node = this.timeline.addStep(
      title,
      command.player,
      boardState,
      this.currentPendingRequest,
      logs,
      [...this.accumulatedEvents],
      opIndex
    )
    this.accumulatedEvents = []
    this.ops.push({ type: 'inject', command })

    return { boardState, node, warning }
  }

  private isAutoFinishableUnselect(answeredMsg: unknown): boolean {
    const msg = this.currentPendingMsg
    if (!(msg instanceof YGOProMsgSelectUnselectCard)) return false
    if (msg === answeredMsg) return true
    const data = this.currentPendingRequest?.data
    return (
      data?.kind === 'unselect' &&
      data.finishable &&
      data.selectable.length === 0 &&
      data.unselectable.length > 0
    )
  }

  async jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }> {
    if (!this.timeline.getStep(stepId)) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.replayTo(stepId)

    const boardState = this.readBoard()
    this.alignProvenance(boardState)
    const node = this.timeline.getStep(stepId)?.node
    if (node) {
      node.boardState = boardState
      node.pendingRequest = this.currentPendingRequest
    }

    return {
      boardState,
      currentStepId: stepId
    }
  }

  private resolveAutoResponse(msg: unknown): Uint8Array | null {
    if (this.replaying) return null

    if (msg instanceof YGOProMsgSelectChain) {
      if (this.timingPolicy.chain === 'all') return null
      const forced = msg.chains.some((chain) => chain.forced === 1)
      if (forced) {
        if (this.timingPolicy.chain === 'ignore' && msg.chains.length === 1) {
          return msg.prepareResponse(IndexResponse(0))
        }
        return null
      }
      if (msg.chains.length === 0) return msg.defaultResponse()
      return this.timingPolicy.chain === 'ignore' ? msg.defaultResponse() : null
    }

    if (msg instanceof YGOProMsgSelectEffectYn && this.timingPolicy.effectYn === 'never') {
      return msg.prepareResponse(false)
    }

    return null
  }

  private advanceEngine(): Uint8Array[] {
    if (!this.duel) return []

    this.lastAdvanceRetried = false
    this.lastDrawEvents = []
    this.lastDeckShuffles = []
    const autoResponses: Uint8Array[] = []
    let loops = 0

    while (true) {
      loops++
      if (loops > MAX_PROCESS_LOOPS) {
        throw new Error('引擎推进步数超出上限，可能陷入死循环。')
      }

      const res = this.duel.process()
      const msgs = res.messages ?? []
      let autoCandidate: Uint8Array | null = null
      const manualQueries: unknown[] = []

      if (msgs.length > 0) {
        for (const msg of msgs) {
          this.fieldReader.applyMetaMessage(msg)
          if (msg instanceof YGOProMsgHint && msg.type === HINT_TYPE_SELECTMSG) {
            this.lastHintDesc = msg.desc
          }
          if (msg instanceof YGOProMsgShuffleHand) {
            this.accumulatedEvents.push({ kind: 'shuffle-hand', player: msg.player === 1 ? 1 : 0 })
          }
          if (msg instanceof YGOProMsgDraw) {
            this.lastDrawEvents.push({
              player: msg.player === 1 ? 1 : 0,
              codes: msg.cards.map((code: number) => code & 0x7fffffff)
            })
          }
          if (msg instanceof YGOProMsgShuffleDeck) {
            this.lastDeckShuffles.push(msg.player === 1 ? 1 : 0)
          }
        }
        this.collectLogs(msgs)

        for (const msg of msgs) {
          if (!isInteractiveQuery(msg)) continue
          const auto = this.resolveAutoResponse(msg)
          if (auto) {
            autoCandidate = auto
          } else {
            manualQueries.push(msg)
          }
        }

        for (const msg of manualQueries) {
          this.currentPendingMsg = msg
          this.currentPendingRequest = routeRequest(msg, {
            id: `req-${this.requestSeq}`,
            seq: this.requestSeq,
            descHint: this.lastHintDesc
          })
          this.lastHintDesc = undefined
        }

        if (msgs.some((m) => m instanceof YGOProMsgRetry)) {
          this.lastAdvanceRetried = true
          this.accumulatedLogs.push('引擎拒绝了上一次响应 (RETRY)。')
          break
        }
      }

      const autoResponse = manualQueries.length === 0 ? autoCandidate : null
      if (autoResponse) {
        this.currentPendingMsg = null
        this.currentPendingRequest = null
        this.duel.setResponse(autoResponse)
        autoResponses.push(autoResponse)
        continue
      }

      if (res.status === 1) {
        break
      }
      if (res.status === 2 || this.duel.ended) {
        this.currentPendingMsg = null
        this.currentPendingRequest = null
        break
      }
    }

    return autoResponses
  }

  private locationKey(controller: number, location: number, sequence: number): string {
    return `${controller}:${location}:${sequence}`
  }

  private cardSignature(card: EngineCard): string {
    return `${card.controller}:${card.location}:${card.sequence}:${card.code}`
  }

  private alignProvenance(board: EngineBoardState): void {
    for (const card of board.allCards) {
      if (this.provenance.has(card.instanceId)) continue
      const record = this.sequenceProvenance.get(this.cardSignature(card))
      if (record) this.provenance.set(card.instanceId, record)
    }
  }

  private buildInitialCardMap(state: DuelPuzzleState): Map<string, FieldCard> {
    const map = new Map<string, FieldCard>()
    const cards = state.cards.filter((card) => card.code > 0)
    const pzoneSequence = state.masterRule >= 4 ? [0, 4] : [6, 7]

    for (const controller of [0, 1] as const) {
      cards
        .filter((card) => card.controller === controller && card.location === CardLocation.HAND)
        .sort((a, b) => a.sequence - b.sequence)
        .forEach((card, index) =>
          map.set(this.locationKey(controller, CardLocation.HAND, index), card)
        )
      cards
        .filter((card) => card.controller === controller && card.location === CardLocation.DECK)
        .sort((a, b) => a.sequence - b.sequence)
        .forEach((card, index) =>
          map.set(this.locationKey(controller, CardLocation.DECK, index), card)
        )
      cards
        .filter((card) => card.controller === controller && card.location === CardLocation.EXTRA)
        .sort((a, b) => b.sequence - a.sequence)
        .forEach((card, index) =>
          map.set(this.locationKey(controller, CardLocation.EXTRA, index), card)
        )
      cards
        .filter((card) => card.controller === controller && card.location === CardLocation.GRAVE)
        .forEach((card, index) =>
          map.set(this.locationKey(controller, CardLocation.GRAVE, index), card)
        )
      cards
        .filter((card) => card.controller === controller && card.location === CardLocation.REMOVED)
        .forEach((card, index) =>
          map.set(this.locationKey(controller, CardLocation.REMOVED, index), card)
        )
    }

    const takenSzone = new Set<number>()
    for (const card of cards) {
      if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
      if (card.location === CardLocation.FZONE) takenSzone.add(5)
    }
    for (const card of cards) {
      if (card.location === CardLocation.PZONE) {
        const sequence = pzoneSequence[card.sequence]
        if (sequence === undefined || takenSzone.has(sequence)) continue
        takenSzone.add(sequence)
        map.set(this.locationKey(card.controller, CardLocation.SZONE, sequence), card)
        continue
      }
      if (
        card.location === CardLocation.MZONE ||
        card.location === CardLocation.SZONE ||
        card.location === CardLocation.FZONE
      ) {
        const location = card.location === CardLocation.FZONE ? CardLocation.SZONE : card.location
        const sequence = card.location === CardLocation.FZONE ? 5 : card.sequence
        const key = this.locationKey(card.controller, location, sequence)
        if (!map.has(key)) map.set(key, card)
      }
    }
    return map
  }

  private initializeProvenance(board: EngineBoardState): void {
    this.provenance.clear()
    this.drawCounts = [0, 0]
    this.deckDirty = [false, false]
    const puzzleState = this.initParams?.puzzleState
    const initialMap = puzzleState ? this.buildInitialCardMap(puzzleState) : null

    for (const card of board.allCards) {
      const puzzleCard = initialMap?.get(
        this.locationKey(card.controller, card.location, card.sequence)
      )
      const solid = puzzleCard && puzzleCard.code === card.code ? puzzleCard : undefined
      this.provenance.set(card.instanceId, {
        provenance: {
          kind: 'initial',
          controller: solid?.controller ?? card.controller,
          location: solid?.location ?? card.location,
          sequence: solid?.sequence ?? card.sequence,
          code: solid?.code ?? card.code
        },
        origin: solid
          ? { kind: 'initial', puzzleCardId: solid.instanceId, code: solid.code }
          : undefined
      })
    }
  }

  private trackInject(
    before: EngineBoardState,
    after: EngineBoardState,
    opIndex: number,
    command: InjectCommand
  ): void {
    if (command.op !== 'add-card') return
    const beforeIds = new Set(before.allCards.map((card) => card.instanceId))
    const newCards = after.allCards.filter(
      (card) => !beforeIds.has(card.instanceId) && card.code === command.code
    )
    if (newCards.length === 0) return

    const player = after.players[command.player]
    let location = 0
    let sequence = -1
    switch (command.to) {
      case 'hand':
        location = CardLocation.HAND
        sequence = player.hand.length - 1
        break
      case 'deck-top':
        location = CardLocation.DECK
        sequence = (player.deck?.length ?? player.deckCount) - 1
        break
      case 'deck-bottom':
      case 'deck-shuffle':
        location = CardLocation.DECK
        sequence = 0
        break
      case 'grave-top':
      case 'grave-bottom':
        location = CardLocation.GRAVE
        sequence = player.graveyard.length - 1
        break
      case 'removed':
        location = CardLocation.REMOVED
        sequence = player.banished.length - 1
        break
      case 'extra':
        location = CardLocation.EXTRA
        sequence = (player.extra?.length ?? player.extraCount) - 1
        break
      case 'mzone':
        location = CardLocation.MZONE
        sequence = command.sequence ?? -1
        break
      case 'szone':
        location = CardLocation.SZONE
        sequence = command.sequence ?? -1
        break
      case 'fzone':
        location = CardLocation.SZONE
        sequence = 5
        break
    }

    const picked =
      newCards.find((card) => card.location === location && card.sequence === sequence) ??
      newCards.find((card) => card.location === location) ??
      newCards[newCards.length - 1]
    this.provenance.set(picked.instanceId, {
      provenance: {
        kind: 'inject',
        opIndex,
        nodeId: null,
        command: structuredClone(command)
      },
      origin: { kind: 'inject', opIndex }
    })
  }

  private trackAdvance(before: EngineBoardState, after: EngineBoardState, opIndex: number): void {
    const beforeHandIds = [
      new Set(before.players[0].hand.map((card) => card.instanceId)),
      new Set(before.players[1].hand.map((card) => card.instanceId))
    ]
    const drawnIds = new Set<string>()
    const usedDeckIds = new Set<string>()
    const pairs: Array<{
      instanceId: string
      player: 0 | 1
      drawIndex: number
      origin?: ProvenanceOrigin
    }> = []

    for (const event of this.lastDrawEvents) {
      const newHand = after.players[event.player].hand
        .filter((card) => !beforeHandIds[event.player].has(card.instanceId))
        .sort((a, b) => a.sequence - b.sequence)

      for (const rawCode of event.codes) {
        const code = rawCode & 0x7fffffff
        const drawIndex = ++this.drawCounts[event.player]
        const candidate = newHand.find(
          (card) => !drawnIds.has(card.instanceId) && card.code === code
        )
        if (!candidate) continue
        drawnIds.add(candidate.instanceId)

        let base = this.provenance.get(candidate.instanceId)
        let sourceId = candidate.instanceId
        if (!base || base.provenance.kind === 'unknown') {
          const deck = [...(before.players[event.player].deck ?? [])].sort(
            (a, b) => b.sequence - a.sequence
          )
          const deckCard = deck.find(
            (card) =>
              !usedDeckIds.has(card.instanceId) &&
              card.code === code &&
              this.provenance.has(card.instanceId)
          )
          if (deckCard) {
            sourceId = deckCard.instanceId
            base = this.provenance.get(deckCard.instanceId)
          }
        }
        usedDeckIds.add(sourceId)
        pairs.push({
          instanceId: candidate.instanceId,
          player: event.player,
          drawIndex,
          origin: base?.origin
        })
      }
    }

    this.updateDeckDirty(before, after, drawnIds)

    for (const pair of pairs) {
      this.provenance.set(pair.instanceId, {
        provenance: {
          kind: 'drawn',
          opIndex,
          nodeId: null,
          player: pair.player,
          drawIndex: pair.drawIndex
        },
        origin: pair.origin,
        orderStable: !this.deckDirty[pair.player]
      })
    }

    const beforeIds = new Set(before.allCards.map((card) => card.instanceId))
    for (const card of after.allCards) {
      if (beforeIds.has(card.instanceId)) continue
      if (drawnIds.has(card.instanceId)) continue
      if (this.provenance.has(card.instanceId)) continue
      this.provenance.set(card.instanceId, { provenance: { kind: 'unknown' } })
    }
  }

  private updateDeckDirty(
    before: EngineBoardState,
    after: EngineBoardState,
    drawnIds: Set<string>
  ): void {
    for (const player of [0, 1] as const) {
      if (this.lastDeckShuffles.includes(player)) {
        this.deckDirty[player] = true
      }

      const beforeDeck = before.players[player].deck ?? []
      const afterDeck = after.players[player].deck ?? []
      const beforeById = new Map(beforeDeck.map((card) => [card.instanceId, card]))
      const afterIds = new Set(afterDeck.map((card) => card.instanceId))
      const beforeIds = new Set(beforeDeck.map((card) => card.instanceId))

      const common = afterDeck.filter((card) => beforeById.has(card.instanceId))
      const beforeOrder = [...common]
        .sort(
          (a, b) =>
            (beforeById.get(a.instanceId)?.sequence ?? 0) -
            (beforeById.get(b.instanceId)?.sequence ?? 0)
        )
        .map((card) => card.instanceId)
        .join('|')
      const afterOrder = [...common]
        .sort((a, b) => a.sequence - b.sequence)
        .map((card) => card.instanceId)
        .join('|')
      if (beforeOrder !== afterOrder) this.deckDirty[player] = true

      if (
        beforeDeck.some((card) => !afterIds.has(card.instanceId) && !drawnIds.has(card.instanceId))
      ) {
        this.deckDirty[player] = true
      }
      if (afterDeck.some((card) => !beforeIds.has(card.instanceId))) {
        this.deckDirty[player] = true
      }
    }
  }

  private resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null {
    let board: EngineBoardState
    try {
      board = this.getBoardState()
    } catch {
      return null
    }
    this.alignProvenance(board)
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

  private nodeIdForOp(opIndex: number): string | null {
    const path = this.timeline.getHistoryPath()
    const exact = path.find((node) => node.opIndex === opIndex)
    if (exact) return exact.id
    const later = path.find((node) => node.opIndex > opIndex)
    if (later) return later.id
    const nodes = this.timeline.getAllNodes().filter((node) => node.opIndex === opIndex)
    return nodes.length > 0 ? nodes[nodes.length - 1].id : null
  }

  getProvenance(ref: EngineCardRef): EngineProvenance {
    const resolved = this.resolveCard(ref)
    if (!resolved) return { kind: 'unknown' }
    const record = this.provenance.get(resolved.instanceId)
    if (!record) return { kind: 'unknown' }
    if (record.provenance.kind === 'inject' || record.provenance.kind === 'drawn') {
      return {
        ...record.provenance,
        nodeId: this.nodeIdForOp(record.provenance.opIndex)
      }
    }
    return record.provenance
  }

  replaceCard(ref: EngineCardRef, newCode: number): EngineCardEditResult {
    return this.editCard(ref, { type: 'replace', code: newCode })
  }

  removeCard(ref: EngineCardRef): EngineCardEditResult {
    return this.editCard(ref, { type: 'remove' })
  }

  private editCard(
    ref: EngineCardRef,
    action: { type: 'replace'; code: number } | { type: 'remove' }
  ): EngineCardEditResult {
    if (!this.duel || this.duel.ended) {
      return { error: '当前没有进行中的对局。' }
    }
    const current = this.timeline.getCurrentStep()
    if (!current) return { error: '时间线为空，无法编辑。' }

    const resolved = this.resolveCard(ref)
    if (!resolved) return { error: '无法定位该卡片，可能已离开当前场地。' }
    const record = this.provenance.get(resolved.instanceId)
    if (!record || record.provenance.kind === 'unknown') {
      return { error: '该卡无法安全溯源（可能由效果生成或移动），不能替换或移除。' }
    }
    if (record.provenance.kind === 'drawn' && record.orderStable === false) {
      return {
        error: '该卡抽到前卡组顺序已被洗牌或检索改变，无法安全定位初始卡组条目。'
      }
    }
    const origin = record.origin
    if (!origin) return { error: '该卡没有可编辑的初始来源。' }

    if (action.type === 'replace') {
      if (!cdbService.getCardById(action.code)) {
        return { error: `卡片 ${action.code} 不存在于卡片数据库。` }
      }
    }

    if (origin.kind === 'inject') {
      const op = this.ops[origin.opIndex]
      if (op?.type !== 'inject' || op.command.op !== 'add-card') {
        return { error: '来源注入记录不存在，无法编辑。' }
      }
    } else {
      const state = this.initParams?.puzzleState
      if (!state) return { error: '该对局未使用初始牌局快照，无法编辑初始卡组条目。' }
      const target = state.cards.find((card) => card.instanceId === origin.puzzleCardId)
      if (!target) return { error: '初始牌局中找不到该卡记录。' }
      if (target.code !== origin.code) {
        return { error: '初始牌局记录与来源不一致，已取消编辑。' }
      }
    }

    const currentStepId = current.node.id
    this.truncateToCurrentStep()
    const previousOps = structuredClone(this.ops)
    const previousInitParams = structuredClone(this.initParams)

    try {
      if (origin.kind === 'inject') {
        const op = this.ops[origin.opIndex]
        if (op?.type !== 'inject' || op.command.op !== 'add-card') {
          throw new Error('来源注入记录不存在，无法编辑。')
        }
        this.ops[origin.opIndex] =
          action.type === 'remove'
            ? { ...op, removed: true }
            : { ...op, command: { ...op.command, code: action.code } }
      } else {
        const nextState = structuredClone(this.initParams!.puzzleState!)
        const target = nextState.cards.find((card) => card.instanceId === origin.puzzleCardId)
        if (!target) throw new Error('初始牌局中找不到该卡记录。')
        if (action.type === 'remove') {
          nextState.cards = nextState.cards.filter(
            (card) => card.instanceId !== origin.puzzleCardId
          )
        } else {
          target.code = action.code
          target.card = cdbService.getCardById(action.code) ?? target.card
        }
        this.initParams = { ...this.initParams!, puzzleState: nextState }
      }

      this.replayTo(currentStepId, true)
      const boardState = this.readBoard()
      const node = this.timeline.getStep(currentStepId)?.node
      if (!node) throw new Error('编辑后找不到当前步骤。')
      node.boardState = boardState
      node.pendingRequest = this.currentPendingRequest
      this.updateEditedNode(node, action, origin)

      return {
        boardState,
        pendingRequest: this.currentPendingRequest,
        node,
        currentStepId
      }
    } catch (err) {
      this.ops = previousOps
      this.initParams = previousInitParams
      try {
        this.replayTo(currentStepId, true)
      } catch {
        void err
      }
      return { error: err instanceof Error ? err.message : '重演失败，已回滚编辑。' }
    }
  }

  private updateEditedNode(
    node: EngineTimelineNode,
    action: { type: 'replace'; code: number } | { type: 'remove' },
    origin: ProvenanceOrigin
  ): void {
    if (origin.kind !== 'inject') return
    const editNode =
      this.timeline.getAllNodes().find((item) => item.opIndex === origin.opIndex) ?? node
    if (editNode.opIndex !== origin.opIndex) return
    const oldName = editNode.title.match(/「([^」]*)」$/)?.[1] ?? '卡片'
    if (action.type === 'remove') {
      editNode.title = `剧情安排：移除「${oldName}」`
      editNode.logs = [`[剧情安排] 已移除「${oldName}」`]
      return
    }
    const newName = cdbService.getCardById(action.code)?.name ?? String(action.code)
    editNode.title = editNode.title.replace(/「[^」]*」$/, `「${newName}」`)
    editNode.logs = editNode.logs.map((log) => log.replace(/「[^」]*」$/, `「${newName}」`))
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
    if (this.duel && !this.duel.ended) {
      return this.readBoard()
    }
    return this.fieldReader.getState()
  }

  getPendingRequest(): EngineRequest | null {
    return this.currentPendingRequest
  }

  getAllTimelineResponses(): Uint8Array[] {
    const lastOpIndex = this.timeline.getCurrentStep()?.node.opIndex ?? -1
    return this.ops
      .slice(0, lastOpIndex + 1)
      .flatMap((op) => (op.type === 'inject' ? [] : op.responses))
  }
}

export const duelSession = new DuelSession()
