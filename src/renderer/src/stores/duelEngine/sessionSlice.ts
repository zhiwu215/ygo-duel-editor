import type { StateCreator } from 'zustand'
import { EngineDuelInitParams, InjectCommand, normalizeTimingPolicy } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { syncJumpToStepWrapped } from './boardReconcile'
import { clearIdentities } from './identityMap'
import {
  appendDiscardNotice,
  clearEngineSteps,
  discardFutureSteps,
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
}

export interface SessionSlice {
  engineMode: EngineMode
  isInitialized: boolean
  loading: boolean
  error: string | null
  injectNotice: EngineInjectNotice | null
  handShuffle: HandShuffleSignal | null

  startEngine: () => Promise<void>
  stopEngine: () => void
  inject: (command: InjectCommand) => Promise<boolean>
  clearInjectNotice: () => void
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

  startEngine: async () => {
    set({ loading: true, error: null })
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
      clearIdentities()
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
      syncJumpToStepWrapped(res.boardState)
      restoreEngineSteps(timeline)
    } catch (err) {
      console.error('[useDuelEngineStore] startEngine failed:', err)
      set({
        loading: false,
        engineMode: 'idle',
        isInitialized: false,
        error: err instanceof Error ? err.message : '启动决斗引擎失败'
      })
    }
  },

  stopEngine: () => {
    const { replayInfo, preReplayPuzzle } = get()
    if (replayInfo) {
      void window.api.duelEngineExitReplay().catch(() => undefined)
      if (preReplayPuzzle) {
        useDuelStore.getState().loadState(preReplayPuzzle)
      }
    }
    clearEngineSteps()
    clearIdentities()
    useDuelStore.getState().exitPreview()
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      error: null,
      injectNotice: null,
      handShuffle: null,
      pendingRequest: null,
      lastAttacker: null,
      replayInfo: null,
      preReplayPuzzle: null
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
      set({
        loading: false,
        error: null,
        boardState: res.boardState,
        timeline: [...kept, res.node],
        currentStepId: res.node.id,
        injectNotice: {
          kind: res.warning ? 'warning' : 'success',
          message: `${appendDiscardNotice(
            res.warning ? `${res.node.title}：${res.warning}` : res.node.title,
            discarded
          )}${previewExited ? '（已退出步骤预览）' : ''}`
        }
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
      clearEngineSteps()
      clearIdentities()
      useDuelStore.getState().exitPreview()
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        error: null,
        boardState,
        pendingRequest: res.pendingRequest ?? null,
        lastAttacker: null,
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
