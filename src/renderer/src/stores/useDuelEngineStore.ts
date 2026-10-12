import { create } from 'zustand'
import {
  EngineBoardState,
  EnginePendingAction,
  EngineTimelineNode,
  EngineDuelInitParams,
  EngineActionOption,
  EngineDiffResult,
  CardLocation,
  CdbCard,
  DuelPhase,
  DuelPuzzleState,
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

  pickedOptionIds: string[]
  togglePendingSelection: (optionId: string) => void
  confirmPendingSelection: () => Promise<void>
  clearPendingSelection: () => void

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
    instanceId?: string
    controller?: number
    location: number
    sequence?: number
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

function applyDiffBody(diff: EngineDiffResult): void {
  const duelStore = useDuelStore.getState()
  const currentCards = [...duelStore.state.cards]

  const findById = (
    instanceId: string | null | undefined
  ): (typeof currentCards)[number] | undefined =>
    instanceId ? currentCards.find((c) => c.instanceId === instanceId) : undefined

  const findByFrom = (
    fromController: number,
    fromLocation: number,
    fromSequence: number,
    code: number
  ): (typeof currentCards)[number] | undefined =>
    currentCards.find(
      (c) =>
        c.controller === fromController &&
        c.location === fromLocation &&
        c.sequence === fromSequence &&
        c.code === code
    ) ??
    currentCards.find(
      (c) => c.controller === fromController && c.location === fromLocation && c.code === code
    )

  for (const oc of diff.overlayChanges) {
    if (oc.attached) {
      duelStore.addOverlayMaterial(oc.hostInstanceId, oc.materialCode)
    } else {
      duelStore.removeOverlayMaterial(oc.hostInstanceId, oc.matIndex)
    }
  }

  for (const moved of diff.movedCards) {
    const card =
      findById(moved.instanceId) ??
      findByFrom(moved.fromController, moved.fromLocation, moved.fromSequence, moved.code)
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
      findById(pos.instanceId) ?? findByFrom(pos.controller, pos.location, pos.sequence, pos.code)
    if (card) {
      duelStore.updateCardPosition(card.instanceId, pos.newPosition)
      card.position = pos.newPosition
    }
  }

  for (const rem of diff.removedCards) {
    const card =
      findById(rem.instanceId) ?? findByFrom(rem.controller, rem.location, rem.sequence, rem.code)
    if (card) {
      duelStore.removeCard(card.instanceId)
      const idx = currentCards.indexOf(card)
      if (idx !== -1) currentCards.splice(idx, 1)
    }
  }

  for (const added of diff.addedCards) {
    if (currentCards.some((c) => c.instanceId === added.instanceId)) continue
    if (added.card) {
      const cdbCard = added.card
      duelStore.addCardToZone(
        cdbCard,
        added.controller,
        added.location,
        added.sequence,
        added.position,
        undefined,
        added.instanceId
      )
      currentCards.push({
        instanceId: added.instanceId,
        code: cdbCard.id,
        card: cdbCard,
        controller: added.controller,
        owner: added.controller,
        location: added.location,
        sequence: added.sequence,
        position: added.position,
        overlayMaterials: []
      })
    } else {
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
  }

  for (const lp of diff.lpChanges) {
    duelStore.setPlayerLp(lp.player, lp.newLp)
  }

  for (const counter of diff.counterChanges) {
    const card =
      findById(counter.instanceId) ??
      findByFrom(counter.controller, counter.location, counter.sequence, counter.code)
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
}

function applyDiffToDuelStore(diff: EngineDiffResult): void {
  applyEngineWrite(() => applyDiffBody(diff))
}

function syncJumpToStepWrapped(boardState: EngineBoardState): void {
  applyEngineWrite(() => syncJumpToStepToDuelStore(boardState))
}

function syncJumpToStepToDuelStore(boardState: EngineBoardState): void {
  const duelStore = useDuelStore.getState()
  const currentCards = [...duelStore.state.cards]
  const engineById = new Map(boardState.allCards.map((c) => [c.instanceId, c]))
  const usedEngineIds = new Set<string>()

  for (const card of currentCards) {
    const ec = engineById.get(card.instanceId)
    if (!ec) {
      duelStore.removeCard(card.instanceId)
      continue
    }
    usedEngineIds.add(ec.instanceId)

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
    if (!ec.card) continue
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

  pickedOptionIds: [],

  togglePendingSelection: (optionId) => {
    const { pendingAction, pickedOptionIds } = get()
    if (!pendingAction) return
    const max = pendingAction.max ?? 1
    if (pickedOptionIds.includes(optionId)) {
      set({ pickedOptionIds: pickedOptionIds.filter((id) => id !== optionId) })
      return
    }
    if (pickedOptionIds.length >= max) return
    if (!pendingAction.options.some((o) => o.id === optionId)) return
    set({ pickedOptionIds: [...pickedOptionIds, optionId] })
  },

  confirmPendingSelection: async () => {
    const { pendingAction, pickedOptionIds, submitAction } = get()
    if (!pendingAction) return
    const min = pendingAction.min ?? 1
    if (pickedOptionIds.length < Math.max(min, 1)) return
    const indices = pickedOptionIds
      .map((id) => pendingAction.options.find((o) => o.id === id))
      .filter((o): o is EngineActionOption => Boolean(o))
      .map((o) => (o.rawPayload as { index?: number }).index)
      .filter((idx): idx is number => typeof idx === 'number')
    await submitAction(pickedOptionIds[0], { indices })
  },

  clearPendingSelection: () => set({ pickedOptionIds: [] }),

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
        currentStepId: res.initialNode.id,
        pickedOptionIds: []
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
      selectedCardId: null,
      pickedOptionIds: []
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
        currentStepId: res.initialNode.id,
        pickedOptionIds: []
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
        selectedCardId: null,
        pickedOptionIds: []
      })
      applyDiffToDuelStore(res.diff)
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
        selectedCardId: null,
        pickedOptionIds: []
      })
      syncJumpToStepWrapped(res.boardState)
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
