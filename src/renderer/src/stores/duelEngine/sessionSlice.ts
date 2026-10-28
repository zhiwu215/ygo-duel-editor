import type { StateCreator } from 'zustand'
import {
  DuelChainCard,
  EngineDuelInitParams,
  EngineSessionDoc,
  InjectCommand,
  alignFirstPlayerSeat,
  computeBoardFingerprint,
  createLightweightSnapshot,
  isEngineSupportedMatch,
  normalizeTimingPolicy,
  resolveOpeningSnapshot,
  reversePileSequences,
  reverseStepBoards
} from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { detachStepsFromTimeline } from '../../utils/stepHistory'
import { syncJumpToStepWrapped } from './boardReconcile'
import { cancelLpSequence } from './lpSequence'
import { chainStateAtNode } from './chainState'
import { engineErrorMessage } from './engineErrorMessage'
import { clearIdentities } from './identityMap'
import { recordOpeningStep } from './stepRecording'
import {
  appendDiscardNotice,
  clearEngineSteps,
  discardFutureSteps,
  restoreEngineSteps,
  splitTimeline
} from './stepRecords'
import { syncEngineStepsFromTimeline } from './stepRecordSync'
import type { DuelEngineStore } from './types'

type EngineMode = 'idle' | 'running' | 'paused'

interface EngineInjectNotice {
  kind: 'success' | 'warning'
  message: string
}

function enterEnginePileOrder(): void {
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...prev.state, cards: reversePileSequences(prev.state.cards) }
  }))
}

function preserveStepsForNewSession(reverseBoards: boolean): void {
  useDuelStore.setState((prev) => {
    const steps = prev.state.steps
    if (!steps || steps.length === 0) return prev
    const detached = detachStepsFromTimeline(steps)
    return {
      ...prev,
      state: {
        ...prev.state,
        steps: reverseBoards ? reverseStepBoards(detached) : detached
      }
    }
  })
}

function dropStaleEngineSteps(): void {
  useDuelStore.setState((prev) => {
    const steps = prev.state.steps
    if (!steps || steps.length === 0) return prev
    const kept = steps.filter((step) => step.origin !== 'engine')
    if (kept.length === steps.length) return prev
    return {
      ...prev,
      currentStepIndex: null,
      selectedStepId: null,
      state: { ...prev.state, steps: kept }
    }
  })
}

function restoreStepPileOrder(): void {
  useDuelStore.setState((prev) => {
    const steps = prev.state.steps
    if (!steps || steps.length === 0) return prev
    return { ...prev, state: { ...prev.state, steps: reverseStepBoards(steps) } }
  })
}

export interface SessionSlice {
  engineMode: EngineMode
  isInitialized: boolean
  loading: boolean
  error: string | null
  injectNotice: EngineInjectNotice | null
  boardChains: DuelChainCard[]
  mergedMatch: boolean
  suspendedDoc: EngineSessionDoc | null

  startEngine: (options?: { allowMergedMatch?: boolean }) => Promise<void>
  stopEngine: () => void
  suspendEngine: () => Promise<void>
  resumeSuspended: () => Promise<boolean>
  resumeSuspendedFromStart: () => Promise<boolean>
  setSuspendedDoc: (doc: EngineSessionDoc | null) => void
  inject: (command: InjectCommand) => Promise<boolean>
  clearInjectNotice: () => void
  clearError: () => void
  getSessionDoc: () => Promise<EngineSessionDoc | null>
  restoreSessionDoc: (doc: EngineSessionDoc) => Promise<boolean>
}

