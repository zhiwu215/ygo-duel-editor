import type { StateCreator } from 'zustand'
import { EngineReplaySummary } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { buildPuzzleStateFromEngineBoard } from '../../utils/engineBoardToPuzzle'
import { buildReplayMatchState, formatReplayVersus } from '../../utils/replayMatch'
import { snapshotEngineBoard } from '../../utils/engineBoardSnapshot'
import { reversePileSequences } from '../../utils/pileSequences'
import { buildReplaySteps } from '../../utils/replayTimelineToSteps'
import { mapPhaseToDuelPhase, syncJumpToStepWrapped } from './boardReconcile'
import { clearIdentities } from './identityMap'
import { clearEngineSteps, recordEngineStep } from './stepRecords'
import type { PreviewReturn } from '../duel/previewSlice'
import type { DuelEngineStore } from './types'

export interface ReplaySlice {
  replayInfo: EngineReplaySummary | null
  importingReplay: boolean
  preReplay: PreviewReturn | null
  importReplay: () => Promise<boolean>
  convertReplayToPuzzle: () => boolean
}

type ReplaySliceCreator = StateCreator<DuelEngineStore, [], [], ReplaySlice>

export const createReplaySlice: ReplaySliceCreator = (set, get) => ({
  replayInfo: null,
  importingReplay: false,
  preReplay: null,

  importReplay: async () => {
    const hadReplay = get().replayInfo !== null
    const unsubscribe = window.api.onReplayImportStarting(() => {
      set({ importingReplay: true })
    })
    set({ loading: true, error: null, importingReplay: false })
    try {
      const duel = useDuelStore.getState()
      const preReplay: PreviewReturn = get().preReplay ?? {
        state: structuredClone(duel.state),
        currentTurn: duel.currentTurn,
        currentPhase: duel.currentPhase,
        currentChain: duel.currentChain,
        activeTurnPlayer: duel.activeTurnPlayer
      }
      const res = await window.api.duelEngineImportReplay()
      if (!res.success || !res.payload) {
        if (!res.canceled && hadReplay) get().stopEngine()
        set({
          loading: false,
          importingReplay: false,
          error: res.canceled ? null : (res.error ?? '导入 YRP 录像失败')
        })
        return false
      }
      const { info, boardState, timeline, currentStepId } = res.payload
      const replayInfo = { ...info, ...(res.filePath ? { filePath: res.filePath } : {}) }
      clearEngineSteps()
      clearIdentities()
      useDuelStore.getState().exitPreview()
      const replaySteps = buildReplaySteps(timeline)
      for (const step of replaySteps) recordEngineStep(step.actId!, step)
      const initialNode = timeline[0]
      const replayMatch = buildReplayMatchState(info, initialNode?.boardState ?? boardState)
      useDuelStore.setState((prev) => ({
        ...prev,
        state: {
          ...prev.state,
          masterRule: info.masterRule,
          steps: replaySteps,
          matchConfig: replayMatch.matchConfig,
          duelists: replayMatch.duelists,
          players: [
            { ...prev.state.players[0], lp: replayMatch.lp[0] },
            { ...prev.state.players[1], lp: replayMatch.lp[1] }
          ],
          turnPlayer: replayMatch.turnPlayer
        },
        duelStarted: true
      }))
      set({
        engineMode: 'running',
        isInitialized: true,
        loading: false,
        importingReplay: false,
        mergedMatch: false,
        error: null,
        boardState: initialNode ? initialNode.boardState : boardState,
        pendingRequest: null,
        boardChains: [],
        lastAttacker: null,
        timeline,
        currentStepId: initialNode ? initialNode.id : currentStepId,
        replayInfo,
        preReplay,
        injectNotice: {
          kind: 'success',
          message: info.warning
            ? `已载入回放（${replaySteps.length} 个场面变化步骤）：${info.warning}`
            : `已载入回放：${info.fileName}（共 ${replaySteps.length} 个场面变化步骤）`
        }
      })
      if (initialNode) {
        syncJumpToStepWrapped(initialNode.boardState)
      } else {
        syncJumpToStepWrapped(boardState)
      }
      const firstStep = replaySteps[0]
      if (firstStep) {
        const duelStore = useDuelStore.getState()
        duelStore.setCurrentTurn(firstStep.turn)
        duelStore.setCurrentPhase(firstStep.phase)
        duelStore.setTurnPlayer(firstStep.turnPlayer)
      }
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] importReplay failed:', err)
      set({
        loading: false,
        importingReplay: false,
        error: err instanceof Error ? err.message : '导入 YRP 录像失败'
      })
      return false
    } finally {
      unsubscribe()
      set({ importingReplay: false })
    }
  },

  convertReplayToPuzzle: () => {
    const { boardState, replayInfo, timeline, currentStepId } = get()
    if (!boardState || !replayInfo) return false
    const nodeById = new Map(timeline.map((node) => [node.id, node]))
    const replaySteps = useDuelStore.getState().state.steps ?? []
    const forkIndex = currentStepId
      ? replaySteps.findIndex((step) => step.actId === currentStepId)
      : -1
    const steps = replaySteps.slice(0, forkIndex + 1).map((step) => {
      const node = step.actId ? nodeById.get(step.actId) : undefined
      return node
        ? {
            ...step,
            boardAfter: reversePileSequences(
              snapshotEngineBoard(node.boardState, replayInfo.masterRule)
            )
          }
        : step
    })
    const puzzle = buildPuzzleStateFromEngineBoard(boardState, {
      title: formatReplayVersus(replayInfo) || replayInfo.fileName,
      hostName: replayInfo.hostName,
      clientName: replayInfo.clientName,
      masterRule: replayInfo.masterRule
    })
    puzzle.cards = reversePileSequences(puzzle.cards)
    puzzle.steps = steps
    const openingBoard = steps.length === 0 ? boardState : timeline[0]?.boardState
    if (openingBoard) {
      puzzle.initialBoardSnapshot = reversePileSequences(
        snapshotEngineBoard(openingBoard, replayInfo.masterRule)
      )
      puzzle.initialLp = [openingBoard.players[0].lp, openingBoard.players[1].lp]
    }
    void window.api.duelEngineExitReplay().catch(() => undefined)
    clearEngineSteps()
    clearIdentities()
    useDuelStore.getState().exitPreview()
    set({
      engineMode: 'idle',
      isInitialized: false,
      loading: false,
      mergedMatch: false,
      error: null,
      replayInfo: null,
      preReplay: null,
      boardState: null,
      pendingRequest: null,
      lastAttacker: null,
      boardChains: [],
      timeline: [],
      currentStepId: null
    })
    useDuelStore.getState().loadState(puzzle)
    const forkStep = forkIndex >= 0 ? steps[forkIndex] : undefined
    useDuelStore.setState({
      duelStarted: true,
      currentStepIndex: forkIndex >= 0 ? forkIndex : null,
      currentTurn: forkStep?.turn ?? boardState.turn,
      currentPhase: forkStep?.phase ?? mapPhaseToDuelPhase(boardState.phase),
      activeTurnPlayer: forkStep?.turnPlayer ?? boardState.turnPlayer
    })
    return true
  }
})
