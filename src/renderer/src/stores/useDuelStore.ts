import { create } from 'zustand'
import { temporal } from 'zundo'
import {
  DuelPuzzleState,
  FieldCard,
  MasterRule,
  PlayerState,
  createInitialDuelState,
  CardLocation,
  CardPosition,
  CardType,
  CdbCard,
  DuelStep,
  DuelPhase,
  DuelActionType,
  Duelist,
  MatchConfig,
  DuelSceneSnapshot,
  getMatchScenarioKey,
  createDefaultDuelists,
  normalizeDuelState,
  createLightweightSnapshot,
  LightweightCardSnapshot,
  AgentBoardLpTarget,
  ResolvedBoardPlacement,
  replayStepsBoard,
  DeckData,
  DuelType,
  allocateCustomCounterId
} from '@shared/index'
import { inferMoveAction, inferPositionChangeAction } from '../utils/duelActionInference'
import { alertDialog } from './useDialogStore'
import {
  PendingAction,
  PendingActionKind,
  PendingPlacement,
  PendingPlacementMode,
  PendingPlacementSlot,
  resolveBattle,
  resolveDirectAttack
} from '../utils/duelActionTargets'

interface BoardLayoutResult {
  players: [PlayerState, PlayerState]
  duelists: Duelist[]
  cards: FieldCard[]

  initialSnapshot: LightweightCardSnapshot[] | null
  selectedInstanceId: string | null
  hoveredCard: CdbCard | null
}

export interface MoveCardParams {
  instanceId: string
  toLocation: number
  toSequence: number
  toController?: 0 | 1
  customPos?: number
  targetDuelistId?: string
}

/**
 * 单张卡移动的纯计算：给定盘面返回「移动后」的状态片段，不主动 set。
 * 抽出来的目的是让「顶掉旧卡 + 新卡落场」这类多步动作能在**一次 set** 内完成，
 * 从而只产生一条撤销历史（分两次 set 会让 Ctrl+Z 要按两次）。
 */
function applyMoveCard(prev: DuelStoreState, params: MoveCardParams): Partial<DuelStoreState> {
  const { instanceId, toLocation, toSequence, toController, customPos, targetDuelistId } = params
  const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
  if (!targetCard) return {}

  const ctrl = toController !== undefined ? toController : targetCard.controller

  const isPileZone =
    toLocation === CardLocation.HAND ||
    toLocation === CardLocation.GRAVE ||
    toLocation === CardLocation.DECK ||
    toLocation === CardLocation.EXTRA ||
    toLocation === CardLocation.REMOVED

  let assignedDuelistId = targetDuelistId
  if (isPileZone && !assignedDuelistId) {
    const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === ctrl)
    assignedDuelistId =
      targetCard.duelistId ||
      teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
      teamDuelists[0]?.id ||
      (ctrl === 0 ? 'duelist_0_0' : 'duelist_1_0')
  }

  let seq = toSequence
  let updatedCards = prev.state.cards

  if (isPileZone) {
    const targetPiles = prev.state.cards
      .filter((c) => {
        if (c.controller !== ctrl || c.location !== toLocation || c.instanceId === instanceId) {
          return false
        }
        if (isPileZone && assignedDuelistId) {
          return c.duelistId === assignedDuelistId
        }
        return true
      })
      .sort((a, b) => a.sequence - b.sequence)

    const insertIdx =
      toSequence !== undefined && toSequence >= 0 && toSequence <= targetPiles.length
        ? toSequence
        : targetPiles.length
    seq = insertIdx

    if (insertIdx < targetPiles.length) {
      const seqShiftMap = new Map<string, number>()
      targetPiles.forEach((c, idx) => {
        if (idx >= insertIdx) {
          seqShiftMap.set(c.instanceId, idx + 1)
        }
      })
      updatedCards = prev.state.cards.map((c) => {
        if (seqShiftMap.has(c.instanceId)) {
          return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
        }
        return c
      })
    }
  }

  const sameZone = targetCard.location === toLocation
  let newPos = targetCard.position
  if (customPos !== undefined) {
    newPos = customPos
  } else if (!sameZone) {
    if (toLocation === CardLocation.SZONE) {
      newPos = CardPosition.FACEDOWN
    } else if (toLocation === CardLocation.MZONE) {
      newPos = CardPosition.FACEUP_ATTACK
    } else if (toLocation === CardLocation.HAND) {
      newPos = CardPosition.FACEDOWN
    } else if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) {
      newPos = CardPosition.FACEDOWN
    } else if (
      toLocation === CardLocation.GRAVE ||
      toLocation === CardLocation.REMOVED ||
      toLocation === CardLocation.PZONE
    ) {
      newPos = CardPosition.FACEUP
    }
  }

  const finalCards = updatedCards.map((c) => {
    if (c.instanceId === instanceId) {
      return {
        ...c,
        location: toLocation,
        sequence: seq,
        controller: ctrl,
        position: newPos,
        duelistId: isPileZone ? assignedDuelistId : c.duelistId
      }
    }
    return c
  })

  let nextSteps = prev.state.steps || []
  let nextChain = prev.currentChain

  if (prev.isAutoRecording) {
    const inferred = inferMoveAction({
      fromLocation: targetCard.location,
      fromSequence: targetCard.sequence,
      toLocation,
      toSequence: seq,
      fromPosition: targetCard.position,
      finalPosition: newPos,
      actionPlayer: ctrl,
      cardCode: targetCard.code,
      cardName: targetCard.card?.name,
      cardType: targetCard.card?.type,
      currentPhase: prev.currentPhase,
      currentChain: prev.currentChain
    })

    if (inferred) {
      if (inferred.chainIndex) {
        nextChain = inferred.chainIndex
      }
      const newStep: DuelStep = {
        id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        turn: prev.currentTurn,
        turnPlayer: prev.activeTurnPlayer,
        phase: prev.currentPhase,
        actionPlayer: ctrl,
        actionType: inferred.actionType,
        instanceId,
        cardCode: targetCard.code,
        cardName: targetCard.card?.name,
        fromLocation: targetCard.location,
        fromSequence: targetCard.sequence,
        toLocation,
        toSequence: seq,
        chainIndex: inferred.chainIndex,
        description: inferred.description,
        boardAfter: createLightweightSnapshot(finalCards)
      }
      nextSteps = [...nextSteps, newStep]
    }
  }

  return {
    currentChain: nextChain,
    state: {
      ...prev.state,
      cards: finalCards,
      steps: nextSteps,
      initialBoardSnapshot:
        prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
    }
  }
}

/** 场地魔法在本项目 MR1~3 约定里的落点：SZONE seq 5 */
const FIELD_ZONE_SEQ = 5

/** 判断一张卡是否为场地魔法（需 CDB 数据齐全，同时带 SPELL 与 FIELD 位） */
function isFieldSpellCard(card: FieldCard): boolean {
  if (!card.card) return false
  const t = card.card.type
  return (t & CardType.SPELL) !== 0 && (t & CardType.FIELD) !== 0
}

/** 找落点上原有的卡（仅场地魔法位需要「顶掉」，其余格子由拖拽/空位逻辑保证不重叠） */
function findZoneOccupant(
  cards: FieldCard[],
  controller: 0 | 1,
  location: number,
  sequence: number
): FieldCard | undefined {
  if (location !== CardLocation.SZONE || sequence !== FIELD_ZONE_SEQ) return undefined
  return cards.find(
    (c) =>
      c.controller === controller &&
      c.location === CardLocation.SZONE &&
      c.sequence === FIELD_ZONE_SEQ
  )
}

