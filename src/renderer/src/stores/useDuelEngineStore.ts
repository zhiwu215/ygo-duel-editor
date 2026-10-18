import { create } from 'zustand'
import {
  EngineBoardState,
  EngineTimelineNode,
  EngineDuelInitParams,
  EngineDiffResult,
  CardLocation,
  CdbCard,
  FieldCard,
  DuelActionType,
  DuelPhase,
  DuelPuzzleState,
  DuelStep,
  createLightweightSnapshot,
  EngineRequest,
  Answer,
  RequestCard,
  EngineSubmitAnswerResult,
  EngineCardEditResult,
  EngineCardRef,
  EngineProvenance,
  InjectCommand,
  resolveEngineCardStats,
  DEFAULT_TIMING_POLICY,
  TimingPolicy,
  normalizeTimingPolicy
} from '@shared/index'
import { useDuelStore } from './useDuelStore'

export type EngineMode = 'idle' | 'running' | 'paused'

export interface EngineInjectNotice {
  kind: 'success' | 'warning'
  message: string
}

/** 手牌切洗信号：id 变化即代表引擎刚刚切洗了 players 的手牌（UI 据此播放洗牌动画与提示） */
export interface HandShuffleSignal {
  id: number
  players: (0 | 1)[]
}

interface DuelEngineState {
  engineMode: EngineMode
  isInitialized: boolean
  loading: boolean
  error: string | null
  injectNotice: EngineInjectNotice | null
  handShuffle: HandShuffleSignal | null
  timingPolicy: TimingPolicy

  boardState: EngineBoardState | null
  pendingRequest: EngineRequest | null
  /** 最近一次攻击宣言的攻击者（渲染端记录，供攻击目标选择文案使用；未攻击/重开时为空） */
  lastAttacker: RequestCard | null
  timeline: EngineTimelineNode[]
  currentStepId: string | null

  selectedCardId: string | null
  hoveredCard: CdbCard | null
  hoveredInstanceId: string | null

  backupDuelState: DuelPuzzleState | null

  startEngine: () => Promise<void>
  stopEngine: (revertToSnapshot?: boolean) => void

  initDuel: (params?: EngineDuelInitParams) => Promise<void>
  setTimingPolicy: (policy: TimingPolicy) => void
  loadTimingPolicy: () => Promise<TimingPolicy>
  submitAnswer: (answer: Answer) => Promise<void>
  inject: (command: InjectCommand) => Promise<boolean>
  clearInjectNotice: () => void
  getProvenance: (ref: EngineCardRef) => Promise<EngineProvenance>
  replaceCard: (ref: EngineCardRef, newCode: number) => Promise<boolean>
  removeCard: (ref: EngineCardRef) => Promise<boolean>
  jumpToStep: (stepId: string) => Promise<boolean>
  undo: () => Promise<void>
  redo: () => Promise<void>

  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null, instanceId?: string | null) => void

  canUndo: () => boolean
  canRedo: () => boolean
}

function mapPhaseToDuelPhase(phase: number): DuelPhase {
  if (phase === 1) return 'DP'
  if (phase === 2) return 'SP'
  if (phase === 4) return 'M1'
  if ([8, 16, 32, 64, 128].includes(phase)) return 'BP'
  if (phase === 256) return 'M2'
  if (phase === 512) return 'EP'
  return 'M1'
}

function applyEngineWrite(apply: () => void): void {
  const duelStore = useDuelStore.getState()
  const prevState = duelStore.state
  duelStore.pauseUndoTracking()
  try {
    apply()
  } finally {
    duelStore.resumeAndPushUndo(structuredClone(prevState))
  }
}

function syncJumpToStepWrapped(boardState: EngineBoardState): void {
  applyEngineWrite(() => syncJumpToStepToDuelStore(boardState))
}

