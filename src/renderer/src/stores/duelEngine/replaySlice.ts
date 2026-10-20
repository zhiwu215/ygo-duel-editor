import type { StateCreator } from 'zustand'
import { EngineReplaySummary } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { buildPuzzleStateFromEngineBoard } from '../../utils/engineBoardToPuzzle'
import { buildReplaySteps } from '../../utils/replayTimelineToSteps'
import { syncJumpToStepWrapped } from './boardReconcile'
import { clearIdentities } from './identityMap'
import { clearEngineSteps, recordEngineStep } from './stepRecords'
import type { PreviewReturn } from '../duel/previewSlice'
import type { DuelEngineStore } from './types'

export interface ReplaySlice {
  replayInfo: EngineReplaySummary | null
  preReplay: PreviewReturn | null
  importReplay: () => Promise<boolean>
  convertReplayToPuzzle: () => boolean
}

type ReplaySliceCreator = StateCreator<DuelEngineStore, [], [], ReplaySlice>

export const createReplaySlice: ReplaySliceCreator = (set, get) => ({
  replayInfo: null,
  preReplay: null,

  importReplay: async () => {
    if (get().replayInfo) {
      get().stopEngine()
    }
    set({ loading: true, error: null })
    try {
      const duel = useDuelStore.getState()
      const preReplay: PreviewReturn = {
        state: structuredClone(duel.state),
        currentTurn: duel.currentTurn,
        currentPhase: duel.currentPhase,
        currentChain: duel.currentChain,
        activeTurnPlayer: duel.activeTurnPlayer
      }
      const res = await window.api.duelEngineImportReplay()
      if (!res.success || !res.payload) {
        set({ loading: false, error: res.error ?? '导入 YRP 录像失败' })
        return false
      }
      const { info, boardState, timeline, currentStepId } = res.payload
      clearEngineSteps()
      clearIdentities()
      useDuelStore.getState().exitPreview()
      const replaySteps = buildReplaySteps(timeline)
      for (const step of replaySteps) recordEngineStep(step.actId!, step)
      useDuelStore.setState((prev) => ({
        ...prev,
        state: { ...prev.state, steps: replaySteps },
        duelStarted: true
      }))
      const initialNode = timeline[0]
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        error: null,
        boardState: initialNode ? initialNode.boardState : boardState,
        pendingRequest: null,
        lastAttacker: null,
        timeline,
        currentStepId: initialNode ? initialNode.id : currentStepId,
        replayInfo: info,
        preReplay,
        injectNotice: {
          kind: 'success',
          message: info.warning
            ? `已载入回放（${timeline.length - 1}/${info.totalSteps} 步）：${info.warning}`
            : `已载入回放：${info.fileName}（共 ${timeline.length - 1} 步）`
        }
      })
      if (initialNode) {
        syncJumpToStepWrapped(initialNode.boardState)
      } else {
        syncJumpToStepWrapped(boardState)
      }
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
      preReplay: null,
      boardState: null,
      pendingRequest: null,
      lastAttacker: null,
      timeline: [],
      currentStepId: null
    })
    useDuelStore.getState().loadState(puzzle)
    useDuelStore.setState({ duelStarted: true })
    return true
  }
})
