import type { StateCreator } from 'zustand'
import {
  DuelChainCard,
  EngineDuelInitParams,
  InjectCommand,
  isEngineSupportedMatch,
  normalizeTimingPolicy
} from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { reversePileSequences } from '../../utils/pileSequences'
import { buildReplaySteps } from '../../utils/replayTimelineToSteps'
import { syncJumpToStepWrapped } from './boardReconcile'
import { chainStateAtNode } from './chainState'
import { engineErrorMessage } from './engineErrorMessage'
import { clearIdentities } from './identityMap'
import {
  appendDiscardNotice,
  clearEngineSteps,
  clearEditorSteps,
  discardFutureSteps,
  recordEngineStep,
  restoreEngineSteps,
  splitTimeline
} from './stepRecords'
import type { DuelEngineStore } from './types'

type EngineMode = 'idle' | 'running' | 'paused'

interface EngineInjectNotice {
  kind: 'success' | 'warning'
  message: string
}

interface HandShuffleSignal {
  id: number
  players: (0 | 1)[]
  duelists?: string[]
}

function enterEnginePileOrder(): void {
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...prev.state, cards: reversePileSequences(prev.state.cards) }
  }))
}

export interface SessionSlice {
  engineMode: EngineMode
  isInitialized: boolean
  loading: boolean
  error: string | null
  injectNotice: EngineInjectNotice | null
  handShuffle: HandShuffleSignal | null
  boardChains: DuelChainCard[]
  mergedMatch: boolean

  startEngine: (options?: { allowMergedMatch?: boolean }) => Promise<void>
  stopEngine: () => void
  inject: (command: InjectCommand) => Promise<boolean>
  clearInjectNotice: () => void
  clearError: () => void
  exportSession: () => Promise<boolean>
  importSession: () => Promise<boolean>
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
  handShuffle: null,
  boardChains: [],
  mergedMatch: false,

  startEngine: async (options) => {
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
    set({ loading: true, error: null })
    const wasInitialized = get().isInitialized
    try {
      const duelStore = useDuelStore.getState()
      const currentDuelState = structuredClone(duelStore.state)
      duelStore.commitPreview()
      await window.api.duelEngineSetPolicy(get().timingPolicy)

      const initParams: EngineDuelInitParams = {
        puzzleState: currentDuelState
      }

      const res = await window.api.duelEngineInit(initParams)
      clearEngineSteps()
      if (!wasInitialized) clearEditorSteps()
      clearIdentities()
      if (!wasInitialized) enterEnginePileOrder()
      const timeline = [res.initialNode]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        mergedMatch,
        boardState: res.boardState,
        pendingRequest: res.pendingRequest,
        lastAttacker: null,
        boardChains: chainStateAtNode(timeline, res.initialNode.id),
        timeline,
        currentStepId: res.initialNode.id
      })
      syncJumpToStepWrapped(res.boardState)
      restoreEngineSteps(timeline)
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
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      mergedMatch: false,
      error: null,
      injectNotice: null,
      handShuffle: null,
      boardChains: [],
      pendingRequest: null,
      lastAttacker: null,
      replayInfo: null,
      preReplay: null
    })
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
  clearError: () => set({ error: null }),

  exportSession: async () => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法导出对局剧本。' })
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineExportSession()
      if (!res.success) {
        set({
          loading: false,
          error: res.canceled ? null : (res.error ?? '导出对局剧本失败')
        })
        return false
      }
      set({
        loading: false,
        error: null,
        injectNotice: {
          kind: 'success',
          message: `对局剧本已导出：${res.filePath ?? ''}`
        }
      })
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] exportSession failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '导出对局剧本失败'
      })
      return false
    }
  },

  importSession: async () => {
    set({ loading: true, error: null })
    const wasInitialized = get().isInitialized
    try {
      const res = await window.api.duelEngineImportSession()
      if (!res.success || !res.boardState || !res.timeline || !res.currentStepId) {
        set({
          loading: false,
          error: res.canceled ? null : (res.error ?? '导入对局剧本失败')
        })
        return false
      }
      const boardState = res.boardState
      const timeline = res.timeline
      const currentStepId = res.currentStepId
      const duelStore = useDuelStore.getState()
      duelStore.exitPreview()
      if (res.initParams?.puzzleState) {
        duelStore.loadProjectAndStart(structuredClone(res.initParams.puzzleState))
        clearEngineSteps()
        clearEditorSteps()
        clearIdentities()
        const scriptSteps = buildReplaySteps(timeline)
        for (const step of scriptSteps) {
          if (step.actId) recordEngineStep(step.actId, step)
        }
        useDuelStore.setState((prev) => ({
          ...prev,
          state: { ...prev.state, steps: scriptSteps }
        }))
        enterEnginePileOrder()
      } else {
        clearEngineSteps()
        clearEditorSteps()
        clearIdentities()
        if (!wasInitialized) enterEnginePileOrder()
      }
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        mergedMatch: false,
        error: null,
        boardState,
        pendingRequest: res.pendingRequest ?? null,
        lastAttacker: null,
        boardChains: chainStateAtNode(timeline, currentStepId),
        timeline,
        currentStepId,
        timingPolicy: normalizeTimingPolicy(res.timingPolicy ?? get().timingPolicy),
        injectNotice: {
          kind: 'success',
          message: `已载入对局剧本：${res.filePath ?? ''}`
        }
      })
      syncJumpToStepWrapped(boardState)
      restoreEngineSteps(timeline)
      useDuelStore.setState({ duelStarted: true })
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] importSession failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        isInitialized: false,
        error: err instanceof Error ? err.message : '导入对局剧本失败'
      })
      return false
    }
  }
})