function syncJumpToStepToDuelStore(boardState: EngineBoardState): void {
  const duelStore = useDuelStore.getState()
  const currentCards = [...duelStore.state.cards]
  const engineById = new Map(boardState.allCards.map((c) => [c.instanceId, c]))
  // 位置匹配兜底：引擎 instanceId（card-N）与编辑器 uuid 不同源时按位置对齐，
  // 保留编辑器 instanceId（自建卡数据/悬浮绑定不丢失）
  const engineByPos = new Map(
    boardState.allCards.map((c) => [`${c.controller}:${c.location}:${c.sequence}`, c])
  )
  // 身份映射反查：编辑器 instanceId → 引擎 instanceId。
  // 已建立映射的卡片即使换了位置（跳转/回退后）也能被找回，不必靠位置撞。
  const editorToEngineId = new Map<string, string>()
  for (const [engineId, editorId] of engineToEditorId) {
    editorToEngineId.set(editorId, engineId)
  }
  const usedEngineIds = new Set<string>()

  for (const card of currentCards) {
    const mappedEngineId = editorToEngineId.get(card.instanceId)
    const ec =
      engineById.get(card.instanceId) ??
      (mappedEngineId ? engineById.get(mappedEngineId) : undefined) ??
      engineByPos.get(`${card.controller}:${card.location}:${card.sequence}`)
    if (!ec) {
      duelStore.removeCard(card.instanceId)
      continue
    }
    usedEngineIds.add(ec.instanceId)
    // 若是位置匹配（id 不同源），登记 id 映射：引擎卡换位/回退后仍能找回编辑器身份
    if (ec.instanceId !== card.instanceId) {
      engineToEditorId.set(ec.instanceId, card.instanceId)
    }

    if (card.code !== ec.code) {
      useDuelStore.setState((prev) => ({
        ...prev,
        state: {
          ...prev.state,
          cards: prev.state.cards.map((item) =>
            item.instanceId === card.instanceId
              ? { ...item, code: ec.code, card: ec.card ?? item.card }
              : item
          )
        }
      }))
      card.code = ec.code
      if (ec.card) card.card = ec.card
    }

    if (
      card.location !== ec.location ||
      card.sequence !== ec.sequence ||
      card.controller !== ec.controller
    ) {
      duelStore.moveCard(card.instanceId, ec.location, ec.sequence, ec.controller, ec.position)
      card.location = ec.location
      card.sequence = ec.sequence
      card.controller = ec.controller
      card.position = ec.position
    } else if (card.position !== ec.position) {
      duelStore.updateCardPosition(card.instanceId, ec.position)
      card.position = ec.position
    }

    if (ec.location === CardLocation.MZONE && ec.location === card.location) {
      const engineMats = ec.overlayMaterials
      const editorMats = card.overlayMaterials
      if (engineMats.join(',') !== editorMats.join(',')) {
        for (let i = editorMats.length - 1; i >= 0; i--) {
          duelStore.removeOverlayMaterial(card.instanceId, i)
        }
        for (const mat of engineMats) {
          duelStore.addOverlayMaterial(card.instanceId, mat)
        }
        card.overlayMaterials = [...engineMats]
      }
    }
  }

  for (const ec of boardState.allCards) {
    if (usedEngineIds.has(ec.instanceId)) continue
    if (currentCards.some((c) => c.instanceId === ec.instanceId)) continue
    if (!ec.card) {
      // 正常情况下 field-reader 已用 cdbService 填充卡数据；为空说明库缺这张卡，
      // 静默跳过会导致卡面缺失（表现为“场上不更新”），至少留一条现场日志。
      console.warn(
        `[useDuelEngineStore] 引擎卡 ${ec.instanceId} (code=${ec.code}) 缺少 CDB 数据，无法补进棋盘。`
      )
      continue
    }
    duelStore.addCardToZone(
      ec.card,
      ec.controller,
      ec.location,
      ec.sequence,
      ec.position,
      undefined,
      ec.instanceId
    )
    currentCards.push({
      instanceId: ec.instanceId,
      code: ec.card.id,
      card: ec.card,
      controller: ec.controller,
      owner: ec.owner,
      location: ec.location,
      sequence: ec.sequence,
      position: ec.position,
      overlayMaterials: [...ec.overlayMaterials]
    })
  }

  duelStore.setPlayerLp(0, boardState.players[0].lp)
  duelStore.setPlayerLp(1, boardState.players[1].lp)
  duelStore.setCurrentPhase(mapPhaseToDuelPhase(boardState.phase))
  duelStore.setTurnPlayer(boardState.turnPlayer)
  duelStore.setCurrentTurn(boardState.turn)

  const editorCards = new Map(useDuelStore.getState().state.cards.map((c) => [c.instanceId, c]))
  for (const ec of boardState.allCards) {
    const stats = resolveEngineCardStats(ec)
    if (!stats) continue
    const editorId = engineToEditorId.get(ec.instanceId) ?? ec.instanceId
    const card = editorCards.get(editorId)
    if (!card) continue
    if (card.customAtk === stats.customAtk && card.customDef === stats.customDef) continue
    duelStore.setCardCustomStats(editorId, stats.customAtk, stats.customDef)
  }
}