function buildLayoutFromSetup(
  state: DuelPuzzleState,
  activeDuelistId: string | null,
  params: {
    lp: AgentBoardLpTarget[]
    cards: ResolvedBoardPlacement[]
    clearExisting?: boolean
  }
): BoardLayoutResult {
  const baseDuelists =
    state.duelists && state.duelists.length > 0
      ? state.duelists
      : createDefaultDuelists(
          state.matchConfig?.team0Count ?? 1,
          state.matchConfig?.team1Count ?? 1
        )

  const sharedLp = Boolean(state.matchConfig?.sharedLp)
  const nextLpBySide = new Map<0 | 1, number>()
  params.lp.forEach((t) => {
    const v = Math.max(0, Math.trunc(t.lp))
    nextLpBySide.set(t.side, v)
  })
  const duelists = baseDuelists.map((d) => {
    if (!nextLpBySide.has(d.team)) return d
    const v = nextLpBySide.get(d.team)!
    const sameTeam = baseDuelists.filter((x) => x.team === d.team)
    return sharedLp || sameTeam.length <= 1 ? { ...d, lp: v } : d
  })

  params.lp.forEach((t) => {
    if (!t.duelistName) return
    const idx = duelists.findIndex((d) => d.name === t.duelistName)
    if (idx >= 0) {
      duelists[idx] = { ...duelists[idx], lp: Math.max(0, Math.trunc(t.lp)) }
    }
  })
  const players: [PlayerState, PlayerState] = [
    nextLpBySide.has(0) ? { ...state.players[0], lp: nextLpBySide.get(0)! } : state.players[0],
    nextLpBySide.has(1) ? { ...state.players[1], lp: nextLpBySide.get(1)! } : state.players[1]
  ]

  const clearExisting = Boolean(params.clearExisting)
  let workingCards = clearExisting ? [] : [...state.cards]
  let selectedInstanceId: string | null = null
  let hoveredCard: CdbCard | null = null
  const unresolvedDuelists: string[] = []

  params.cards.forEach((c) => {
    const location = c.location
    const isPileZone =
      location === CardLocation.HAND ||
      location === CardLocation.GRAVE ||
      location === CardLocation.DECK ||
      location === CardLocation.EXTRA ||
      location === CardLocation.REMOVED
    const isOwnerScopedZone = isPileZone

    let duelistId = c.duelistId
    if (!duelistId && c.duelistName) {
      const hit = baseDuelists.find((d) => d.name === c.duelistName)
      if (hit) duelistId = hit.id
      else unresolvedDuelists.push(c.duelistName)
    }
    if (isOwnerScopedZone && !duelistId) {
      const teamDuelists = baseDuelists.filter((d) => d.team === c.controller)
      duelistId =
        teamDuelists.find((d) => d.id === activeDuelistId)?.id ||
        teamDuelists[0]?.id ||
        (c.controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
    }

    const newCard: FieldCard = {
      instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      code: c.card.id,
      card: c.card,
      controller: c.controller,
      owner: c.controller,
      location,
      sequence: 0,
      position: c.position,
      overlayMaterials: [],
      duelistId: isOwnerScopedZone ? duelistId : undefined,
      customAtk: c.customAtk,
      customDef: c.customDef
    }

    if (isPileZone) {
      const pileSize = workingCards.filter(
        (x) =>
          x.controller === c.controller &&
          x.location === location &&
          (!isOwnerScopedZone || x.duelistId === newCard.duelistId)
      ).length
      newCard.sequence = pileSize
      workingCards.push(newCard)
    } else {
      workingCards = workingCards.filter(
        (x) =>
          !(x.controller === c.controller && x.location === location && x.sequence === c.sequence)
      )
      newCard.sequence = c.sequence
      workingCards.push(newCard)
    }
    selectedInstanceId = newCard.instanceId
    hoveredCard = newCard.card ?? null
  })

  if (unresolvedDuelists.length > 0) {
    console.warn(
      '[useDuelStore] 布局落位未找到决斗者，已回落到阵营首位:',
      unresolvedDuelists.join(', ')
    )
  }

  return {
    players,
    duelists,
    cards: workingCards,
    initialSnapshot: clearExisting ? createLightweightSnapshot(workingCards) : null,
    selectedInstanceId,
    hoveredCard
  }
}

interface DuelStoreState {
  applyDeckToPlayer: (player: 0 | 1, deck: DeckData, drawCount?: number, duelistId?: string) => void

  state: DuelPuzzleState
  expandedDuelistId: string | null
  setExpandedDuelistId: (id: string | null) => void

  activeDuelistId: string | null
  setActiveDuelistId: (id: string | null) => void

  switchMatchConfig: (config: MatchConfig) => void
  updateDuelist: (duelistId: string, patch: Partial<Duelist>) => void
  setFirstDuelist: (duelistId: string) => void
  setDuelistTurnOrder: (duelistId: string, newOrder: number) => void
  toggleSharedLp: () => void

  selectedCardId: string | null
  pendingAction: PendingAction | null
  beginAction: (kind: PendingActionKind, sourceId: string) => void
  toggleActionTarget: (instanceId: string) => void
  setActionTargetPlayer: (player: 0 | 1) => void
  commitPendingAction: () => void
  cancelPendingAction: () => void

  /** 「发动 / 盖放」放置待选模式：选择卡 → 点场上空槽才落子 */
  pendingPlacement: PendingPlacement | null
  beginPlacement: (mode: PendingPlacementMode, sourceId: string) => void
  cancelPlacement: () => void
  commitPlacement: (slot: PendingPlacementSlot) => void
  activeStatPopoverCardId: string | null
  statPopoverPosition: { x: number; y: number } | null
  hoveredCard: CdbCard | null
  hoveredInstanceId: string | null
  tacticalView: boolean

  activeLeftTab: 'archives' | 'library' | 'card' | 'agent'
  isLeftOpen: boolean
  leftWidth: number
  setActiveLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void
  setLeftOpen: (open: boolean) => void
  toggleLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void
  setLeftWidth: (width: number) => void
  loadProjectAndStart: (state: DuelPuzzleState) => void

  /** 当前编辑的工程文件绝对路径；null 表示「新建未保存」状态，Ctrl+S 需要弹模态 */
  currentProjectPath: string | null
  setCurrentProjectPath: (filePath: string | null) => void

  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  isScreenplayOpen: boolean
  selectedStepId: string | null

  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  isAutoRecording: boolean

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  nextPhase: () => void
  nextTurn: () => void
  setActiveTurnPlayer: (player: 0 | 1) => void
  setIsAutoRecording: (recording: boolean) => void
  previewStepBoard: (stepIndex: number | null) => void

  recordAction: (params: {
    actionType: DuelActionType
    card?: { code: number; name?: string }
    actionPlayer?: 0 | 1
    fromLocation?: number
    fromSequence?: number
    toLocation?: number
    toSequence?: number
    chainIndex?: number
    description?: string
  }) => void

  executeActivateCard: (
    instanceId: string,
    placement?: { location: number; sequence: number; controller?: 0 | 1; position?: number }
  ) => void
  executeChainCard: (instanceId: string) => void
  executeAttackCard: (instanceId: string, targetInstanceId?: string) => void
  executeNormalSummon: (instanceId: string) => void
  executeSpecialSummon: (instanceId: string) => void
  executeSetCard: (
    instanceId: string,
    placement?: { location: number; sequence: number; controller?: 0 | 1; position?: number }
  ) => void
  executeDrawCard: (controller: 0 | 1) => void
  executeSendToGrave: (instanceId: string) => void
  executeBanishCard: (instanceId: string) => void

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setIsScreenplayOpen: (open: boolean) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void
  addStep: (step: Omit<DuelStep, 'id'>) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void
  clearSteps: () => void

  setActiveStatPopoverCardId: (id: string | null) => void
  setStatPopoverPosition: (pos: { x: number; y: number } | null) => void
  openStatPopover: (id: string, initialPos?: { x: number; y: number }) => void
  closeStatPopover: () => void

  setMasterRule: (rule: MasterRule) => void

  setDuelType: (type: DuelType) => void
  setSeries: (series: string) => void
  setTitle: (title: string) => void
  setHint: (hint: string) => void
  setPlayerLp: (player: 0 | 1, lp: number) => void
  setTurnPlayer: (player: 0 | 1) => void
  setFirstTurnAttack: (allow: boolean) => void

  addCardToZone: (
    card: CdbCard,
    controller: 0 | 1,
    location: number,
    sequence: number,
    position?: number,
    duelistId?: string
  ) => void

  applyBoardSetup: (params: {
    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
    cards: Array<{
      card: CdbCard
      controller: 0 | 1
      location: number
      sequence: number
      position: number
      duelistName?: string
      duelistId?: string
      customAtk?: number
      customDef?: number
    }>
    clearExisting: boolean
  }) => void

  applyDuelScreenplay: (params: {
    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
    cards: ResolvedBoardPlacement[]
    steps: Array<Omit<DuelStep, 'id'>>
    clearExisting: boolean
  }) => void

  moveCard: (
    instanceId: string,
    toLocation: number,
    toSequence: number,
    toController?: 0 | 1,
    customPos?: number,
    targetDuelistId?: string
  ) => void
  /** 一次 set 内完成多张卡的移动（如「顶掉旧卡 + 新卡落场」），撤销只需一步 */
  moveCards: (moves: MoveCardParams[]) => void
  removeCard: (instanceId: string) => void
  updateCardPosition: (instanceId: string, position: number) => void
  addOverlayMaterial: (targetInstanceId: string, matCode: number) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void

  overlayOnTop: (
    targetInstanceId: string,
    newCardData: CdbCard,
    sourceCardInstanceId?: string
  ) => void

  swapHostWithMaterial: (targetInstanceId: string, matIndex: number) => void

  detachMaterialToLocation: (
    targetInstanceId: string,
    matIndex: number,
    targetLocation: number
  ) => void

  reorderOverlayMaterials: (targetInstanceId: string, fromIndex: number, toIndex: number) => void

  setCardData: (instanceId: string, card: CdbCard) => void

  reorderPileCards: (
    controller: 0 | 1,
    location: number,
    fromIndex: number,
    toIndex: number,
    duelistId?: string
  ) => void

  reorderHandCards: (
    controller: 0 | 1,
    duelistId: string,
    movingInstanceId: string,
    targetInstanceId: string,
    insertAfter: boolean
  ) => void

  setCardCounter: (instanceId: string, counterType: number, count: number) => void
  removeCardCounter: (instanceId: string, counterType: number) => void
  clearCardCounters: (instanceId: string) => void
  registerCustomCounter: (name: string) => number
  setCardCustomStats: (instanceId: string, customAtk?: number, customDef?: number) => void

  toggleTacticalView: () => void
  setTacticalView: (enabled: boolean) => void

  loadState: (newState: DuelPuzzleState) => void
  resetDuel: () => void
  swapSides: () => void

  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null) => void
  setHoveredInstanceId: (id: string | null) => void
}

