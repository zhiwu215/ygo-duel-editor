import { create } from 'zustand'
import {
  EngineBoardState,
  EnginePendingAction,
  EngineTimelineNode,
  EngineDuelInitParams,
  EngineActionOption,
  EngineDiffResult,
  CdbCard,
  DuelPhase,
  DuelPuzzleState,
  DuelActionType,
  isCardMatchingEngineOption
} from '@shared/index'
import { useDuelStore } from './useDuelStore'

export type EngineMode = 'idle' | 'running' | 'paused'

interface DuelEngineState {
  engineMode: EngineMode
  isInitialized: boolean
  loading: boolean
  error: string | null

  boardState: EngineBoardState | null
  pendingAction: EnginePendingAction | null
  timeline: EngineTimelineNode[]
  currentStepId: string | null

  selectedCardId: string | null
  hoveredCard: CdbCard | null
  hoveredInstanceId: string | null

  backupDuelState: DuelPuzzleState | null

  startEngine: () => Promise<void>
  stopEngine: (revertToSnapshot?: boolean) => void

  initDuel: (params?: EngineDuelInitParams) => Promise<void>
  submitAction: (optionId: string, payload?: unknown) => Promise<void>
  jumpToStep: (stepId: string) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>

  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null, instanceId?: string | null) => void

  getActionsForCard: (card: {
    controller?: number
    location: number
    sequence: number
    code?: number
  }) => EngineActionOption[]
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

function applyDiffToDuelStore(diff: EngineDiffResult, node: EngineTimelineNode): void {
  const duelStore = useDuelStore.getState()
  const currentCards = [...duelStore.state.cards]

  for (const moved of diff.movedCards) {
    const card =
      currentCards.find(
        (c) =>
          c.controller === moved.fromController &&
          c.location === moved.fromLocation &&
          c.sequence === moved.fromSequence &&
          c.code === moved.code
      ) ??
      currentCards.find(
        (c) =>
          c.controller === moved.fromController &&
          c.location === moved.fromLocation &&
          c.code === moved.code
      )

    if (card) {
      duelStore.moveCard(
        card.instanceId,
        moved.toLocation,
        moved.toSequence,
        moved.toController,
        moved.newPosition
      )
      card.location = moved.toLocation
      card.sequence = moved.toSequence
      card.controller = moved.toController
      card.position = moved.newPosition
    }
  }

  for (const pos of diff.positionChanges) {
    const card =
      currentCards.find(
        (c) =>
          c.controller === pos.controller &&
          c.location === pos.location &&
          c.sequence === pos.sequence &&
          c.code === pos.code
      ) ??
      currentCards.find(
        (c) => c.controller === pos.controller && c.location === pos.location && c.code === pos.code
      )

    if (card) {
      duelStore.updateCardPosition(card.instanceId, pos.newPosition)
      card.position = pos.newPosition
    }
  }

  for (const rem of diff.removedCards) {
    const card =
      currentCards.find(
        (c) =>
          c.controller === rem.controller &&
          c.location === rem.location &&
          c.sequence === rem.sequence &&
          c.code === rem.code
      ) ??
      currentCards.find(
        (c) => c.controller === rem.controller && c.location === rem.location && c.code === rem.code
      )

    if (card) {
      duelStore.removeCard(card.instanceId)
      const idx = currentCards.indexOf(card)
      if (idx !== -1) currentCards.splice(idx, 1)
    }
  }

  for (const added of diff.addedCards) {
    void window.api
      .searchCards({ code: added.code })
      .then((cards) => {
        const cdbCard = cards[0]
        if (cdbCard) {
          useDuelStore
            .getState()
            .addCardToZone(
              cdbCard,
              added.controller,
              added.location,
              added.sequence,
              added.position
            )
        }
      })
      .catch(() => {})
  }

  for (const lp of diff.lpChanges) {
    duelStore.setPlayerLp(lp.player, lp.newLp)
  }

  for (const counter of diff.counterChanges) {
    const card = currentCards.find(
      (c) =>
        c.controller === counter.controller &&
        c.location === counter.location &&
        c.sequence === counter.sequence &&
        c.code === counter.code
    )
    if (card) {
      duelStore.setCardCounter(card.instanceId, counter.counterType, counter.newCount)
    }
  }

  if (diff.phaseChange) {
    duelStore.setCurrentPhase(mapPhaseToDuelPhase(diff.phaseChange.phase))
  }

  if (diff.turnChange) {
    duelStore.setTurnPlayer(diff.turnChange.turnPlayer)
  }

  let actionType: DuelActionType = 'NORMAL_SUMMON'
  if (node.title.includes('通常召唤')) actionType = 'NORMAL_SUMMON'
  else if (node.title.includes('特殊召唤')) actionType = 'SPECIAL_SUMMON'
  else if (node.title.includes('盖放怪兽')) actionType = 'SET_MONSTER'
  else if (node.title.includes('盖放')) actionType = 'SET_SPELL_TRAP'
  else if (node.title.includes('发动')) actionType = 'ACTIVATE'
  else if (node.title.includes('变更表示形式')) actionType = 'CHANGE_POS'
  else if (node.title.includes('攻击')) actionType = 'ATTACK'
  else if (
    node.title.includes('战斗阶段') ||
    node.title.includes('主要阶段2') ||
    node.title.includes('结束')
  )
    actionType = 'PHASE_CHANGE'

  duelStore.addStep({
    turn: node.boardState.turn,
    turnPlayer: node.boardState.turnPlayer,
    phase: mapPhaseToDuelPhase(node.boardState.phase),
    actionPlayer: node.player,
    actionType,
    description: node.title
  })
}

