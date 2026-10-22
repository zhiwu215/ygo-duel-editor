import type { StateCreator } from 'zustand'
import {
  CardLocation,
  CardPosition,
  CardUtils,
  DuelPhase,
  DuelStep,
  DuelPuzzleState,
  FieldCard,
  LightweightCardSnapshot,
  PlayerState,
  createStepId,
  replayManualSteps
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import { applyLpToDuelists, createLpFlash } from './lpSlice'
import type { DuelStore } from './types'

export interface StepsSlice {
  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  selectedStepId: string | null

  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  duelStarted: boolean

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  setTurnPlayer: (player: 0 | 1) => void
  setDuelStarted: (started: boolean) => void
  insertPhaseJump: (target: DuelPhase) => void

  addStep: (step: Omit<DuelStep, 'id'>) => void
  insertStep: (step: DuelStep) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void

  insertPhaseChange: () => void
  insertTurnChange: () => void

  previewStepBoard: (stepIndex: number | null) => void
  resetToOpeningBoard: () => void
}

function restoreCardsFromSnapshot(
  currentCards: FieldCard[],
  snapshot: LightweightCardSnapshot[]
): FieldCard[] {
  const cardMap = new Map(currentCards.map((c) => [c.instanceId, c]))
  return snapshot.map((s) => {
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
}

function insertPileTop(
  cards: FieldCard[],
  extra: FieldCard,
  defaultDuelistId: string,
  location: number
): FieldCard[] {
  const duelistId = extra.duelistId || defaultDuelistId
  const shifted = cards.map((c) =>
    c.controller === extra.controller &&
    c.location === location &&
    (c.duelistId || defaultDuelistId) === duelistId
      ? { ...c, sequence: c.sequence + 1 }
      : c
  )
  return [
    ...shifted,
    {
      ...extra,
      location,
      sequence: 0,
      position: CardPosition.FACEDOWN,
      overlayMaterials: [],
      duelistId
    }
  ]
}

function homePileLocation(card: FieldCard): number {
  const isExtraType = Boolean(card.card && CardUtils.isExtraDeck(card.card.type))
  return isExtraType || card.location === CardLocation.EXTRA
    ? CardLocation.EXTRA
    : CardLocation.DECK
}

export { createStepId } from '@shared/index'

interface DerivationSource {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  activeTurnPlayer: 0 | 1
}

interface DerivationPatch {
  state: DuelPuzzleState
  currentTurn: number
  currentPhase: DuelPhase
  activeTurnPlayer: 0 | 1
}

function openingPhaseOf(steps: DuelStep[]): DuelPhase {
  const first = steps[0]
  const isMarker = first.actionType === 'PHASE_CHANGE' || first.actionType === 'TURN_CHANGE'
  return isMarker ? 'DP' : first.phase
}

function initialLpOf(next: DerivationSource): [number, number] {
  return [
    next.state.initialLp?.[0] ?? next.state.players[0]?.lp ?? 8000,
    next.state.initialLp?.[1] ?? next.state.players[1]?.lp ?? 8000
  ]
}

function derivePatch(next: DerivationSource): DerivationPatch | null {
  const steps = next.state.steps || []
  if (steps.length === 0) return null
  const initial = next.state.initialBoardSnapshot
  const hasInitial = Boolean(initial && initial.length > 0)

  const startPhase: DuelPhase = openingPhaseOf(steps)
  const startLp = initialLpOf(next)
  const derived = replayManualSteps(
    hasInitial && initial ? initial : [],
    steps,
    startLp,
    next.state.turnPlayer,
    startPhase
  )

  const positionOf = (index: number): DuelStep => derived.steps[index]
  const mergedSteps = steps.map((s, i) => {
    const d = positionOf(i)
    return s.turn === d.turn && s.turnPlayer === d.turnPlayer && s.phase === d.phase
      ? s
      : { ...s, turn: d.turn, turnPlayer: d.turnPlayer, phase: d.phase }
  })

  const tail = positionOf(steps.length - 1)

  return {
    state: {
      ...next.state,
      steps: hasInitial ? derived.steps : mergedSteps,
      players: hasInitial
        ? [
            { ...next.state.players[0], lp: derived.lp[0] },
            { ...next.state.players[1], lp: derived.lp[1] }
          ]
        : next.state.players
    },
    currentTurn: tail.turn,
    currentPhase: tail.phase,
    activeTurnPlayer: tail.turnPlayer
  }
}

function anchorLpAt(steps: DuelStep[], from: number, finalLp: [number, number]): [number, number] {
  const lp: [number, number] = [finalLp[0], finalLp[1]]
  for (let i = steps.length - 1; i >= from; i--) {
    const lpChange = steps[i].lpChange
    if (lpChange) lp[lpChange.player] = lpChange.oldLp
  }
  return lp
}

function deriveDeletionPatch(prev: DerivationSource, deletedIdx: number): DerivationPatch | null {
  const steps = prev.state.steps || []
  if (steps.length === 0) return null
  const anchorIdx = deletedIdx - 1
  const anchor = anchorIdx >= 0 ? steps[anchorIdx] : undefined
  const initial = prev.state.initialBoardSnapshot
  const hasInitial = Boolean(initial && initial.length > 0)

  let board: LightweightCardSnapshot[]
  let suffixFrom: number
  let startLp: [number, number]
  let startTurn = 1
  let startTurnPlayer: 0 | 1 = prev.state.turnPlayer
  let startPhase: DuelPhase

  if (anchor?.boardAfter && anchor.boardAfter.length > 0) {
    board = anchor.boardAfter
    suffixFrom = anchorIdx + 1
    startTurn = anchor.turn
    startPhase = anchor.phase
    startTurnPlayer = anchor.turnPlayer
    startLp = anchorLpAt(steps, suffixFrom, [
      prev.state.players[0]?.lp ?? 8000,
      prev.state.players[1]?.lp ?? 8000
    ])
  } else if (hasInitial && initial) {
    board = initial
    suffixFrom = 0
    startPhase = openingPhaseOf(steps)
    startLp = initialLpOf(prev)
  } else {
    const fallback = replayManualSteps(
      [],
      steps,
      initialLpOf(prev),
      prev.state.turnPlayer,
      openingPhaseOf(steps)
    )
    const mergedSteps = steps.map((s, i) => {
      const d = fallback.steps[i]
      return s.turn === d.turn && s.turnPlayer === d.turnPlayer && s.phase === d.phase
        ? s
        : { ...s, turn: d.turn, turnPlayer: d.turnPlayer, phase: d.phase }
    })
    const tail = fallback.steps[steps.length - 1]
    return {
      state: { ...prev.state, steps: mergedSteps },
      currentTurn: tail.turn,
      currentPhase: tail.phase,
      activeTurnPlayer: tail.turnPlayer
    }
  }

  const derived = replayManualSteps(
    board,
    steps.slice(suffixFrom),
    startLp,
    startTurnPlayer,
    startPhase,
    startTurn
  )
  const mergedSteps = [...steps.slice(0, suffixFrom), ...derived.steps]
  const tail = derived.steps[derived.steps.length - 1] ?? steps[anchorIdx]

  return {
    state: {
      ...prev.state,
      steps: mergedSteps,
      players: [
        { ...prev.state.players[0], lp: derived.lp[0] },
        { ...prev.state.players[1], lp: derived.lp[1] }
      ]
    },
    currentTurn: tail.turn,
    currentPhase: tail.phase,
    activeTurnPlayer: tail.turnPlayer
  }
}

function withDerivation(nextState: DerivationSource): Partial<DuelStore> {
  if (useDuelEngineStore.getState().isInitialized) {
    return { state: nextState.state }
  }
  const patch = derivePatch(nextState)
  if (!patch) {
    return { state: nextState.state }
  }
  return patch
}

function refreshPreviewIfActive(get: () => DuelStore): void {
  const index = get().currentStepIndex
  if (index !== null) get().previewStepBoard(index)
}

function derivedPositionAt(
  prev: DerivationSource,
  index: number
): { turn: number; phase: DuelPhase; turnPlayer: 0 | 1 } {
  const steps = prev.state.steps || []
  if (index <= 0 || steps.length === 0) {
    return { turn: prev.currentTurn, phase: prev.currentPhase, turnPlayer: prev.activeTurnPlayer }
  }
  const anchor = steps[Math.min(index, steps.length) - 1]
  return { turn: anchor.turn, phase: anchor.phase, turnPlayer: anchor.turnPlayer }
}

const PHASE_ORDER: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

type MarkerPosition = { turn: number; phase: DuelPhase; turnPlayer: 0 | 1 }

function insertMarkerAtPlayhead(
  get: () => DuelStore,
  set: (updater: (prev: DuelStore) => Partial<DuelStore>) => void,
  buildMarker: (pos: MarkerPosition) => DuelStep
): void {
  const before = get()
  const insertIndex =
    before.currentStepIndex === null
      ? (before.state.steps || []).length
      : before.currentStepIndex + 1
  set((prev) => {
    const nextSteps = [...(prev.state.steps || [])]
    nextSteps.splice(insertIndex, 0, buildMarker(derivedPositionAt(prev, insertIndex)))
    return withDerivation({ ...prev, state: { ...prev.state, steps: nextSteps } })
  })
  if (before.currentStepIndex !== null) get().previewStepBoard(insertIndex)
}

export const createStepsSlice: StateCreator<DuelStore, [], [], StepsSlice> = (set, get) => ({
  activeRightTab: 'search',
  currentStepIndex: null,
  isScreenplayOpen: false,
  selectedStepId: null,

  currentTurn: 1,
  currentPhase: 'DP',
  currentChain: 0,
  activeTurnPlayer: 0,
  duelStarted: false,

  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  setSelectedStepId: (id) => set({ selectedStepId: id }),
  openScreenplayWithStep: (stepId) => {
    set((prev) => ({
      selectedStepId:
        stepId !== undefined ? stepId : prev.selectedStepId || prev.state.steps?.[0]?.id || null
    }))
    void window.api.openScreenplayWindow()
  },

  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setCurrentChain: (chain) => set({ currentChain: chain }),
  resetChain: () => set((prev) => (prev.currentChain === 0 ? prev : { currentChain: 0 })),

  setTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: { ...prev.state, turnPlayer: player }
    })),

  setDuelStarted: (started) => set({ duelStarted: started }),

  addStep: (stepData) => {
    set((prev) => {
      const newStep: DuelStep = {
        ...stepData,
        id: createStepId()
      }
      const existing = prev.state.steps || []
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: [...existing, newStep]
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  insertStep: (step) => {
    set((prev) => {
      const existing = prev.state.steps || []
      if (existing.some((s) => s.id === step.id)) return prev
      const at = prev.currentStepIndex === null ? existing.length : prev.currentStepIndex + 1
      const nextSteps = [...existing]
      nextSteps.splice(at, 0, step)
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: nextSteps
        }
      }
      return withDerivation(nextState)
    })
  },

  updateStep: (stepId, patch) => {
    set((prev) => {
      const existing = prev.state.steps || []
      const nextState: DerivationSource = {
        ...prev,
        state: {
          ...prev.state,
          steps: existing.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
        }
      }
      return withDerivation(nextState)
    })
    refreshPreviewIfActive(get)
  },

  deleteStep: (stepId) => {
    const prevSteps = get().state.steps || []
    const deletedIdx = prevSteps.findIndex((s) => s.id === stepId)
    if (deletedIdx === -1) return
    const prevPlayhead = get().currentStepIndex
    const engineActive = useDuelEngineStore.getState().isInitialized
    set((prev) => {
      const remaining = (prev.state.steps || []).filter((s) => s.id !== stepId)
      const source: DerivationSource = { ...prev, state: { ...prev.state, steps: remaining } }
      if (engineActive) return { state: source.state }
      return deriveDeletionPatch(source, deletedIdx) ?? { state: source.state }
    })
    if (engineActive) {
      if (prevPlayhead !== null) get().previewStepBoard(prevPlayhead)
      return
    }
    const remaining = get().state.steps || []
    if (remaining.length === 0) {
      get().previewStepBoard(null)
      set((prev) =>
        prev.currentTurn === 1 && prev.currentPhase === 'DP' && prev.currentChain === 0
          ? prev
          : { currentTurn: 1, currentPhase: 'DP', currentChain: 0 }
      )
      return
    }
    const target =
      prevPlayhead === null
        ? remaining.length - 1
        : deletedIdx < prevPlayhead
          ? Math.max(0, prevPlayhead - 1)
          : Math.min(prevPlayhead, remaining.length - 1)
    get().previewStepBoard(target)
  },

  moveStep: (stepId, direction) => {
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
      return withDerivation({ ...prev, state: { ...prev.state, steps: existing } })
    })
    refreshPreviewIfActive(get)
  },

  insertPhaseChange: () => {
    if (useDuelEngineStore.getState().isInitialized) return
    insertMarkerAtPlayhead(get, set, (pos) => {
      const isTurnRoll = pos.phase === 'EP'
      const flip = (pos.turnPlayer === 0 ? 1 : 0) as 0 | 1
      return {
        id: createStepId(),
        turn: pos.turn,
        turnPlayer: isTurnRoll ? flip : pos.turnPlayer,
        phase: isTurnRoll ? 'DP' : (PHASE_ORDER[PHASE_ORDER.indexOf(pos.phase) + 1] ?? 'DP'),
        actionPlayer: isTurnRoll ? flip : pos.turnPlayer,
        actionType: isTurnRoll ? 'TURN_CHANGE' : 'PHASE_CHANGE',
        description: isTurnRoll ? '回合结束，进入下一回合' : '阶段推进'
      }
    })
  },

  insertTurnChange: () => {
    if (useDuelEngineStore.getState().isInitialized) return
    insertMarkerAtPlayhead(get, set, (pos) => ({
      id: createStepId(),
      turn: pos.turn,
      turnPlayer: pos.turnPlayer,
      phase: pos.phase,
      actionPlayer: (pos.turnPlayer === 0 ? 1 : 0) as 0 | 1,
      actionType: 'TURN_CHANGE',
      description: '回合结束，进入下一回合'
    }))
  },

  insertPhaseJump: (target: DuelPhase) => {
    if (useDuelEngineStore.getState().isInitialized) return
    insertMarkerAtPlayhead(get, set, (pos) => ({
      id: createStepId(),
      turn: pos.turn,
      turnPlayer: pos.turnPlayer,
      phase: target,
      actionPlayer: pos.turnPlayer,
      actionType: 'PHASE_CHANGE',
      description: '阶段推进'
    }))
  },

  previewStepBoard: (stepIndex) => {
    const engineRunning = useDuelEngineStore.getState().isInitialized
    if (engineRunning) get().pauseUndoTracking()
    try {
      set((prev) => {
        const steps = prev.state.steps || []
        const targetStep = stepIndex === null ? undefined : steps[stepIndex]
        const snapshot =
          stepIndex === null ? prev.state.initialBoardSnapshot : targetStep?.boardAfter

        const previewReturn =
          engineRunning && prev.previewReturn === null
            ? {
                state: structuredClone(prev.state),
                currentTurn: prev.currentTurn,
                currentPhase: prev.currentPhase,
                currentChain: prev.currentChain,
                activeTurnPlayer: prev.activeTurnPlayer
              }
            : prev.previewReturn

        if (stepIndex === null || !targetStep) {
          if (!snapshot || snapshot.length === 0) {
            return {
              currentStepIndex: stepIndex === null ? null : stepIndex,
              previewReturn: prev.previewReturn
            }
          }
          return {
            currentStepIndex: null,
            previewReturn,
            state: { ...prev.state, cards: restoreCardsFromSnapshot(prev.state.cards, snapshot) }
          }
        }

        const lpChange = targetStep.lpChange
        let nextPlayers = prev.state.players
        let nextDuelists = prev.state.duelists
        let lpFlash = prev.lpFlash
        if (lpChange) {
          const players: [PlayerState, PlayerState] = [...prev.state.players]
          const target = players[lpChange.player]
          if (target) {
            players[lpChange.player] = { ...target, lp: lpChange.newLp }
            if (target.lp !== lpChange.newLp) {
              lpFlash = createLpFlash(lpChange.player, lpChange.newLp - target.lp)
            }
          }
          nextPlayers = players
          nextDuelists = applyLpToDuelists(
            prev.state.duelists,
            lpChange.player,
            lpChange.newLp,
            prev.state.matchConfig
          )
        }

        return {
          currentStepIndex: stepIndex,
          previewReturn,
          currentTurn: targetStep.turn,
          currentPhase: targetStep.phase,
          currentChain: targetStep.chainIndex ?? 0,
          activeTurnPlayer: targetStep.turnPlayer,
          lpFlash,
          state: {
            ...prev.state,
            cards:
              snapshot && snapshot.length > 0
                ? restoreCardsFromSnapshot(prev.state.cards, snapshot)
                : prev.state.cards,
            players: nextPlayers,
            duelists: nextDuelists
          }
        }
      })
    } finally {
      if (engineRunning) get().resumeUndoTracking()
    }
  },

  resetToOpeningBoard: () =>
    set((prev) => {
      const snapshot = prev.state.initialBoardSnapshot ?? []
      const restoredCards = restoreCardsFromSnapshot(prev.state.cards, snapshot)
      const restoredIds = new Set(restoredCards.map((c) => c.instanceId))
      const extras = prev.state.cards.filter((c) => !restoredIds.has(c.instanceId))

      const teamDuelistId = (controller: 0 | 1): string => {
        const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
        return teamDuelists[0]?.id || `duelist_${controller}_0`
      }
      let finalCards = restoredCards
      for (const extra of extras) {
        finalCards = insertPileTop(
          finalCards,
          extra,
          teamDuelistId(extra.controller),
          homePileLocation(extra)
        )
      }

      const firstPlayer = ((prev.state.steps || [])[0]?.turnPlayer ?? 0) as 0 | 1
      return {
        currentStepIndex: null,
        currentTurn: 1,
        currentPhase: 'DP',
        currentChain: 0,
        duelStarted: false,
        activeTurnPlayer: firstPlayer,
        state: { ...prev.state, steps: [], cards: finalCards, turnPlayer: firstPlayer }
      }
    })
})