/** 引擎步骤的动作语义键（Answer → DuelActionType 的中间映射） */
type EngineStepAction =
  | 'SUMMON'
  | 'SPSUMMON'
  | 'MSET'
  | 'SSET'
  | 'ACTIVATE'
  | 'REPOS'
  | 'ATTACK'
  | 'BP'
  | 'M2'
  | 'EP'
  | 'CHAIN'

const ENGINE_STEP_TYPES: Partial<Record<EngineStepAction, DuelActionType>> = {
  SUMMON: 'NORMAL_SUMMON',
  SPSUMMON: 'SPECIAL_SUMMON',
  MSET: 'SET_MONSTER',
  SSET: 'SET_SPELL_TRAP',
  ACTIVATE: 'ACTIVATE',
  REPOS: 'CHANGE_POS',
  ATTACK: 'ATTACK',
  BP: 'PHASE_CHANGE',
  M2: 'PHASE_CHANGE',
  EP: 'PHASE_CHANGE',
  CHAIN: 'CHAIN'
}

const engineSteps = new Map<string, DuelStep>()
/**
 * 引擎 instanceId (card-N) → 编辑器 instanceId 的映射（位置对齐时建立）。
 * 全量对账（submitAnswer/jumpToStep）与手牌排序都靠它找回编辑器身份 —— 不再供增量 diff 使用。
 */
const engineToEditorId = new Map<string, string>()

/**
 * 按引擎手牌顺序重排编辑器手牌（S1 身份对齐）。
 *
 * 引擎手牌数组顺序即引擎 sequence 顺序；每张引擎卡优先用 engineToEditorId 找回编辑器身份，
 * 映射缺失时按 (controller, location, sequence) 精确对位 —— 不做 code 兜底（同名卡无法区分）。
 * 引擎未同步出棋盘快照时返回 null，调用方保持原有本地排序。
 */
export function orderEditorCardsByEngineHand(
  controller: 0 | 1,
  editorCards: FieldCard[],
  boardState: EngineBoardState | null
): FieldCard[] | null {
  if (!boardState) return null
  const engineHand = boardState.players[controller]?.hand
  if (!engineHand) return null

  const editorById = new Map(editorCards.map((c) => [c.instanceId, c]))
  const used = new Set<string>()
  const ordered: FieldCard[] = []

  for (const engineCard of engineHand) {
    const mappedId = engineToEditorId.get(engineCard.instanceId)
    const mapped = mappedId ? editorById.get(mappedId) : undefined
    const card =
      mapped ??
      editorCards.find(
        (c) =>
          !used.has(c.instanceId) &&
          c.controller === engineCard.controller &&
          c.location === CardLocation.HAND &&
          c.sequence === engineCard.sequence
      )
    if (!card || used.has(card.instanceId)) continue
    used.add(card.instanceId)
    ordered.push(card)
  }

  // 引擎手牌未覆盖的编辑器卡追加在末尾（引擎/编辑器偶发不同步时不丢卡）
  for (const card of editorCards) {
    if (!used.has(card.instanceId)) ordered.push(card)
  }
  return ordered
}