function syncJumpToStepToDuelStore(boardState: EngineBoardState): void {
  const duelStore = useDuelStore.getState()
  const currentCards = duelStore.state.cards
  const unmatchedEngineCards = [...boardState.allCards]

  for (const card of currentCards) {
    const idx = unmatchedEngineCards.findIndex(
      (ec) =>
        ec.code === card.code &&
        ec.controller === card.controller &&
        ec.location === card.location &&
        ec.sequence === card.sequence
    )
    if (idx !== -1) {
      const ec = unmatchedEngineCards.splice(idx, 1)[0]
      if (card.position !== ec.position) {
        duelStore.updateCardPosition(card.instanceId, ec.position)
      }
    } else {
      const fallbackIdx = unmatchedEngineCards.findIndex((ec) => ec.code === card.code)
      if (fallbackIdx !== -1) {
        const ec = unmatchedEngineCards.splice(fallbackIdx, 1)[0]
        duelStore.moveCard(card.instanceId, ec.location, ec.sequence, ec.controller, ec.position)
      }
    }
  }

  duelStore.setPlayerLp(0, boardState.players[0].lp)
  duelStore.setPlayerLp(1, boardState.players[1].lp)
  duelStore.setCurrentPhase(mapPhaseToDuelPhase(boardState.phase))
  duelStore.setTurnPlayer(boardState.turnPlayer)
}

export const useDuelEngineStore = create<DuelEngineState>((set, get) => ({
  engineMode: 'idle',
  isInitialized: false,
  loading: false,
  error: null,

  boardState: null,
  pendingAction: null,
  timeline: [],
  currentStepId: null,

  selectedCardId: null,
  hoveredCard: null,
  hoveredInstanceId: null,

  backupDuelState: null,

  startEngine: async () => {
    set({ loading: true, error: null })
    try {
      const currentDuelState = structuredClone(useDuelStore.getState().state)
      set({ backupDuelState: currentDuelState })

      const initParams: EngineDuelInitParams = {
        puzzleState: currentDuelState
      }

      const res = await window.api.duelEngineInit(initParams)
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        boardState: res.boardState,
        pendingAction: res.pendingAction,
        timeline,
        currentStepId: res.initialNode.id
      })
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
      pendingAction: null,
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

      const res = await window.api.duelEngineInit(initParams)
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        boardState: res.boardState,
        pendingAction: res.pendingAction,
        timeline,
        currentStepId: res.initialNode.id
      })
    } catch (err) {
      console.error('[useDuelEngineStore] initDuel failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        error: err instanceof Error ? err.message : '初始化决斗引擎失败'
      })
    }
  },

  submitAction: async (optionId: string, payload?: unknown) => {
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineSubmitAction(optionId, payload)
      const prevTimeline = get().timeline
      const newTimeline = [...prevTimeline, res.node]
      set({
        loading: false,
        boardState: res.boardState,
        pendingAction: res.pendingAction,
        timeline: newTimeline,
        currentStepId: res.node.id,
        selectedCardId: null
      })
      applyDiffToDuelStore(res.diff, res.node)
    } catch (err) {
      console.error('[useDuelEngineStore] submitAction failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '提交操作失败'
      })
    }
  },

  jumpToStep: async (stepId: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineJumpToStep(stepId)
      set({
        loading: false,
        boardState: res.boardState,
        pendingAction: res.pendingAction,
        currentStepId: res.currentStepId,
        selectedCardId: null
      })
      syncJumpToStepToDuelStore(res.boardState)
    } catch (err) {
      console.error('[useDuelEngineStore] jumpToStep failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '回退/跳转步骤失败'
      })
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

  getActionsForCard: (card) => {
    const { pendingAction } = get()
    if (!pendingAction || !pendingAction.options) return []
    return pendingAction.options.filter((opt) => isCardMatchingEngineOption(card, opt))
  },

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
