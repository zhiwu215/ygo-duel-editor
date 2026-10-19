import type { StateCreator } from 'zustand'
import {
  DuelPhase,
  DuelStep,
  FieldCard,
  PlayerState,
  createLightweightSnapshot
} from '@shared/index'
import { useDuelEngineStore } from '../useDuelEngineStore'
import type { DuelStore } from './types'
import { isAutoRecordingPaused } from './recordingGate'

export interface StepsSlice {
  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  isScreenplayOpen: boolean
  selectedStepId: string | null

  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1
  isAutoRecording: boolean

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setIsScreenplayOpen: (open: boolean) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  nextPhase: () => void
  nextTurn: () => void
  setActiveTurnPlayer: (player: 0 | 1) => void
  setIsAutoRecording: (recording: boolean) => void
  setTurnPlayer: (player: 0 | 1) => void

  addStep: (step: Omit<DuelStep, 'id'>) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void
  clearSteps: () => void

  previewStepBoard: (stepIndex: number | null) => void
}

export const createStepsSlice: StateCreator<DuelStore, [], [], StepsSlice> = (set, get) => ({
  activeRightTab: 'search',
  currentStepIndex: null,
  isScreenplayOpen: false,
  selectedStepId: null,

  currentTurn: 1,
  currentPhase: 'M1',
  currentChain: 0,
  activeTurnPlayer: 0,
  isAutoRecording: true,

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

  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setCurrentChain: (chain) => set({ currentChain: chain }),
  resetChain: () =>
    set((prev) => {
      if (prev.currentChain === 0) return prev
      let nextSteps = prev.state.steps || []
      if (prev.isAutoRecording && !isAutoRecordingPaused()) {
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
        if (prev.isAutoRecording && !isAutoRecordingPaused()) {
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
        if (prev.isAutoRecording && !isAutoRecordingPaused()) {
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
            turnPlayer: nextActive,
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
      if (prev.isAutoRecording && !isAutoRecordingPaused()) {
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
          turnPlayer: nextActive,
          steps: nextSteps
        }
      }
    }),
  setActiveTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: {
        ...prev.state,
        turnPlayer: player
      }
    })),
  setIsAutoRecording: (recording) => set({ isAutoRecording: recording }),

  setTurnPlayer: (player) =>
    set((prev) => ({
      activeTurnPlayer: player,
      state: { ...prev.state, turnPlayer: player }
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

  previewStepBoard: (stepIndex) => {
    const engineRunning = useDuelEngineStore.getState().isInitialized
    if (engineRunning) get().pauseUndoTracking()
    try {
      set((prev) => {
        const steps = prev.state.steps || []
        const targetStep = stepIndex === null ? undefined : steps[stepIndex]
        const snapshot =
          stepIndex === null ? prev.state.initialBoardSnapshot : targetStep?.boardAfter
        if (!snapshot || snapshot.length === 0) {
          return {
            currentStepIndex: stepIndex === null ? null : stepIndex,
            previewReturn: prev.previewReturn
          }
        }

        const cardMap = new Map(prev.state.cards.map((c) => [c.instanceId, c]))
        const restoredCards: FieldCard[] = snapshot.map((s) => {
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

        if (!targetStep) {
          return {
            currentStepIndex: null,
            previewReturn,
            state: { ...prev.state, cards: restoredCards }
          }
        }

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
          previewReturn,
          pendingPlacement: null,
          currentTurn: targetStep.turn,
          currentPhase: targetStep.phase,
          currentChain: targetStep.chainIndex ?? 0,
          activeTurnPlayer: targetStep.turnPlayer,
          state: { ...prev.state, cards: restoredCards, players: nextPlayers }
        }
      })
    } finally {
      if (engineRunning) get().resumeUndoTracking()
    }
  }
})