function humanizeEngineLog(text: string): string {
  return text.replace(/^Player 0: /, '我方：').replace(/^Player 1: /, '对方：')
}

/** 参与步骤记录的卡片引用（idle/battle/chain 的答案卡） */
function answerCardOf(answer: Answer): RequestCard | undefined {
  if (answer.kind === 'idle' || answer.kind === 'battle') return answer.card
  if (answer.kind === 'chain') return answer.card ?? undefined
  return undefined
}

function answerToEngineStepAction(answer: Answer): EngineStepAction | undefined {
  if (answer.kind === 'idle') {
    const map: Partial<Record<string, EngineStepAction>> = {
      SUMMON: 'SUMMON',
      SPSUMMON: 'SPSUMMON',
      MSET: 'MSET',
      SSET: 'SSET',
      REPOS: 'REPOS',
      ACTIVATE: 'ACTIVATE',
      TO_BP: 'BP',
      TO_EP: 'EP'
    }
    return map[answer.cmd]
  }
  if (answer.kind === 'battle') {
    const map: Partial<Record<string, EngineStepAction>> = {
      ATTACK: 'ATTACK',
      ACTIVATE: 'ACTIVATE',
      TO_M2: 'M2',
      TO_EP: 'EP'
    }
    return map[answer.cmd]
  }
  if (answer.kind === 'chain') return answer.card ? 'CHAIN' : undefined
  return undefined
}

/** 在编辑器卡表里按卡密找一个名称（步骤展示用；同名无碍，只取名字），卡表缺数据时退回引擎侧 CDB 数据 */
function cardNameOfCode(code: number): string | undefined {
  const editorName = useDuelStore.getState().state.cards.find((c) => c.code === code)?.card?.name
  if (editorName) return editorName
  return useDuelEngineStore.getState().boardState?.allCards.find((c) => c.code === code)?.card?.name
}

/**
 * PLACE 答案没有独立步骤：放置格位补丁到父步骤（召唤/盖放/发动那一步）上。
 */
function patchPlacementStep(
  answer: Extract<Answer, { kind: 'place' }>,
  node: EngineTimelineNode
): void {
  const place = answer.places[0]
  if (!place || !node.parentId) return
  const stored = engineSteps.get(node.parentId)
  if (!stored) return
  const duelStore = useDuelStore.getState()
  const patched: DuelStep = {
    ...stored,
    toLocation: place.location,
    toSequence: place.sequence,
    boardAfter: createLightweightSnapshot(duelStore.state.cards)
  }
  engineSteps.set(node.parentId, patched)
  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      steps: (prev.state.steps || []).map((s) => (s.actId === node.parentId ? patched : s))
    }
  }))
}

/**
 * CARD 选择结果的步骤补丁：装备对象 / 攻击对象等「选择目标」本身没有独立步骤，
 * 回填到最近的祖先动作步骤上，步骤列表才能显示选中的对象。
 */
function patchTargetStep(
  selected: RequestCard[],
  node: EngineTimelineNode,
  timeline: EngineTimelineNode[],
  boardState: EngineBoardState | null
): void {
  if (selected.length === 0) return
  const byId = new Map(timeline.map((n) => [n.id, n]))
  let cursor = node.parentId ? byId.get(node.parentId) : undefined
  while (cursor && !engineSteps.has(cursor.id)) {
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  if (!cursor) return
  const stored = engineSteps.get(cursor.id)
  if (!stored) return

  const first = selected[0]
  const engineId = boardState?.allCards.find(
    (c) =>
      c.code === first.code &&
      c.controller === first.controller &&
      c.location === first.location &&
      c.sequence === first.sequence
  )?.instanceId
  const names = selected
    .map((c) => cardNameOfCode(c.code))
    .filter((name): name is string => Boolean(name))

  const patched: DuelStep = {
    ...stored,
    targetInstanceId:
      (engineId ? engineToEditorId.get(engineId) : undefined) ??
      engineId ??
      stored.targetInstanceId,
    targetCardName: names.length > 0 ? names.join('、') : stored.targetCardName,
    targetPlayer: first.controller
  }
  const hostId = cursor.id
  engineSteps.set(hostId, patched)
  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      steps: (prev.state.steps || []).map((s) => (s.actId === hostId ? patched : s))
    }
  }))
}