export const createSessionSlice: StateCreator<DuelEngineStore, [], [], SessionSlice> = (
  set,
  get
) => ({
  engineMode: 'idle',
  isInitialized: false,
  loading: false,
  error: null,
  injectNotice: null,
  boardChains: [],
  mergedMatch: false,
  suspendedDoc: null,

  startEngine: async (options) => {
    cancelLpSequence()
    const support = window.api.getDuelEngineSupport ? await window.api.getDuelEngineSupport() : null
    if (support && !support.supported) {
      set({ loading: false, error: support.reason ?? '当前游戏目录不支持内置引擎。' })
      return
    }
    const matchConfig = useDuelStore.getState().state.matchConfig
    const mergedMatch = !isEngineSupportedMatch(matchConfig)
    if (mergedMatch && !options?.allowMergedMatch) {
      const team0Count = matchConfig?.team0Count ?? 1
      const team1Count = matchConfig?.team1Count ?? 1
      set({
        loading: false,
        error: `内置引擎只支持 1v1；${team0Count}v${team1Count} 需确认后以近似校验启动。`
      })
      return
    }
    if (useDuelStore.getState().sceneEditing) {
      useDuelStore.getState().exitSceneMode()
    }
    set({ loading: true, error: null })
    const wasInitialized = get().isInitialized
    try {
      const duelStore = useDuelStore.getState()
      const aligned = alignFirstPlayerSeat(duelStore.state)
      if (aligned !== duelStore.state) {
        duelStore.withSingleUndoStep(() =>
          useDuelStore.setState({ state: aligned, activeTurnPlayer: aligned.turnPlayer })
        )
      }
      const currentDuelState = structuredClone(aligned)
      if ((currentDuelState.steps ?? []).length === 0) {
        const openingCards = createLightweightSnapshot(currentDuelState.cards)
        const initialLp: [number, number] = [
          currentDuelState.players[0]?.lp ?? 8000,
          currentDuelState.players[1]?.lp ?? 8000
        ]
        useDuelStore.setState((prev) => ({
          ...prev,
          state: {
            ...prev.state,
            initialBoardSnapshot: openingCards,
            initialLp
          }
        }))
        currentDuelState.initialBoardSnapshot = openingCards
        currentDuelState.initialLp = initialLp
      } else {
        const openingSnapshot = resolveOpeningSnapshot(currentDuelState)
        if (openingSnapshot) currentDuelState.initialBoardSnapshot = openingSnapshot
      }
      duelStore.commitPreview()
      await window.api.duelEngineSetPolicy(get().timingPolicy)

      const initParams: EngineDuelInitParams = {
        puzzleState: currentDuelState
      }

      const res = await window.api.duelEngineInit(initParams)
      clearEngineSteps()
      if (!wasInitialized) {
        clearIdentities()
        enterEnginePileOrder()
        dropStaleEngineSteps()
      }
      preserveStepsForNewSession(!wasInitialized)
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        mergedMatch,
        suspendedDoc: null,
        boardState: res.boardState,
        pendingRequest: res.pendingRequest,
        lastAttacker: null,
        boardChains: chainStateAtNode(timeline, res.initialNode.id),
        timeline,
        currentStepId: res.initialNode.id
      })
      syncJumpToStepWrapped(res.boardState)
      restoreEngineSteps(get().timeline)
      recordOpeningStep(res.initialNode, res.boardState)
      get().playStepEffects(res.initialNode)
      useDuelStore.setState({ duelStarted: true })
    } catch (err) {
      console.error('[useDuelEngineStore] startEngine failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        isInitialized: false,
        mergedMatch: false,
        error: engineErrorMessage(err, '启动决斗引擎失败')
      })
    }
  },

  stopEngine: () => {
    cancelLpSequence()
    const { replayInfo, preReplay } = get()
    useDuelStore.getState().exitPreview()
    if (replayInfo) {
      void window.api.duelEngineExitReplay().catch(() => undefined)
      if (preReplay) {
        useDuelStore.getState().loadState(preReplay.state)
        useDuelStore.setState((prev) => ({
          ...prev,
          currentTurn: preReplay.currentTurn,
          currentPhase: preReplay.currentPhase,
          currentChain: preReplay.currentChain,
          activeTurnPlayer: preReplay.activeTurnPlayer
        }))
      }
    } else {
      useDuelStore.setState((prev) => ({
        ...prev,
        state: {
          ...prev.state,
          cards: reversePileSequences(prev.state.cards),
          steps: prev.state.steps?.map((step) =>
            step.boardAfter ? { ...step, boardAfter: reversePileSequences(step.boardAfter) } : step
          )
        }
      }))
    }
    clearEngineSteps()
    clearIdentities()
    get().clearStepEffects()
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      mergedMatch: false,
      error: null,
      injectNotice: null,
      boardChains: [],
      pendingRequest: null,
      lastAttacker: null,
      replayInfo: null,
      preReplay: null
    })
  },

  suspendEngine: async () => {
    if (!get().isInitialized) return
    if (get().replayInfo) {
      get().stopEngine()
      return
    }
    useDuelStore.getState().exitPreview()
    const doc = await get().getSessionDoc()
    if (!doc) {
      set({ error: '无法读取引擎会话快照，已保留当前会话。' })
      return
    }
    const boardFingerprint = computeBoardFingerprint(useDuelStore.getState().state, {
      enginePileOrder: true
    })
    set({ suspendedDoc: { ...doc, suspended: true, boardFingerprint } })
    get().stopEngine()
  },

  resumeSuspended: async () => {
    const doc = get().suspendedDoc
    if (!doc) return false
    useDuelStore.getState().exitPreview()
    return get().restoreSessionDoc(doc)
  },

  resumeSuspendedFromStart: async () => {
    const doc = get().suspendedDoc
    if (!doc) return false
    const start = doc.timeline.find((node) => node.parentId === null) ?? doc.timeline[0]
    if (!start) return false
    if (start.id === doc.currentStepId) return get().resumeSuspended()
    useDuelStore.getState().exitPreview()
    return get().restoreSessionDoc({ ...doc, currentStepId: start.id })
  },

  setSuspendedDoc: (doc) => set({ suspendedDoc: doc }),

  inject: async (command) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法执行注入。' })
      return false
    }
    cancelLpSequence()
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineInject(command)
      const prevTimeline = get().timeline
      const previewExited = useDuelStore.getState().previewReturn !== null
      useDuelStore.getState().exitPreview()
      const { kept, dropped } = splitTimeline(prevTimeline, get().currentStepId)
      const discarded = discardFutureSteps(kept, dropped)
      const nextTimeline = [...kept, res.node]
      const notice = {
        kind: res.warning ? ('warning' as const) : ('success' as const),
        message: `${appendDiscardNotice(
          res.warning ? `${res.node.title}：${res.warning}` : res.node.title,
          discarded
        )}${previewExited ? '（已退出步骤预览）' : ''}`
      }
      set({
        loading: false,
        error: null,
        boardState: res.boardState,
        pendingRequest: res.node.pendingRequest ?? null,
        boardChains: chainStateAtNode(nextTimeline, res.node.id),
        timeline: nextTimeline,
        currentStepId: res.node.id,
        injectNotice: notice
      })
      syncJumpToStepWrapped(res.boardState)
      restoreEngineSteps(get().timeline)
      get().playStepEffects(res.node)
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] inject failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '注入执行失败'
      })
      return false
    }
  },

  clearInjectNotice: () => set({ injectNotice: null }),
  clearError: () => set({ error: null }),

  getSessionDoc: async () => {
    try {
      const res = await window.api.getDuelEngineSessionDoc()
      return res.success && res.doc ? res.doc : null
    } catch (err) {
      console.error('[useDuelEngineStore] getSessionDoc failed:', err)
      return null
    }
  },

  restoreSessionDoc: async (doc) => {
    cancelLpSequence()
    set({ loading: true, error: null })
    try {
      const res = await window.api.restoreDuelEngineSession(doc)
      if (!res.success || !res.payload) {
        set({
          loading: false,
          engineMode: 'idle',
          isInitialized: false,
          error: res.error ?? '恢复引擎会话失败'
        })
        return false
      }
      const payload = res.payload
      clearEngineSteps()
      clearIdentities()
      get().clearStepEffects()
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        mergedMatch: false,
        error: null,
        suspendedDoc: null,
        boardState: payload.boardState,
        pendingRequest: payload.pendingRequest ?? null,
        lastAttacker: null,
        boardChains: chainStateAtNode(payload.timeline, payload.currentStepId),
        timeline: payload.timeline,
        currentStepId: payload.currentStepId,
        timingPolicy: normalizeTimingPolicy(doc.timingPolicy)
      })
      syncJumpToStepWrapped(payload.boardState)
      restoreEngineSteps(payload.timeline)
      syncEngineStepsFromTimeline(payload.timeline)
      useDuelStore.setState({ sceneEditing: false })
      if (doc.suspended) restoreStepPileOrder()
      useDuelStore.setState({ duelStarted: true })
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] restoreSessionDoc failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        isInitialized: false,
        error: engineErrorMessage(err, '恢复引擎会话失败')
      })
      return false
    }
  }
})
