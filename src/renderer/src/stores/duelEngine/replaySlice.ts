import type { StateCreator } from 'zustand'
import { DuelPuzzleState, EngineReplaySummary } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { buildPuzzleStateFromEngineBoard } from '../../utils/engineBoardToPuzzle'
import { syncJumpToStepWrapped } from './boardReconcile'
import { clearIdentities } from './identityMap'
import { clearEngineSteps, restoreEngineSteps } from './stepRecords'
import type { DuelEngineStore } from './types'

export interface ReplaySlice {
  replayInfo: EngineReplaySummary | null
  preReplayPuzzle: DuelPuzzleState | null
  importReplay: () => Promise<boolean>
  convertReplayToPuzzle: () => boolean
}

type ReplaySliceCreator = StateCreator<DuelEngineStore, [], [], ReplaySlice>

export const createReplaySlice: ReplaySliceCreator = (set, get) => ({
  replayInfo: null,
  preReplayPuzzle: null,

  importReplay: async () => {
    if (get().replayInfo) {
      get().stopEngine()
    }
    set({ loading: true, error: null })
    try {
      const preReplayPuzzle = structuredClone(useDuelStore.getState().state)
      const res = await window.api.duelEngineImportReplay()
      if (!res.success || !res.payload) {
        set({ loading: false, error: res.error ?? '导入 YRP 录像失败' })
        return false
      }
      const { info, boardState, timeline, currentStepId } = res.payload
      clearEngineSteps()
      clearIdentities()
      useDuelStore.getState().exitPreview()
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        error: null,
        boardState,
        pendingRequest: null,
        lastAttacker: null,
        timeline,
        currentStepId,
        replayInfo: info,
        preReplayPuzzle,
        injectNotice: {
          kind: 'success',
          message: info.warning
            ? `已载入回放（${timeline.length - 1}/${info.totalSteps} 步）：${info.warning}`
            : `已载入回放：${info.fileName}（共 ${timeline.length - 1} 步）`
        }
      })
      syncJumpToStepWrapped(boardState)
      restoreEngineSteps(timeline)
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] importReplay failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '导入 YRP 录像失败'
      })
      return false
    }
  },

  convertReplayToPuzzle: () => {
    const { boardState, replayInfo } = get()
    if (!boardState || !replayInfo) return false
    const puzzle = buildPuzzleStateFromEngineBoard(boardState, {
      title: `${replayInfo.hostName} vs ${replayInfo.clientName}`.trim() || replayInfo.fileName,
      hostName: replayInfo.hostName,
      clientName: replayInfo.clientName
    })
    void window.api.duelEngineExitReplay().catch(() => undefined)
    clearEngineSteps()
    clearIdentities()
    useDuelStore.getState().exitPreview()
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      error: null,
      replayInfo: null,
      preReplayPuzzle: null,
      boardState: null,
      pendingRequest: null,
      lastAttacker: null,
      timeline: [],
      currentStepId: null
    })
    useDuelStore.getState().loadState(puzzle)
    return true
  }
})