/** 从语义 Answer 直接记录引擎步骤（DuelStep 即 answer 的权威语义） */
function appendEngineStepFromAnswer(
  answer: Answer,
  node: EngineTimelineNode,
  diff: EngineDiffResult,
  timeline: EngineTimelineNode[],
  boardState: EngineBoardState | null
): void {
  if (answer.kind === 'place') {
    patchPlacementStep(answer, node)
    return
  }

  if (answer.kind === 'card') {
    patchTargetStep(answer.cards ?? [], node, timeline, boardState)
    return
  }

  const actionKey = answerToEngineStepAction(answer)
  if (!actionKey) return
  const actionType = ENGINE_STEP_TYPES[actionKey]
  if (!actionType || engineSteps.has(node.id)) return

  const card = answerCardOf(answer)
  const moved = card
    ? diff.movedCards.find(
        (m) =>
          m.code === card.code &&
          m.fromController === card.controller &&
          m.fromLocation === card.location &&
          m.fromSequence === card.sequence
      )
    : undefined

  const duelStoreState = useDuelStore.getState()
  const step: Omit<DuelStep, 'id'> = {
    turn: duelStoreState.currentTurn,
    turnPlayer: duelStoreState.activeTurnPlayer,
    phase: duelStoreState.currentPhase,
    actionPlayer: node.player,
    actionType,
    actId: node.id,
    cardCode: card?.code,
    cardName: card ? cardNameOfCode(card.code) : undefined,
    fromLocation: card?.location,
    fromSequence: card?.sequence,
    toLocation: moved?.toLocation ?? card?.location,
    toSequence: moved?.toSequence ?? card?.sequence,
    chainIndex: actionType === 'CHAIN' ? duelStoreState.currentChain + 1 : undefined,
    description: humanizeEngineLog(node.title),
    boardAfter: createLightweightSnapshot(duelStoreState.state.cards)
  }
  useDuelStore.getState().addStep(step)
  const added = useDuelStore.getState().state.steps?.at(-1)
  if (added) engineSteps.set(node.id, added)
}