export const useDuelStore = create<DuelStoreState>()(
  temporal(
    (set, get) => ({
      state: createInitialDuelState(5),
      expandedDuelistId: null,
      activeDuelistId: null,
      selectedCardId: null,
      pendingAction: null,
      pendingPlacement: null,
      activeStatPopoverCardId: null,
      statPopoverPosition: null,
      hoveredCard: null,
      hoveredInstanceId: null,
      tacticalView: false,
      activeLeftTab: 'card',
      isLeftOpen: true,
      leftWidth: 340,
      activeRightTab: 'search',
      currentStepIndex: null,
      isScreenplayOpen: false,
      selectedStepId: null,
      currentProjectPath: null,

      setCurrentProjectPath: (filePath) => set({ currentProjectPath: filePath }),

      setExpandedDuelistId: (id) => set({ expandedDuelistId: id }),
      setActiveDuelistId: (id) => set({ activeDuelistId: id }),

      currentTurn: 1,
      currentPhase: 'M1',
      currentChain: 0,
      activeTurnPlayer: 0,
      isAutoRecording: true,

      setCurrentTurn: (turn) => set({ currentTurn: turn }),
      setCurrentPhase: (phase) => set({ currentPhase: phase }),
      setCurrentChain: (chain) => set({ currentChain: chain }),
      resetChain: () =>
        set((prev) => {
          if (prev.currentChain === 0) return prev
          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: prev.activeTurnPlayer,
                actionType: 'RESOLVE_CHAIN',
                description: `连锁结算 (Chain ${prev.currentChain} ~ Chain 1 依次处理)`,
                boardAfter: createLightweightSnapshot(prev.state.cards)
              }
            ]
          }
          return {
            currentChain: 0,
            state: { ...prev.state, steps: nextSteps }
          }
        }),
      nextPhase: () =>
        set((prev) => {
          const phases: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']
          const curIdx = phases.indexOf(prev.currentPhase)
          let nextSteps = prev.state.steps || []

          if (curIdx < phases.length - 1) {
            const targetPhase = phases[curIdx + 1]
            if (prev.isAutoRecording) {
              const phaseLabel =
                targetPhase === 'DP'
                  ? '抽卡阶段'
                  : targetPhase === 'SP'
                    ? '准备阶段'
                    : targetPhase === 'M1'
                      ? '主要阶段1'
                      : targetPhase === 'BP'
                        ? '战斗阶段'
                        : targetPhase === 'M2'
                          ? '主要阶段2'
                          : '结束阶段'
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: targetPhase,
                  actionPlayer: prev.activeTurnPlayer,
                  actionType: 'PHASE_CHANGE',
                  description: `进入${phaseLabel}`,
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }
            return {
              currentPhase: targetPhase,
              currentChain: 0,
              state: { ...prev.state, steps: nextSteps }
            }
          } else {
            const nextTurn = prev.currentTurn + 1
            const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
            const pName = nextActive === 0 ? '我方' : '对方'
            if (prev.isAutoRecording) {
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: nextTurn,
                  turnPlayer: nextActive,
                  phase: 'DP',
                  actionPlayer: nextActive,
                  actionType: 'TURN_CHANGE',
                  description: `回合结束，进入第 ${nextTurn} 回合 (${pName}回合)`,
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }
            return {
              currentTurn: nextTurn,
              currentPhase: 'DP',
              currentChain: 0,
              activeTurnPlayer: nextActive,
              state: {
                ...prev.state,
                steps: nextSteps
              }
            }
          }
        }),
      nextTurn: () =>
        set((prev) => {
          const nextTurn = prev.currentTurn + 1
          const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
          const pName = nextActive === 0 ? '我方' : '对方'
          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: nextTurn,
                turnPlayer: nextActive,
                phase: 'DP',
                actionPlayer: nextActive,
                actionType: 'TURN_CHANGE',
                description: `进入第 ${nextTurn} 回合 (${pName}回合)`,
                boardAfter: createLightweightSnapshot(prev.state.cards)
              }
            ]
          }
          return {
            currentTurn: nextTurn,
            currentPhase: 'DP',
            currentChain: 0,
            activeTurnPlayer: nextActive,
            state: {
              ...prev.state,
              steps: nextSteps
            }
          }
        }),
      setActiveTurnPlayer: (player) => set({ activeTurnPlayer: player }),
      setIsAutoRecording: (recording) => set({ isAutoRecording: recording }),

      previewStepBoard: (stepIndex) =>
        set((prev) => {
          if (stepIndex === null) {
            const snap = prev.state.initialBoardSnapshot
            if (!snap) return { currentStepIndex: null }
            const cardMap = new Map(prev.state.cards.map((c) => [c.instanceId, c]))
            const restoredCards: FieldCard[] = snap.map((s) => {
              const existing = cardMap.get(s.instanceId)
              return {
                instanceId: s.instanceId,
                code: s.code,
                card: existing?.card,
                controller: s.controller,
                owner: s.owner ?? s.controller,
                location: s.location,
                sequence: s.sequence,
                position: s.position,
                overlayMaterials: [...(s.overlayMaterials || [])],
                duelistId: s.duelistId,
                customAtk: s.customAtk,
                customDef: s.customDef
              }
            })
            return {
              currentStepIndex: null,
              state: { ...prev.state, cards: restoredCards }
            }
          }

          const steps = prev.state.steps || []
          const targetStep = steps[stepIndex]
          if (!targetStep || !targetStep.boardAfter) {
            return { currentStepIndex: stepIndex }
          }

          const cardMap = new Map(prev.state.cards.map((c) => [c.instanceId, c]))
          const restoredCards: FieldCard[] = targetStep.boardAfter.map((s) => {
            const existing = cardMap.get(s.instanceId)
            return {
              instanceId: s.instanceId,
              code: s.code,
              card: existing?.card,
              controller: s.controller,
              owner: s.owner ?? s.controller,
              location: s.location,
              sequence: s.sequence,
              position: s.position,
              overlayMaterials: [...(s.overlayMaterials || [])],
              duelistId: s.duelistId,
              customAtk: s.customAtk,
              customDef: s.customDef
            }
          })

          const lpChange = targetStep.lpChange
          let nextPlayers = prev.state.players
          if (lpChange) {
            const players: [PlayerState, PlayerState] = [...prev.state.players]
            const target = players[lpChange.player]
            if (target) {
              players[lpChange.player] = { ...target, lp: lpChange.newLp }
            }
            nextPlayers = players
          }

          return {
            currentStepIndex: stepIndex,
            pendingAction: null,
            pendingPlacement: null,
            currentTurn: targetStep.turn,
            currentPhase: targetStep.phase,
            currentChain: targetStep.chainIndex ?? 0,
            activeTurnPlayer: targetStep.turnPlayer,
            state: { ...prev.state, cards: restoredCards, players: nextPlayers }
          }
        }),

      recordAction: (params) =>
        set((prev) => {
          const newStep: DuelStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: prev.currentTurn,
            turnPlayer: prev.activeTurnPlayer,
            phase: prev.currentPhase,
            actionPlayer: params.actionPlayer ?? prev.activeTurnPlayer,
            actionType: params.actionType,
            cardCode: params.card?.code,
            cardName: params.card?.name,
            fromLocation: params.fromLocation,
            fromSequence: params.fromSequence,
            toLocation: params.toLocation,
            toSequence: params.toSequence,
            chainIndex: params.chainIndex,
            description: params.description,
            boardAfter: createLightweightSnapshot(prev.state.cards)
          }
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: [...existing, newStep],
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      beginAction: (kind, sourceId) =>
        set((prev) => {
          const card = prev.state.cards.find((c) => c.instanceId === sourceId)
          if (!card) return prev
          return {
            selectedCardId: sourceId,
            pendingAction: {
              kind,
              sourceId,
              sourceName: card.card?.name || String(card.code),
              sourceController: card.controller,
              targetIds: [],
              targetPlayer: null
            }
          }
        }),

      toggleActionTarget: (instanceId) =>
        set((prev) => {
          if (!prev.pendingAction) return prev
          const exists = prev.pendingAction.targetIds.includes(instanceId)
          return {
            pendingAction: {
              ...prev.pendingAction,
              targetIds: exists
                ? prev.pendingAction.targetIds.filter((id) => id !== instanceId)
                : [...prev.pendingAction.targetIds, instanceId],
              targetPlayer: null
            }
          }
        }),

      setActionTargetPlayer: (player) =>
        set((prev) => {
          if (!prev.pendingAction) return prev
          return {
            pendingAction: { ...prev.pendingAction, targetIds: [], targetPlayer: player }
          }
        }),

      cancelPendingAction: () => set({ pendingAction: null, pendingPlacement: null }),

      commitPendingAction: () => {
        const { pendingAction, executeAttackCard, executeActivateCard } = useDuelStore.getState()
        if (!pendingAction) return
        if (pendingAction.kind === 'ATTACK') {
          executeAttackCard(pendingAction.sourceId, pendingAction.targetIds[0])
        } else {
          executeActivateCard(pendingAction.sourceId)
        }
        set({ pendingAction: null, pendingPlacement: null })
      },

      executeActivateCard: (instanceId, placement) => {
        const { state, moveCards, updateCardPosition } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        if (card.location === CardLocation.HAND) {
          let targetLocation: number = CardLocation.SZONE
          let targetSeq: number
          if (placement) {
            targetLocation = placement.location
            targetSeq = placement.sequence
          } else if (isFieldSpellCard(card)) {
            // 场地魔法：固定去 SZONE seq 5 (本项目 MR1~3 约定)
            targetSeq = FIELD_ZONE_SEQ
          } else {
            // 普通魔法/陷阱：取第一个空闲的 SZONE seq 0~4
            const occupiedSeqs = state.cards
              .filter((c) => c.controller === card.controller && c.location === CardLocation.SZONE)
              .map((c) => c.sequence)
            targetSeq = [0, 1, 2, 3, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
          }

          const targetController = placement?.controller ?? card.controller
          const targetPos = placement?.position ?? CardPosition.FACEUP
          const displaced = findZoneOccupant(state.cards, targetController, targetLocation, targetSeq)
          const moves: MoveCardParams[] = []
          if (displaced && displaced.instanceId !== instanceId) {
            moves.push({
              instanceId: displaced.instanceId,
              toLocation: CardLocation.GRAVE,
              toSequence: 999,
              toController: displaced.controller
            })
          }
          moves.push({
            instanceId,
            toLocation: targetLocation,
            toSequence: targetSeq,
            toController: placement?.controller,
            customPos: targetPos
          })
          moveCards(moves)
        } else if (card.location === CardLocation.SZONE) {
          updateCardPosition(instanceId, CardPosition.FACEUP)
        } else {
          const { currentTurn, currentPhase, currentChain, activeTurnPlayer } =
            useDuelStore.getState()
          const nextChain = currentChain + 1
          const pName = card.controller === 0 ? '我方' : '对方'
          const cName = card.card?.name || (card.code ? String(card.code) : '卡片')
          const newStep: DuelStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: currentTurn,
            turnPlayer: activeTurnPlayer,
            phase: currentPhase,
            actionPlayer: card.controller,
            actionType: 'ACTIVATE',
            instanceId,
            cardCode: card.code,
            cardName: card.card?.name,
            fromLocation: card.location,
            fromSequence: card.sequence,
            chainIndex: nextChain,
            description: `${pName}发动【${cName}】效果 (Chain ${nextChain})`,
            boardAfter: createLightweightSnapshot(state.cards)
          }
          set((prev) => ({
            currentChain: nextChain,
            state: {
              ...prev.state,
              steps: [...(prev.state.steps || []), newStep],
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }))
        }
      },

      executeChainCard: (instanceId) => {
        useDuelStore.getState().executeActivateCard(instanceId)
      },

      beginPlacement: (mode, sourceId) => {
        const { state } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === sourceId)
        if (!card || card.location !== CardLocation.HAND) return

        const cardType = card.card?.type ?? 0
        const isMonster = card.card !== undefined ? (cardType & CardType.MONSTER) !== 0 : false

        const allowedSlots: PendingPlacementSlot[] = []
        const controller = card.controller

        if (isFieldSpellCard(card)) {
          // 场地魔法：仅 SZONE seq 5。该格已有卡也可选——落子时会顶掉旧卡送去墓地。
          allowedSlots.push({
            location: CardLocation.SZONE,
            sequence: FIELD_ZONE_SEQ,
            controller,
            displaces: true
          })
        } else if (isMonster) {
          // 怪兽：MZONE seq 0~4 中空位
          for (let seq = 0; seq <= 4; seq++) {
            const taken = state.cards.some(
              (c) =>
                c.controller === controller &&
                c.location === CardLocation.MZONE &&
                c.sequence === seq
            )
            if (!taken) {
              allowedSlots.push({ location: CardLocation.MZONE, sequence: seq, controller })
            }
          }
        } else {
          // 魔法陷阱：SZONE seq 0~4 中空位
          for (let seq = 0; seq <= 4; seq++) {
            const taken = state.cards.some(
              (c) =>
                c.controller === controller &&
                c.location === CardLocation.SZONE &&
                c.sequence === seq
            )
            if (!taken) {
              allowedSlots.push({ location: CardLocation.SZONE, sequence: seq, controller })
            }
          }
        }

        // 位置全满：怪兽/魔陷不允许顶掉已有卡，只能明确告知（场地魔法因可顶掉，永不为空）
        if (allowedSlots.length === 0) {
          void alertDialog(
            isMonster
              ? '怪兽区已占满\n5 个怪兽格都有卡，无法再召唤或覆盖怪兽。'
              : '魔陷区已占满\n5 个魔陷格都有卡，无法再发动或盖放魔法/陷阱。'
          )
          return
        }

        set({
          pendingAction: null,
          pendingPlacement: {
            sourceId,
            sourceName: card.card?.name || String(card.code),
            sourceController: controller,
            mode,
            cardType,
            allowedSlots
          },
          selectedCardId: sourceId
        })
      },

      cancelPlacement: () => set({ pendingPlacement: null }),

      commitPlacement: (slot) => {
        const { pendingPlacement } = useDuelStore.getState()
        if (!pendingPlacement) return

        if (pendingPlacement.mode === 'SUMMON') {
          useDuelStore.getState().moveCard(
            pendingPlacement.sourceId,
            slot.location,
            slot.sequence,
            slot.controller,
            CardPosition.FACEUP_ATTACK
          )
        } else if (pendingPlacement.mode === 'ACTIVATE') {
          useDuelStore.getState().executeActivateCard(pendingPlacement.sourceId, {
            location: slot.location,
            sequence: slot.sequence,
            controller: slot.controller,
            position: CardPosition.FACEUP
          })
        } else {
          useDuelStore.getState().executeSetCard(pendingPlacement.sourceId, {
            location: slot.location,
            sequence: slot.sequence,
            controller: slot.controller
          })
        }
        set({ pendingPlacement: null })
      },

      executeAttackCard: (instanceId, targetInstanceId) => {
        const { state, currentTurn, currentPhase, activeTurnPlayer } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const targetCard = targetInstanceId
          ? state.cards.find((c) => c.instanceId === targetInstanceId)
          : undefined
        const direct = !targetCard
        const preview = targetCard ? resolveBattle(card, targetCard) : resolveDirectAttack(card)
        const pName = card.controller === 0 ? '我方' : '对方'
        const cName = card.card?.name || (card.code ? String(card.code) : '怪兽')
        const dmgRecipient = preview.damageRecipient === 0 ? '我方' : '对方'
        const damageText = preview.damage > 0 ? `，${dmgRecipient}受到 ${preview.damage} 伤害` : ''
        const outcome = direct
          ? '直接攻击'
          : preview.destroyTarget
            ? '战斗破坏对方怪兽'
            : preview.destroyAttacker
              ? '攻击怪兽被战斗破坏'
              : '战斗未分胜负'
        const versusText = direct
          ? ''
          : ` (${preview.attackerAtk} vs ${preview.targetIsDefense ? '守备 ' : ''}${preview.targetValue})`
        const description = direct
          ? `${pName}【${cName}】${outcome}${damageText}`
          : `${pName}【${cName}】攻击【${preview.targetName}】${versusText} → ${outcome}${damageText}`

        const newStep: DuelStep = {
          id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          turn: currentTurn,
          turnPlayer: activeTurnPlayer,
          phase: currentPhase,
          actionPlayer: card.controller,
          actionType: 'ATTACK',
          instanceId,
          cardCode: card.code,
          cardName: card.card?.name,
          fromLocation: CardLocation.MZONE,
          fromSequence: card.sequence,
          targetInstanceId: targetCard?.instanceId,
          targetCardName: targetCard?.card?.name,
          targetPlayer: direct ? (card.controller === 0 ? 1 : 0) : undefined,
          description,
          boardAfter: createLightweightSnapshot(state.cards)
        }

        set((prev) => ({
          currentChain: 0,
          pendingAction: null,
          pendingPlacement: null,
          state: {
            ...prev.state,
            steps: [...(prev.state.steps || []), newStep],
            initialBoardSnapshot:
              prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
          }
        }))
      },

      executeNormalSummon: (instanceId) => {
        const { state, moveCard } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const occupiedSeqs = state.cards
          .filter(
            (c) =>
              c.controller === card.controller &&
              c.location === CardLocation.MZONE &&
              c.sequence <= 4
          )
          .map((c) => c.sequence)
        const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
        moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
      },

      executeSpecialSummon: (instanceId) => {
        const { state, moveCard } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const occupiedSeqs = state.cards
          .filter(
            (c) =>
              c.controller === card.controller &&
              c.location === CardLocation.MZONE &&
              c.sequence <= 4
          )
          .map((c) => c.sequence)
        const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
        moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
      },

      executeSetCard: (instanceId, placement) => {
        const { state, moveCards } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const cardType = card.card?.type ?? 0
        const isMonster = card.card
          ? (cardType & CardType.MONSTER) !== 0
          : card.location === CardLocation.MZONE

        let targetLocation: number
        let targetPosition: number
        let defaultSeq: number
        if (placement) {
          targetLocation = placement.location
          targetPosition = placement.position ?? CardPosition.FACEDOWN
          defaultSeq = placement.sequence
        } else if (isFieldSpellCard(card)) {
          // 场地魔法：固定盖放到 SZONE seq 5 (本项目 MR1~3 约定)
          targetLocation = CardLocation.SZONE
          targetPosition = CardPosition.FACEDOWN
          defaultSeq = FIELD_ZONE_SEQ
        } else if (isMonster) {
          targetLocation = CardLocation.MZONE
          targetPosition = CardPosition.FACEDOWN_DEFENSE
          const occupiedSeqs = state.cards
            .filter(
              (c) =>
                c.controller === card.controller &&
                c.location === CardLocation.MZONE &&
                c.sequence <= 4
            )
            .map((c) => c.sequence)
          defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
        } else {
          targetLocation = CardLocation.SZONE
          targetPosition = CardPosition.FACEDOWN
          const occupiedSeqs = state.cards
            .filter(
              (c) =>
                c.controller === card.controller &&
                c.location === CardLocation.SZONE &&
                c.sequence <= 4
            )
            .map((c) => c.sequence)
          defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
        }

        const targetController = placement?.controller ?? card.controller
        const displaced = findZoneOccupant(state.cards, targetController, targetLocation, defaultSeq)
        const moves: MoveCardParams[] = []
        if (displaced && displaced.instanceId !== instanceId) {
          moves.push({
            instanceId: displaced.instanceId,
            toLocation: CardLocation.GRAVE,
            toSequence: 999,
            toController: displaced.controller
          })
        }
        moves.push({
          instanceId,
          toLocation: targetLocation,
          toSequence: defaultSeq,
          toController: placement?.controller,
          customPos: targetPosition
        })
        moveCards(moves)
      },

      executeSendToGrave: (instanceId) => {
        useDuelStore.getState().moveCard(instanceId, CardLocation.GRAVE, 999)
      },

      executeBanishCard: (instanceId) => {
        useDuelStore.getState().moveCard(instanceId, CardLocation.REMOVED, 999)
      },

      executeDrawCard: (controller) => {
        const { state, moveCard, activeDuelistId } = useDuelStore.getState()

        const activeDuelist = (state.duelists || []).find(
          (d) => d.id === activeDuelistId && d.team === controller
        )
        const ownerScope = activeDuelist?.id ?? null

        const deckCards = state.cards
          .filter(
            (c) =>
              c.controller === controller &&
              c.location === CardLocation.DECK &&
              (ownerScope ? c.duelistId === ownerScope : true)
          )
          .sort((a, b) => a.sequence - b.sequence)
        if (deckCards.length === 0) return

        const topCard = deckCards[0]
        moveCard(
          topCard.instanceId,
          CardLocation.HAND,
          999,
          controller,
          CardPosition.FACEDOWN,
          ownerScope ?? undefined
        )
      },

      setActiveLeftTab: (tab) => set({ activeLeftTab: tab, isLeftOpen: true }),
      setLeftOpen: (open) => set({ isLeftOpen: open }),
      toggleLeftTab: (tab) =>
        set((prev) => ({
          activeLeftTab: tab,
          isLeftOpen: prev.activeLeftTab === tab ? !prev.isLeftOpen : true
        })),
      setLeftWidth: (width) => set({ leftWidth: Math.max(280, Math.min(width, 600)) }),

      loadProjectAndStart: (newState) => {
        const normalized = normalizeDuelState(newState)
        set({
          state: normalized,
          currentTurn: 1,
          currentPhase: 'M1',
          currentChain: 0,
          activeTurnPlayer: normalized.turnPlayer ?? 0,
          selectedCardId: null,
          expandedDuelistId: null,
          hoveredCard: null
        })
        useDuelStore.temporal.getState().clear()
      },

      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
      setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
      setIsScreenplayOpen: (open) => set({ isScreenplayOpen: open }),
      setSelectedStepId: (id) => set({ selectedStepId: id }),
      openScreenplayWithStep: (stepId) =>
        set((prev) => ({
          isScreenplayOpen: true,
          selectedStepId:
            stepId !== undefined ? stepId : prev.selectedStepId || prev.state.steps?.[0]?.id || null
        })),

      addStep: (stepData) =>
        set((prev) => {
          const newStep: DuelStep = {
            ...stepData,
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          }
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: [...existing, newStep]
            }
          }
        }),

      updateStep: (stepId, patch) =>
        set((prev) => {
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: existing.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
            }
          }
        }),

      deleteStep: (stepId) =>
        set((prev) => {
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: existing.filter((s) => s.id !== stepId)
            }
          }
        }),

      moveStep: (stepId, direction) =>
        set((prev) => {
          const existing = [...(prev.state.steps || [])]
          const idx = existing.findIndex((s) => s.id === stepId)
          if (idx === -1) return prev
          if (direction === 'up' && idx > 0) {
            const temp = existing[idx - 1]
            existing[idx - 1] = existing[idx]
            existing[idx] = temp
          } else if (direction === 'down' && idx < existing.length - 1) {
            const temp = existing[idx + 1]
            existing[idx + 1] = existing[idx]
            existing[idx] = temp
          }
          return {
            state: {
              ...prev.state,
              steps: existing
            }
          }
        }),

      clearSteps: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            steps: []
          },
          currentStepIndex: null
        })),

      setMasterRule: (rule) =>
        set((prev) => {
          let newCards = [...prev.state.cards]
          if (rule <= 3) {
            newCards = newCards.filter(
              (c) => !(c.location === CardLocation.MZONE && (c.sequence === 5 || c.sequence === 6))
            )
          }
          return {
            state: { ...prev.state, masterRule: rule, cards: newCards }
          }
        }),

      setDuelType: (duelType) =>
        set((prev) => ({
          state: { ...prev.state, duelType }
        })),

      setSeries: (series) =>
        set((prev) => ({
          state: { ...prev.state, series }
        })),

      setTitle: (title) =>
        set((prev) => ({
          state: { ...prev.state, title }
        })),

      setHint: (hint) =>
        set((prev) => ({
          state: { ...prev.state, hint }
        })),

      setPlayerLp: (player, lp) =>
        set((prev) => {
          const updatedLp = Math.max(0, lp)
          const players: [PlayerState, PlayerState] = [
            player === 0 ? { ...prev.state.players[0], lp: updatedLp } : prev.state.players[0],
            player === 1 ? { ...prev.state.players[1], lp: updatedLp } : prev.state.players[1]
          ]
          const isShared = prev.state.matchConfig?.sharedLp
          let baseDuelists = prev.state.duelists
          if (!baseDuelists || baseDuelists.length === 0) {
            baseDuelists = createDefaultDuelists(
              prev.state.matchConfig?.team0Count ?? 1,
              prev.state.matchConfig?.team1Count ?? 1
            )
          }
          const duelists = baseDuelists.map((d) => {
            if (d.team === player) {
              if (isShared || baseDuelists!.filter((item) => item.team === player).length <= 1) {
                return { ...d, lp: updatedLp }
              }
            }
            return d
          })
          return {
            state: { ...prev.state, players, duelists }
          }
        }),

      setTurnPlayer: (player) =>
        set((prev) => ({
          state: { ...prev.state, turnPlayer: player }
        })),

      setFirstTurnAttack: (allow) =>
        set((prev) => ({
          state: { ...prev.state, firstTurnAttack: allow }
        })),

      switchMatchConfig: (newConfig) =>
        set((prev) => {
          const currentConfig = prev.state.matchConfig || {
            mode: '1v1',
            team0Count: 1,
            team1Count: 1,
            sharedLp: false
          }
          const currentKey = getMatchScenarioKey(currentConfig)
          const targetKey = getMatchScenarioKey(newConfig)

          const currentSnapshot: DuelSceneSnapshot = {
            duelists:
              prev.state.duelists ||
              createDefaultDuelists(currentConfig.team0Count, currentConfig.team1Count),
            cards: prev.state.cards,
            turnPlayer: prev.state.turnPlayer,
            firstTurnAttack: prev.state.firstTurnAttack,
            steps: prev.state.steps,
            matchConfig: currentConfig,
            players: prev.state.players,
            initialBoardSnapshot: prev.state.initialBoardSnapshot
          }

          const updatedScenarios: Record<string, DuelSceneSnapshot> = {
            ...(prev.state.scenarios || {}),
            [currentKey]: currentSnapshot
          }

          const resetRuntime = {
            expandedDuelistId: null,
            activeDuelistId: null,
            selectedCardId: null,
            currentStepIndex: null,
            currentTurn: 1,
            currentPhase: 'M1' as const,
            currentChain: 0
          }

          if (updatedScenarios[targetKey]) {
            const snap = updatedScenarios[targetKey]
            return {
              state: {
                ...prev.state,
                matchConfig: newConfig,
                duelists: snap.duelists,
                cards: snap.cards,

                players: snap.players ?? prev.state.players,
                initialBoardSnapshot: snap.initialBoardSnapshot ?? prev.state.initialBoardSnapshot,
                turnPlayer: snap.turnPlayer,
                firstTurnAttack: snap.firstTurnAttack,
                steps: snap.steps,
                scenarios: updatedScenarios
              },
              ...resetRuntime,
              activeTurnPlayer: snap.turnPlayer
            }
          }

          const newDuelists = createDefaultDuelists(newConfig.team0Count, newConfig.team1Count)

          return {
            state: {
              ...prev.state,
              matchConfig: newConfig,
              duelists: newDuelists,
              cards: [],
              players: [
                { lp: 8000, maxHand: 0, startHand: 0 },
                { lp: 8000, maxHand: 0, startHand: 0 }
              ],
              steps: [],
              initialBoardSnapshot: undefined,
              turnPlayer: 0,
              firstTurnAttack: newConfig.mode === '1v1' ? prev.state.firstTurnAttack : true,
              scenarios: updatedScenarios
            },
            ...resetRuntime
          }
        }),

      updateDuelist: (duelistId, patch) =>
        set((prev) => {
          let baseDuelists = prev.state.duelists
          if (!baseDuelists || baseDuelists.length === 0) {
            baseDuelists = createDefaultDuelists(
              prev.state.matchConfig?.team0Count ?? 1,
              prev.state.matchConfig?.team1Count ?? 1
            )
            if (prev.state.players[0]) baseDuelists[0].lp = prev.state.players[0].lp
            if (prev.state.players[1]) baseDuelists[1].lp = prev.state.players[1].lp
          }

          let target = baseDuelists.find((d) => d.id === duelistId)
          if (!target) {
            if (duelistId.includes('_0_')) target = baseDuelists.find((d) => d.team === 0)
            else if (duelistId.includes('_1_')) target = baseDuelists.find((d) => d.team === 1)
          }

          const targetId = target ? target.id : duelistId
          const targetTeam: 0 | 1 = target ? target.team : duelistId.includes('_1_') ? 1 : 0
          const updatedLp = patch.lp !== undefined ? Math.max(0, patch.lp) : undefined

          const duelists = baseDuelists.map((d) => {
            if (d.id === targetId) {
              return { ...d, ...patch, ...(updatedLp !== undefined ? { lp: updatedLp } : {}) }
            }
            return d
          })

          let players = prev.state.players
          let nextSteps = prev.state.steps || []

          if (updatedLp !== undefined) {
            const oldLp = target ? target.lp : (players[targetTeam]?.lp ?? 8000)
            const diff = Math.abs(updatedLp - oldLp)
            if (prev.isAutoRecording && diff > 0) {
              const isDamage = updatedLp < oldLp
              const roleName = target?.name || (targetTeam === 0 ? '我方' : '对方')
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: prev.currentPhase,
                  actionPlayer: targetTeam,
                  actionType: isDamage ? 'DAMAGE' : 'RECOVER',
                  description: isDamage
                    ? `${roleName}受到 ${diff} 点伤害 (LP: ${oldLp} → ${updatedLp})`
                    : `${roleName}回复 ${diff} 点生命值 (LP: ${oldLp} → ${updatedLp})`,
                  lpChange: { player: targetTeam, oldLp, newLp: updatedLp },
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }

            if (prev.state.matchConfig?.sharedLp) {
              duelists.forEach((d) => {
                if (d.team === targetTeam) {
                  d.lp = updatedLp
                }
              })
            }
            players = [
              targetTeam === 0 ? { ...players[0], lp: updatedLp } : players[0],
              targetTeam === 1 ? { ...players[1], lp: updatedLp } : players[1]
            ]
          }

          return {
            state: {
              ...prev.state,
              duelists,
              players,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      setDuelistTurnOrder: (duelistId, newOrder) =>
        set((prev) => {
          const rawDuelists = prev.state.duelists || []
          const target = rawDuelists.find((d) => d.id === duelistId)
          if (!target) return prev

          const currentTargetOrder = target.turnOrder ?? (target.isFirst ? 1 : 2)
          if (currentTargetOrder === newOrder) return prev

          const duelists = rawDuelists.map((d) => ({ ...d }))
          const targetInList = duelists.find((d) => d.id === duelistId)!
          const otherInList = duelists.find(
            (d) => d.id !== duelistId && (d.turnOrder ?? (d.isFirst ? 1 : 2)) === newOrder
          )

          targetInList.turnOrder = newOrder
          if (otherInList) {
            otherInList.turnOrder = currentTargetOrder
          }

          let turnPlayer = prev.state.turnPlayer
          duelists.forEach((d) => {
            const order = d.turnOrder ?? 2
            d.isFirst = order === 1
            if (d.isFirst) {
              turnPlayer = d.team
            }
          })

          return {
            state: {
              ...prev.state,
              duelists,
              turnPlayer
            }
          }
        }),

      setFirstDuelist: (duelistId) => {
        useDuelStore.getState().setDuelistTurnOrder(duelistId, 1)
      },

      toggleSharedLp: () =>
        set((prev) => {
          const currentConfig = prev.state.matchConfig || {
            mode: '1v1',
            team0Count: 1,
            team1Count: 1,
            sharedLp: false
          }
          const nextShared = !currentConfig.sharedLp
          const nextConfig: MatchConfig = { ...currentConfig, sharedLp: nextShared }

          let duelists = prev.state.duelists || []
          let players = prev.state.players
          if (nextShared) {
            const team0Lp = duelists.find((d) => d.team === 0)?.lp ?? prev.state.players[0].lp
            const team1Lp = duelists.find((d) => d.team === 1)?.lp ?? prev.state.players[1].lp
            duelists = duelists.map((d) => ({
              ...d,
              lp: d.team === 0 ? team0Lp : team1Lp
            }))
            players = [
              { ...players[0], lp: team0Lp },
              { ...players[1], lp: team1Lp }
            ]
          }

          return {
            state: {
              ...prev.state,
              matchConfig: nextConfig,
              duelists,
              players
            }
          }
        }),

      addCardToZone: (card, controller, location, sequence, customPos, duelistId) =>
        set((prev) => {
          const isPileZone =
            location === CardLocation.HAND ||
            location === CardLocation.GRAVE ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.REMOVED

          let defaultPos: number = CardPosition.FACEUP_ATTACK
          if (
            location === CardLocation.SZONE ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.HAND
          ) {
            defaultPos = CardPosition.FACEDOWN
          } else if (
            location === CardLocation.GRAVE ||
            location === CardLocation.REMOVED ||
            location === CardLocation.PZONE
          ) {
            defaultPos = CardPosition.FACEUP
          }
          const pos = customPos !== undefined ? customPos : defaultPos

          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
          const isOwnerScopedZone =
            location === CardLocation.HAND ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.GRAVE ||
            location === CardLocation.REMOVED
          let assignedDuelistId = duelistId
          if (isOwnerScopedZone && !assignedDuelistId) {
            assignedDuelistId =
              teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
              teamDuelists[0]?.id ||
              (controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
          }

          const existingPile = prev.state.cards
            .filter((c) => {
              if (c.controller !== controller || c.location !== location) return false

              if (isOwnerScopedZone && assignedDuelistId) {
                return c.duelistId === assignedDuelistId
              }
              return true
            })
            .sort((a, b) => a.sequence - b.sequence)

          let targetSeq = isPileZone ? existingPile.length : sequence
          let updatedCards = prev.state.cards

          if (isPileZone) {
            const insertIdx =
              sequence !== undefined && sequence >= 0 && sequence <= existingPile.length
                ? sequence
                : existingPile.length
            targetSeq = insertIdx

            if (insertIdx < existingPile.length) {
              const seqShiftMap = new Map<string, number>()
              existingPile.forEach((c, idx) => {
                if (idx >= insertIdx) {
                  seqShiftMap.set(c.instanceId, idx + 1)
                }
              })
              updatedCards = prev.state.cards.map((c) => {
                if (seqShiftMap.has(c.instanceId)) {
                  return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
                }
                return c
              })
            }
          }

          const filteredCards = isPileZone
            ? updatedCards
            : updatedCards.filter(
                (c) =>
                  !(
                    c.controller === controller &&
                    c.location === location &&
                    c.sequence === sequence
                  )
              )

          const newCard: FieldCard = {
            instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            code: card.id,
            card,
            controller,
            owner: controller,
            location,
            sequence: targetSeq,
            position: pos,
            overlayMaterials: [],
            duelistId: isOwnerScopedZone ? assignedDuelistId : undefined
          }

          return {
            state: {
              ...prev.state,
              cards: [...filteredCards, newCard]
            },
            selectedCardId: newCard.instanceId,
            hoveredCard: card
          }
        }),

      applyBoardSetup: ({ lp, cards, clearExisting }) =>
        set((prev) => {
          const layout = buildLayoutFromSetup(prev.state, prev.activeDuelistId, {
            lp,
            cards,
            clearExisting
          })
          return {
            state: {
              ...prev.state,
              players: layout.players,
              duelists: layout.duelists,
              cards: layout.cards,

              ...(layout.initialSnapshot ? { initialBoardSnapshot: layout.initialSnapshot } : {})
            },
            selectedCardId: layout.selectedInstanceId,
            hoveredCard: layout.hoveredCard
          }
        }),

      applyDuelScreenplay: ({ lp, cards, steps, clearExisting }) =>
        set((prev) => {
          const layout = buildLayoutFromSetup(prev.state, prev.activeDuelistId, {
            lp,
            cards,
            clearExisting
          })
          const draft: DuelStep[] = steps.map((s, idx) => ({
            ...s,
            id: `step_${Date.now()}_${idx.toString(36)}_${Math.random().toString(36).substring(2, 7)}`
          }))
          const stepsWithBoard = replayStepsBoard(createLightweightSnapshot(layout.cards), draft)
          const turnPlayer = draft[0]?.turnPlayer ?? prev.state.turnPlayer ?? 0
          return {
            state: {
              ...prev.state,
              players: layout.players,
              duelists: layout.duelists,
              cards: layout.cards,
              steps: stepsWithBoard,
              ...(layout.initialSnapshot ? { initialBoardSnapshot: layout.initialSnapshot } : {})
            },
            selectedCardId: layout.selectedInstanceId,
            hoveredCard: layout.hoveredCard,
            currentStepIndex: null,
            currentTurn: 1,
            currentPhase: 'DP',
            currentChain: 0,
            activeTurnPlayer: turnPlayer
          }
        }),

      moveCard: (instanceId, toLocation, toSequence, toController, customPos, targetDuelistId) =>
        set((prev) =>
          applyMoveCard(prev, {
            instanceId,
            toLocation,
            toSequence,
            toController,
            customPos,
            targetDuelistId
          })
        ),

      moveCards: (moves) =>
        set((prev) => {
          let acc = prev
          for (const m of moves) {
            acc = { ...acc, ...applyMoveCard(acc, m) }
          }
          return acc
        }),

      removeCard: (instanceId) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
          },
          selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
          hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId,
          pendingAction: prev.pendingAction?.sourceId === instanceId ? null : prev.pendingAction,
          pendingPlacement:
            prev.pendingPlacement?.sourceId === instanceId ? null : prev.pendingPlacement
        })),

      updateCardPosition: (instanceId, position) =>
        set((prev) => {
          const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
          if (!targetCard) return prev
          const oldPos = targetCard.position
          if (oldPos === position) return prev

          const updatedCards = prev.state.cards.map((c) =>
            c.instanceId === instanceId ? { ...c, position } : c
          )

          const nextSteps = [...(prev.state.steps || [])]
          let nextChain = prev.currentChain

          if (prev.isAutoRecording) {
            const lastStep = nextSteps[nextSteps.length - 1]
            const isJustDropped =
              lastStep &&
              lastStep.instanceId === instanceId &&
              (lastStep.actionType === 'SET_SPELL_TRAP' ||
                lastStep.actionType === 'ACTIVATE' ||
                lastStep.actionType === 'SET_MONSTER' ||
                lastStep.actionType === 'NORMAL_SUMMON' ||
                lastStep.actionType === 'SPECIAL_SUMMON')

            const pName = targetCard.controller === 0 ? '我方' : '对方'
            const cName =
              targetCard.card?.name || (targetCard.code ? String(targetCard.code) : '卡片')

            if (isJustDropped) {
              if (
                targetCard.location === CardLocation.SZONE ||
                targetCard.location === CardLocation.FZONE
              ) {
                const isFacedown = Boolean(position & CardPosition.FACEDOWN)
                if (isFacedown) {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'SET_SPELL_TRAP',
                    chainIndex: undefined,
                    description: `${pName}覆盖魔陷【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                } else {
                  const chainIdx = prev.currentChain + 1
                  nextChain = chainIdx
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'ACTIVATE',
                    chainIndex: chainIdx,
                    description: `${pName}发动【${cName}】(Chain ${chainIdx})`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                }
              } else if (targetCard.location === CardLocation.MZONE) {
                const isFacedown = Boolean(position & CardPosition.FACEDOWN)
                if (isFacedown) {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'SET_MONSTER',
                    description: `${pName}里侧盖放怪兽【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                } else {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'NORMAL_SUMMON',
                    description: `${pName}通常召唤【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                }
              }
            } else {
              const inferred = inferPositionChangeAction({
                location: targetCard.location,
                oldPosition: oldPos,
                newPosition: position,
                actionPlayer: targetCard.controller,
                cardCode: targetCard.code,
                cardName: targetCard.card?.name,
                currentChain: prev.currentChain
              })

              if (inferred) {
                if (inferred.chainIndex) {
                  nextChain = inferred.chainIndex
                }
                const newStep: DuelStep = {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: prev.currentPhase,
                  actionPlayer: targetCard.controller,
                  actionType: inferred.actionType,
                  instanceId,
                  cardCode: targetCard.code,
                  cardName: targetCard.card?.name,
                  fromLocation: targetCard.location,
                  fromSequence: targetCard.sequence,
                  toLocation: targetCard.location,
                  toSequence: targetCard.sequence,
                  chainIndex: inferred.chainIndex,
                  description: inferred.description,
                  boardAfter: createLightweightSnapshot(updatedCards)
                }
                nextSteps.push(newStep)
              }
            }
          }

          return {
            currentChain: nextChain,
            state: {
              ...prev.state,
              cards: updatedCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      addOverlayMaterial: (targetInstanceId, matCode) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                return {
                  ...c,
                  overlayMaterials: [...c.overlayMaterials, matCode]
                }
              }
              return c
            })
          }
        })),

      removeOverlayMaterial: (targetInstanceId, matIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                const newMats = [...c.overlayMaterials]
                newMats.splice(matIndex, 1)
                return { ...c, overlayMaterials: newMats }
              }
              return c
            })
          }
        })),

      overlayOnTop: (targetInstanceId, newCardData, sourceCardInstanceId) =>
        set((prev) => {
          let sourceMats: number[] = []
          if (sourceCardInstanceId) {
            const src = prev.state.cards.find((c) => c.instanceId === sourceCardInstanceId)
            if (src && src.overlayMaterials) {
              sourceMats = src.overlayMaterials
            }
          }

          let updatedCards = prev.state.cards
          if (sourceCardInstanceId) {
            updatedCards = updatedCards.filter((c) => c.instanceId !== sourceCardInstanceId)
          }

          const finalCards = updatedCards.map((c) => {
            if (c.instanceId === targetInstanceId) {
              return {
                ...c,

                code: newCardData.id,

                card: newCardData,

                overlayMaterials: [...c.overlayMaterials, c.code, ...sourceMats]
              }
            }
            return c
          })

          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            const hostCard = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
            const pName = hostCard?.controller === 0 ? '我方' : '对方'
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: hostCard?.controller ?? 0,
                actionType: 'XYZ_SUMMON',
                instanceId: targetInstanceId,
                cardCode: newCardData.id,
                cardName: newCardData.name,
                toLocation: CardLocation.MZONE,
                toSequence: hostCard?.sequence ?? 0,
                description: `${pName}以叠放怪兽为素材超量召唤【${newCardData.name}】！`,
                boardAfter: createLightweightSnapshot(finalCards)
              }
            ]
          }

          return {
            state: {
              ...prev.state,
              cards: finalCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            },

            selectedCardId:
              prev.selectedCardId === sourceCardInstanceId ? targetInstanceId : prev.selectedCardId
          }
        }),

      setCardData: (instanceId, card) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => (c.instanceId === instanceId ? { ...c, card } : c))
          }
        })),

      swapHostWithMaterial: (targetInstanceId, matIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                if (matIndex < 0 || matIndex >= c.overlayMaterials.length) return c
                const oldHostCode = c.code
                const newHostCode = c.overlayMaterials[matIndex]
                const newMats = [...c.overlayMaterials]

                newMats[matIndex] = oldHostCode
                return {
                  ...c,
                  code: newHostCode,

                  card: undefined,
                  overlayMaterials: newMats
                }
              }
              return c
            })
          }
        })),

      detachMaterialToLocation: (targetInstanceId, matIndex, targetLocation) =>
        set((prev) => {
          const host = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
          if (!host || matIndex < 0 || matIndex >= host.overlayMaterials.length) return prev
          const matCode = host.overlayMaterials[matIndex]
          const newMats = [...host.overlayMaterials]

          newMats.splice(matIndex, 1)

          const existingPile = prev.state.cards
            .filter((c) => c.controller === host.controller && c.location === targetLocation)
            .sort((a, b) => a.sequence - b.sequence)
          const targetSeq = existingPile.length

          const newCard: FieldCard = {
            instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            code: matCode,
            controller: host.controller,
            owner: host.controller,
            location: targetLocation,
            sequence: targetSeq,
            position:
              targetLocation === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEUP,
            overlayMaterials: []
          }

          const finalResultCards = [
            ...prev.state.cards.map((c) =>
              c.instanceId === targetInstanceId ? { ...c, overlayMaterials: newMats } : c
            ),

            newCard
          ]

          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            const pName = host.controller === 0 ? '我方' : '对方'
            const hostName = host.card?.name || (host.code ? String(host.code) : '超量怪兽')
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: host.controller,
                actionType: 'DETACH_MATERIAL',
                instanceId: targetInstanceId,
                cardCode: matCode,
                toLocation: targetLocation,
                toSequence: targetSeq,
                description: `${pName}取除【${hostName}】的超量素材`,
                boardAfter: createLightweightSnapshot(finalResultCards)
              }
            ]
          }

          return {
            state: {
              ...prev.state,
              cards: finalResultCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      reorderOverlayMaterials: (targetInstanceId, fromIndex, toIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                const mats = [...c.overlayMaterials]

                if (
                  fromIndex < 0 ||
                  fromIndex >= mats.length ||
                  toIndex < 0 ||
                  toIndex >= mats.length ||
                  fromIndex === toIndex
                ) {
                  return c
                }

                const [moved] = mats.splice(fromIndex, 1)
                mats.splice(toIndex, 0, moved)
                return { ...c, overlayMaterials: mats }
              }
              return c
            })
          }
        })),

      reorderPileCards: (controller, location, fromIndex, toIndex, duelistId) =>
        set((prev) => {
          const pile = prev.state.cards
            .filter(
              (card) =>
                card.controller === controller &&
                card.location === location &&
                (!duelistId || card.duelistId === duelistId)
            )
            .sort((a, b) => a.sequence - b.sequence)

          if (
            fromIndex < 0 ||
            fromIndex >= pile.length ||
            toIndex < 0 ||
            toIndex >= pile.length ||
            fromIndex === toIndex
          ) {
            return prev
          }

          const reordered = [...pile]
          const [movedCard] = reordered.splice(fromIndex, 1)
          reordered.splice(toIndex, 0, movedCard)

          const seqMap = new Map<string, number>()
          reordered.forEach((c, idx) => {
            seqMap.set(c.instanceId, idx)
          })

          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((c) => {
                if (seqMap.has(c.instanceId)) {
                  return { ...c, sequence: seqMap.get(c.instanceId)! }
                }
                return c
              })
            }
          }
        }),

      reorderHandCards: (controller, duelistId, movingInstanceId, targetInstanceId, insertAfter) =>
        set((prev) => {
          if (movingInstanceId === targetInstanceId) return prev

          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
          const fallbackDuelistId = teamDuelists[0]?.id ?? `duelist_${controller}_0`
          const belongsToDuelist = (card: FieldCard): boolean =>
            card.duelistId === duelistId || (!card.duelistId && fallbackDuelistId === duelistId)
          const hand = prev.state.cards
            .filter(
              (card) =>
                card.controller === controller &&
                card.location === CardLocation.HAND &&
                belongsToDuelist(card)
            )
            .sort((a, b) => a.sequence - b.sequence)
          const fromIndex = hand.findIndex((card) => card.instanceId === movingInstanceId)
          const targetIndex = hand.findIndex((card) => card.instanceId === targetInstanceId)
          if (fromIndex < 0 || targetIndex < 0) return prev

          const reordered = [...hand]
          const [movingCard] = reordered.splice(fromIndex, 1)
          const adjustedTargetIndex = reordered.findIndex(
            (card) => card.instanceId === targetInstanceId
          )
          const insertIndex = adjustedTargetIndex + (insertAfter ? 1 : 0)
          reordered.splice(insertIndex, 0, movingCard)
          if (reordered.every((card, index) => card.instanceId === hand[index].instanceId)) {
            return prev
          }

          const sequenceById = new Map<string, number>()
          reordered.forEach((card, index) => sequenceById.set(card.instanceId, index))
          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((card) => {
                const sequence = sequenceById.get(card.instanceId)
                return sequence === undefined ? card : { ...card, sequence }
              })
            }
          }
        }),

      loadState: (newState) =>
        set(() => ({
          state: normalizeDuelState(newState),
          currentProjectPath: null,
          selectedCardId: null,
          pendingAction: null,
          pendingPlacement: null,
          expandedDuelistId: null
        })),

      resetDuel: () =>
        set((prev) => {
          const baseState = createInitialDuelState(
            prev.state.masterRule,
            prev.state.duelType || 'full'
          )
          if (prev.state.matchConfig) {
            baseState.matchConfig = prev.state.matchConfig
            baseState.duelists = createDefaultDuelists(
              prev.state.matchConfig.team0Count,
              prev.state.matchConfig.team1Count
            )
          }
          return {
            state: baseState,
            currentProjectPath: null,
            selectedCardId: null,
            pendingAction: null,
            pendingPlacement: null,
            activeStatPopoverCardId: null,
            statPopoverPosition: null,
            hoveredCard: null,
            expandedDuelistId: null
          }
        }),

      swapSides: () =>
        set((prev) => {
          const duelists = (prev.state.duelists || []).map((d) => ({
            ...d,
            team: (d.team === 0 ? 1 : 0) as 0 | 1
          }))
          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((c) => ({
                ...c,
                controller: (c.controller === 0 ? 1 : 0) as 0 | 1
              })),
              duelists,
              players: [prev.state.players[1], prev.state.players[0]],
              turnPlayer: (prev.state.turnPlayer === 0 ? 1 : 0) as 0 | 1
            },
            selectedCardId: null,
            expandedDuelistId: null
          }
        }),

      setCardCounter: (instanceId, counterType, count) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                const newCounters = { ...(c.counters || {}) }
                if (count <= 0) {
                  delete newCounters[counterType]
                } else {
                  newCounters[counterType] = count
                }
                return { ...c, counters: newCounters }
              }
              return c
            })
          }
        })),

      removeCardCounter: (instanceId, counterType) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId && c.counters) {
                const newCounters = { ...c.counters }
                delete newCounters[counterType]
                return { ...c, counters: newCounters }
              }
              return c
            })
          }
        })),

      registerCustomCounter: (name) => {
        const trimmed = name.trim()
        const existing = get().state.customCounters || {}
        const found = Object.entries(existing).find(([, n]) => n === trimmed)
        if (found) return Number(found[0])

        const id = allocateCustomCounterId(existing)
        set((prev) => ({
          state: {
            ...prev.state,
            customCounters: { ...(prev.state.customCounters || {}), [id]: trimmed }
          }
        }))
        return id
      },

      clearCardCounters: (instanceId) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                return { ...c, counters: {} }
              }
              return c
            })
          }
        })),

      setCardCustomStats: (instanceId, customAtk, customDef) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                return { ...c, customAtk, customDef }
              }
              return c
            })
          }
        })),

      applyDeckToPlayer: (player, deck, drawCount = 0, duelistId) =>
        set((prev) => {
          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === player)
          const multi = teamDuelists.length > 1

          const ownerScope =
            duelistId && teamDuelists.some((d) => d.id === duelistId)
              ? duelistId
              : multi
                ? (teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ??
                  teamDuelists[0]?.id)
                : null

          const ZONES_TO_CLEAR: number[] = [
            CardLocation.HAND,
            CardLocation.DECK,
            CardLocation.EXTRA,
            CardLocation.MZONE,
            CardLocation.SZONE,
            CardLocation.GRAVE,
            CardLocation.REMOVED
          ]
          const otherCards = prev.state.cards.filter(
            (c) =>
              !(
                c.controller === player &&
                ZONES_TO_CLEAR.includes(c.location) &&
                (ownerScope ? c.duelistId === ownerScope : true)
              )
          )

          const newCards: FieldCard[] = []
          const totalMain = deck.main.length
          const actualDraw = Math.min(drawCount, totalMain)

          for (let i = 0; i < actualDraw; i++) {
            const code = deck.main[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_h_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.HAND,

              sequence: 900 + i,

              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          for (let i = actualDraw; i < totalMain; i++) {
            const code = deck.main[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_d_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.DECK,
              sequence: i - actualDraw,

              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          for (let i = 0; i < deck.extra.length; i++) {
            const code = deck.extra[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.EXTRA,
              sequence: i,
              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          const nextCards = [...otherCards, ...newCards]

          return {
            state: {
              ...prev.state,
              cards: nextCards,

              initialBoardSnapshot: createLightweightSnapshot(nextCards)
            },

            selectedCardId: null,
            hoveredCard: null
          }
        }),

      toggleTacticalView: () => set((prev) => ({ tacticalView: !prev.tacticalView })),
      setTacticalView: (enabled) => set({ tacticalView: enabled }),

      setSelectedCardId: (id) => set({ selectedCardId: id }),
      setActiveStatPopoverCardId: (id) => set({ activeStatPopoverCardId: id }),
      setStatPopoverPosition: (pos) => set({ statPopoverPosition: pos }),
      openStatPopover: (id, initialPos) =>
        set((prev) => ({
          activeStatPopoverCardId: id,
          statPopoverPosition: initialPos !== undefined ? initialPos : prev.statPopoverPosition
        })),
      closeStatPopover: () => set({ activeStatPopoverCardId: null }),
      setHoveredCard: (card) => set({ hoveredCard: card }),
      setHoveredInstanceId: (id) => set({ hoveredInstanceId: id })
    }),
    {
      partialize: (state) => ({ state: state.state }),
      equality: (past, current) => past.state === current.state,
      limit: 50
    }
  )
)

if (typeof window !== 'undefined' && window.api?.onApplyDeckToDuel) {
  window.api.onApplyDeckToDuel(({ player, deck, drawCount }) => {
    useDuelStore.getState().applyDeckToPlayer(player, deck, drawCount)
  })
}
