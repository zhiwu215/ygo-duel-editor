import {
  OcgcoreWrapper,
  OcgcoreDuel,
  OcgcoreDuelOptionFlag,
  OcgcoreDuelRule,
  _OcgcoreConstants
} from 'koishipro-core.js'
import {
  YGOProMsgDraw,
  YGOProMsgNewTurn,
  YGOProMsgDamage,
  YGOProMsgRecover,
  YGOProMsgRetry
} from 'ygopro-msg-encode'
import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  CardLocation,
  DuelPuzzleState
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { FieldReader } from './field-reader'
import { EngineTimelineManager } from './timeline-manager'
import { getOcgcoreEngine } from './ocgcore-engine'
import { isInteractiveQuery, isEmptyChainQuery } from './message-parser'
import { computeDiff } from './diff-resolver'
import { routeRequest } from './request-router'
import { encodeAnswer, describeAnswer } from './answer-encoder'
import { Answer, EngineRequest, EngineSubmitAnswerResult } from '@shared/engine/protocol'
import { YGOProMsgHint, YGOProMsgSelectChain } from 'ygopro-msg-encode'

const HINT_TYPE_SELECTMSG = 3

export interface SubmitAnswerResult extends EngineSubmitAnswerResult {}

const { OcgcoreScriptConstants } = _OcgcoreConstants

const MAX_PROCESS_LOOPS = 10000
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
  private lastAdvanceRetried = false
  private seed: number[] = []
  private initParams: EngineDuelInitParams | null = null
  private responses = new Map<string, Uint8Array>()

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

  private createDuelFromInit(): void {
    if (!this.initParams) {
      throw new Error('引擎会话尚未初始化。')
    }
    this.duel = this.ocgcore!.createDuelV2(this.seed)
    if (this.initParams.puzzleState) {
      this.setupFromPuzzleState(this.initParams.puzzleState)
    } else {
      this.setupFromDeckParams(this.initParams)
    }
    this.advanceEngine()
  }

  private replayTo(stepId: string): void {
    const path = this.timeline.getHistoryPath(stepId)
    if (path.length === 0) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    const currentPath = this.timeline.getHistoryPath()
    const canStepForward =
      currentPath.length + 1 === path.length &&
      path.slice(0, currentPath.length).every((n, i) => n.id === currentPath[i].id)
    if (canStepForward && this.duel && !this.duel.ended) {
      const response = this.responses.get(path[path.length - 1].id)
      if (response) {
        this.duel.setResponse(response)
        this.advanceEngine()
        this.accumulatedLogs = []
        this.timeline.setCurrentStepId(stepId)
        return
      }
    }

    this.disposeDuel()
    this.accumulatedLogs = []
    this.createDuelFromInit()

    for (let i = 1; i < path.length; i++) {
      const response = this.responses.get(path[i].id)
      if (!response) {
        throw new Error(`步骤 ${path[i].id} 缺少响应记录，无法重放。`)
      }
      this.duel!.setResponse(response)
      this.advanceEngine()
    }

    this.accumulatedLogs = []
    this.timeline.setCurrentStepId(stepId)
  }

  async startDuel(params: EngineDuelInitParams): Promise<{
    boardState: EngineBoardState
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }> {
    await this.init()

    this.disposeDuel()

    this.timeline.clear()
    this.responses.clear()
    this.accumulatedLogs = []
    this.currentPendingMsg = null
    this.currentPendingRequest = null
    this.requestSeq = 1
    this.lastHintDesc = undefined

    this.seed = params.seed || [
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000)
    ]
    this.initParams = params

    this.createDuelFromInit()

    const initialBoard = this.readBoard()
    const initialNode = this.timeline.addStep(
      '决斗开局',
      initialBoard.turnPlayer,
      initialBoard,
      this.currentPendingRequest,
      [...this.accumulatedLogs]
    )
    this.accumulatedLogs = []

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

    const beforeBoard = this.readBoard()
    this.duel.setResponse(response)
    this.advanceEngine()

    if (this.lastAdvanceRetried) {
      this.accumulatedLogs = []
      return { retry: true, pendingRequest: this.currentPendingRequest }
    }

    this.accumulatedLogs.push(logText)

    const boardState = this.readBoard()
    const diff = computeDiff(beforeBoard, boardState)

    const node = this.timeline.addStep(
      logText,
      actingPlayer,
      boardState,
      this.currentPendingRequest,
      [...this.accumulatedLogs]
    )
    this.responses.set(node.id, response)
    this.requestSeq += 1
    this.accumulatedLogs = []

    return {
      retry: false,
      boardState,
      pendingRequest: this.currentPendingRequest,
      node,
      diff
    }
  }

  async jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }> {
    if (!this.timeline.getStep(stepId)) {
      throw new Error(`步骤 ${stepId} 不存在。`)
    }

    this.replayTo(stepId)

    return {
      boardState: this.readBoard(),
      currentStepId: stepId
    }
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
      let autoResponse: Uint8Array | null = null
      // 批内已含玩家交互点时，不允许自动应答吞掉交互。
      // 空连锁（无可连锁卡）会在下面被静默放弃，因此不算交互点 —— 否则空连锁自己
      // 就会触发这个守卫，让 autoResponse 永远不生效，全部变成 UI 弹窗。
      const hasInteractiveInBatch = msgs.some(
        (m) => isInteractiveQuery(m) && !isEmptyChainQuery(m)
      )

      if (msgs.length > 0) {
        for (const msg of msgs) {
          this.fieldReader.applyMetaMessage(msg)
          if (msg instanceof YGOProMsgHint && msg.type === HINT_TYPE_SELECTMSG) {
            this.lastHintDesc = msg.desc
          }
          // 空连锁询问自动放弃（无可连锁卡时引擎仍会询问，不自动处理会卡死）
          if (msg instanceof YGOProMsgSelectChain && msg.chains.length === 0) {
            autoResponse = msg.defaultResponse()
          }
        }
        this.collectLogs(msgs)

        for (const msg of msgs) {
          // 空连锁已被自动放弃（见上方 autoResponse），不注册为待答请求，避免 UI 空弹窗
          if (!isInteractiveQuery(msg) || isEmptyChainQuery(msg)) continue
          this.currentPendingMsg = msg
          this.currentPendingRequest = routeRequest(msg, {
            id: `req-${this.requestSeq}`,
            seq: this.requestSeq,
            descHint: this.lastHintDesc
          })
        }

        if (msgs.some((m) => m instanceof YGOProMsgRetry)) {
          this.lastAdvanceRetried = true
          this.accumulatedLogs.push('引擎拒绝了上一次响应 (RETRY)。')
          break
        }
      }

      // 自动应答排队：喂回引擎并继续推进（仅当批内没有交互点时）
      if (autoResponse && !hasInteractiveInBatch) {
        this.duel.setResponse(autoResponse)
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
    return this.timeline
      .getHistoryPath()
      .slice(1)
      .map((n) => this.responses.get(n.id))
      .filter((r): r is Uint8Array => Boolean(r))
  }
}

export const duelSession = new DuelSession()