function timelinePath(timeline: EngineTimelineNode[], stepId: string): EngineTimelineNode[] {
  const byId = new Map(timeline.map((n) => [n.id, n]))
  const path: EngineTimelineNode[] = []
  let current = byId.get(stepId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

function syncEngineSteps(timeline: EngineTimelineNode[], stepId: string): void {
  const path = timelinePath(timeline, stepId)
  const valid = new Set(path.map((n) => n.id))
  useDuelStore.setState((prev) => {
    const steps = prev.state.steps || []
    const kept = steps.filter((s) => !s.actId || valid.has(s.actId))
    const present = new Set(kept.map((s) => s.actId).filter((id): id is string => Boolean(id)))
    const restored = path
      .filter((n) => engineSteps.has(n.id) && !present.has(n.id))
      .map((n) => engineSteps.get(n.id)!)
    if (kept.length === steps.length && restored.length === 0) return prev
    return {
      ...prev,
      state: { ...prev.state, steps: [...kept, ...restored] }
    }
  })
}

async function applyCardEditResult(
  get: () => DuelEngineState,
  set: (partial: Partial<DuelEngineState>) => void,
  res: EngineCardEditResult,
  successMessage: string
): Promise<boolean> {
  if (res.error) {
    set({ loading: false, error: res.error })
    return false
  }

  const prevTimeline = get().timeline
  const currentId = get().currentStepId
  const currentIndex = prevTimeline.findIndex((node) => node.id === currentId)
  const baseTimeline = currentIndex >= 0 ? prevTimeline.slice(0, currentIndex + 1) : prevTimeline
  const node = res.node
  const timeline = node
    ? baseTimeline.some((item) => item.id === node.id)
      ? baseTimeline.map((item) => (item.id === node.id ? node : item))
      : [...baseTimeline, node]
    : baseTimeline
  const currentStepId = res.currentStepId ?? node?.id ?? currentId

  set({
    loading: false,
    error: null,
    boardState: res.boardState ?? get().boardState,
    pendingRequest: res.pendingRequest ?? null,
    timeline,
    currentStepId,
    selectedCardId: null,
    injectNotice: {
      kind: res.warning ? 'warning' : 'success',
      message: res.warning ?? successMessage
    }
  })
  if (res.boardState) syncJumpToStepWrapped(res.boardState)
  if (currentStepId) syncEngineSteps(timeline, currentStepId)

  const latestTimeline = await window.api.duelEngineGetTimeline().catch(() => null)
  if (latestTimeline) {
    set({ timeline: latestTimeline })
    const stepId = get().currentStepId
    if (stepId) syncEngineSteps(latestTimeline, stepId)
  }
  return true
}

export const useDuelEngineStore = create<DuelEngineState>((set, get) => ({
  engineMode: 'idle',
  isInitialized: false,
  loading: false,
  error: null,
  injectNotice: null,
  handShuffle: null,
  timingPolicy: { ...DEFAULT_TIMING_POLICY },

  boardState: null,
  pendingRequest: null,
  lastAttacker: null,
  timeline: [],
  currentStepId: null,

  selectedCardId: null,
  hoveredCard: null,
  hoveredInstanceId: null,

  backupDuelState: null,

  setTimingPolicy: (policy) => {
    const normalized = normalizeTimingPolicy(policy)
    set({ timingPolicy: normalized })
    void window.api.duelEngineSetPolicy(normalized).catch((err) => {
      console.error('[useDuelEngineStore] setTimingPolicy failed:', err)
    })
    void window.api.saveConfig({ timingPolicy: normalized }).catch((err) => {
      console.error('[useDuelEngineStore] save timingPolicy failed:', err)
    })
  },

  loadTimingPolicy: async () => {
    try {
      const config = await window.api.getConfig()
      const policy = normalizeTimingPolicy(config.timingPolicy)
      set({ timingPolicy: policy })
      return policy
    } catch (err) {
      console.error('[useDuelEngineStore] loadTimingPolicy failed:', err)
      return get().timingPolicy
    }
  },

  startEngine: async () => {
    set({ loading: true, error: null })
    try {
      const currentDuelState = structuredClone(useDuelStore.getState().state)
      set({ backupDuelState: currentDuelState })
      await window.api.duelEngineSetPolicy(get().timingPolicy)

      const initParams: EngineDuelInitParams = {
        puzzleState: currentDuelState
      }

      const res = await window.api.duelEngineInit(initParams)
      engineSteps.clear()
      engineToEditorId.clear()
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        boardState: res.boardState,
        pendingRequest: res.pendingRequest,
        lastAttacker: null,
        timeline,
        currentStepId: res.initialNode.id
      })
      // 引擎是唯一真相：把引擎开局的真实场面全量同步进棋盘显示
      syncJumpToStepWrapped(res.boardState)
      syncEngineSteps(timeline, res.initialNode.id)
    } catch (err) {
      console.error('[useDuelEngineStore] startEngine failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        error: err instanceof Error ? err.message : '启动决斗引擎失败'
      })
    }
  },

  stopEngine: (revertToSnapshot = false) => {
    engineSteps.clear()
    engineToEditorId.clear()
    const backup = get().backupDuelState
    if (revertToSnapshot && backup) {
      useDuelStore.setState((prev) => ({
        ...prev,
        state: structuredClone(backup)
      }))
    }
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      error: null,
      injectNotice: null,
      handShuffle: null,
      pendingRequest: null,
      lastAttacker: null,
      backupDuelState: null,
      selectedCardId: null
    })
  },

  initDuel: async (params = {}) => {
    set({ loading: true, error: null })
    try {
      const initParams: EngineDuelInitParams = {
        ...params
      }
      if (!initParams.puzzleState && !initParams.p0Deck) {
        initParams.puzzleState = structuredClone(useDuelStore.getState().state)
        set({ backupDuelState: initParams.puzzleState })
      }
      await window.api.duelEngineSetPolicy(get().timingPolicy)

      const res = await window.api.duelEngineInit(initParams)
      engineSteps.clear()
      engineToEditorId.clear()
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        boardState: res.boardState,
        pendingRequest: res.pendingRequest,
        lastAttacker: null,
        timeline,
        currentStepId: res.initialNode.id
      })
      // 引擎是唯一真相：把引擎开局的真实场面全量同步进棋盘显示
      syncJumpToStepWrapped(res.boardState)
      syncEngineSteps(timeline, res.initialNode.id)
    } catch (err) {
      console.error('[useDuelEngineStore] initDuel failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        error: err instanceof Error ? err.message : '初始化决斗引擎失败'
      })
    }
  },

  submitAnswer: async (answer) => {
    if (!get().pendingRequest) return
    set({ loading: true, error: null })
    try {
      const res: EngineSubmitAnswerResult = await window.api.duelEngineSubmitAnswer(answer)
      if (res.retry) {
        // 引擎拒绝：请求保持待答，面板重新打开（提示非法操作）
        set({
          loading: false,
          pendingRequest: res.pendingRequest ?? get().pendingRequest,
          error: '该操作不合法，已被引擎拒绝，请重新选择。'
        })
        return
      }
      const prevTimeline = get().timeline
      const currentId = get().currentStepId
      const currentIndex = prevTimeline.findIndex((node) => node.id === currentId)
      const baseTimeline =
        currentIndex >= 0 ? prevTimeline.slice(0, currentIndex + 1) : prevTimeline
      const newTimeline = res.node ? [...baseTimeline, res.node] : prevTimeline
      const shuffledPlayers = [
        ...new Set(
          (res.node?.events ?? [])
            .filter((event) => event.kind === 'shuffle-hand')
            .map((event) => event.player)
        )
      ]
      set({
        loading: false,
        error: null,
        boardState: res.boardState ?? get().boardState,
        pendingRequest: res.pendingRequest ?? null,
        lastAttacker:
          answer.kind === 'battle' && answer.cmd === 'ATTACK' && answer.card
            ? answer.card
            : get().lastAttacker,
        timeline: newTimeline,
        currentStepId: res.node?.id ?? get().currentStepId,
        handShuffle:
          shuffledPlayers.length > 0
            ? { id: Date.now(), players: shuffledPlayers }
            : get().handShuffle,
        selectedCardId: null
      })
      if (res.boardState) {
        // 引擎是唯一真相：与跳转/回退共用同一套全量对账（身份映射 + 精确位置 reconcile，
        // 未匹配删除 / 新出现添加 / 位置/素材/LP/回合阶段同步）。
        // 不再走增量 diff 补丁 —— 身份映射缺失时增量路径会“加卡忘删卡 / 移动丢目标”，
        // 表现为特殊召唤后场上不更新、回退后才可见、手牌多一张等漂移。
        syncJumpToStepWrapped(res.boardState)
      }
      if (res.node) {
        syncEngineSteps(newTimeline, res.node.id)
      }
      if (res.node && res.diff) {
        // res.diff 仅用于步骤记录（推导 to 位置），不再用于棋盘同步
        appendEngineStepFromAnswer(answer, res.node, res.diff, newTimeline, res.boardState ?? null)
      }
    } catch (err) {
      console.error('[useDuelEngineStore] submitAnswer failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '提交操作失败'
      })
    }
  },

  inject: async (command) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法执行剧情安排。' })
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineInject(command)
      const prevTimeline = get().timeline
      const currentId = get().currentStepId
      const currentIndex = prevTimeline.findIndex((node) => node.id === currentId)
      const baseTimeline =
        currentIndex >= 0 ? prevTimeline.slice(0, currentIndex + 1) : prevTimeline
      set({
        loading: false,
        error: null,
        boardState: res.boardState,
        timeline: [...baseTimeline, res.node],
        currentStepId: res.node.id,
        selectedCardId: null,
        injectNotice: {
          kind: res.warning ? 'warning' : 'success',
          message: res.warning ? `${res.node.title}：${res.warning}` : res.node.title
        }
      })
      syncJumpToStepWrapped(res.boardState)
      syncEngineSteps(get().timeline, res.node.id)
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] inject failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '剧情安排执行失败'
      })
      return false
    }
  },

  clearInjectNotice: () => set({ injectNotice: null }),

  getProvenance: async (ref) => {
    if (!get().isInitialized) return { kind: 'unknown' }
    try {
      return await window.api.duelEngineGetProvenance(ref)
    } catch (err) {
      console.error('[useDuelEngineStore] getProvenance failed:', err)
      return { kind: 'unknown' }
    }
  },

  replaceCard: async (ref, newCode) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法编辑卡片。' })
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineReplaceCard(ref, newCode)
      return await applyCardEditResult(get, set, res, '已替换卡片并重演到当前步骤。')
    } catch (err) {
      console.error('[useDuelEngineStore] replaceCard failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '替换卡片失败'
      })
      return false
    }
  },

  removeCard: async (ref) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法编辑卡片。' })
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineRemoveCard(ref)
      return await applyCardEditResult(get, set, res, '已从对局中移除该卡并重演到当前步骤。')
    } catch (err) {
      console.error('[useDuelEngineStore] removeCard failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '移除卡片失败'
      })
      return false
    }
  },

  jumpToStep: async (stepId: string): Promise<boolean> => {
    if (!get().timeline.some((node) => node.id === stepId)) {
      console.warn(`[useDuelEngineStore] 步骤 ${stepId} 不在当前引擎时间线，已跳过跳转`)
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineJumpToStep(stepId)
      // 跳转/回退后引擎会重新推进到下一个询问；pendingRequest 不在 jump 返回值里，
      // 必须单独取回，否则新分发层会残留跳转前的旧询问面板。
      const pendingRequest = await window.api
        .duelEngineGetPendingRequest()
        .catch(() => get().pendingRequest)
      set({
        loading: false,
        boardState: res.boardState,
        pendingRequest,
        currentStepId: res.currentStepId,
        selectedCardId: null
      })
      syncJumpToStepWrapped(res.boardState)
      syncEngineSteps(get().timeline, res.currentStepId)
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] jumpToStep failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '回退/跳转步骤失败'
      })
      return false
    }
  },

  undo: async () => {
    const { timeline, currentStepId, jumpToStep } = get()
    if (!currentStepId || timeline.length === 0) return
    const currentIndex = timeline.findIndex((n) => n.id === currentStepId)
    if (currentIndex > 0) {
      const prevNode = timeline[currentIndex - 1]
      await jumpToStep(prevNode.id)
    }
  },

  redo: async () => {
    const { timeline, currentStepId, jumpToStep } = get()
    if (!currentStepId || timeline.length === 0) return
    const currentIndex = timeline.findIndex((n) => n.id === currentStepId)
    if (currentIndex >= 0 && currentIndex < timeline.length - 1) {
      const nextNode = timeline[currentIndex + 1]
      await jumpToStep(nextNode.id)
    }
  },

  setSelectedCardId: (id) => set({ selectedCardId: id }),

  setHoveredCard: (card, instanceId) =>
    set({
      hoveredCard: card,
      hoveredInstanceId: instanceId !== undefined ? instanceId : get().hoveredInstanceId
    }),

  canUndo: () => {
    const { timeline, currentStepId } = get()
    if (!currentStepId || timeline.length <= 1) return false
    const idx = timeline.findIndex((n) => n.id === currentStepId)
    return idx > 0
  },

  canRedo: () => {
    const { timeline, currentStepId } = get()
    if (!currentStepId || timeline.length === 0) return false
    const idx = timeline.findIndex((n) => n.id === currentStepId)
    return idx >= 0 && idx < timeline.length - 1
  }
}))
