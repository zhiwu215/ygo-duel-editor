import type { StateCreator } from 'zustand'
import {
  Answer,
  EngineBoardState,
  EngineRequest,
  EngineSubmitAnswerResult,
  EngineTimelineNode,
  RequestCard
} from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { syncJumpToStepWrapped } from './boardReconcile'
import { discardFutureSteps, hasEngineStep, restoreEngineSteps, splitTimeline } from './stepRecords'
import { appendEngineStepFromAnswer } from './stepRecording'
import type { DuelEngineStore } from './types'

export interface RequestSlice {
  boardState: EngineBoardState | null
  pendingRequest: EngineRequest | null
  lastAttacker: RequestCard | null
  timeline: EngineTimelineNode[]
  currentStepId: string | null

  submitAnswer: (answer: Answer) => Promise<void>
  jumpToStep: (stepId: string) => Promise<boolean>
  undo: () => Promise<void>
  redo: () => Promise<void>
}

export const createRequestSlice: StateCreator<DuelEngineStore, [], [], RequestSlice> = (
  set,
  get
) => ({
  boardState: null,
  pendingRequest: null,
  lastAttacker: null,
  timeline: [],
  currentStepId: null,

  submitAnswer: async (answer) => {
    if (!get().pendingRequest) return
    set({ loading: true, error: null })
    try {
      const res: EngineSubmitAnswerResult = await window.api.duelEngineSubmitAnswer(answer)
      if (res.retry) {
        set({
          loading: false,
          pendingRequest: res.pendingRequest ?? get().pendingRequest,
          error: '该操作不合法，已被引擎拒绝，请重新选择。'
        })
        return
      }
      const prevTimeline = get().timeline
      const previewExited = useDuelStore.getState().previewReturn !== null
      useDuelStore.getState().exitPreview()
      const { kept, dropped } = splitTimeline(prevTimeline, get().currentStepId)
      const newTimeline = res.node ? [...kept, res.node] : prevTimeline
      const discarded = res.node ? discardFutureSteps(kept, dropped) : 0
      const shuffledPlayers = [
        ...new Set(
          (res.node?.events ?? [])
            .filter((event) => event.kind === 'shuffle-hand')
            .map((event) => event.player)
        )
      ]
      set({
        loading: false,
        error: null,
        boardState: res.boardState ?? get().boardState,
        pendingRequest: res.pendingRequest ?? null,
        lastAttacker:
          answer.kind === 'battle' && answer.cmd === 'ATTACK' && answer.card
            ? answer.card
            : get().lastAttacker,
        timeline: newTimeline,
        currentStepId: res.node?.id ?? get().currentStepId,
        handShuffle:
          shuffledPlayers.length > 0
            ? { id: Date.now(), players: shuffledPlayers }
            : get().handShuffle,
        injectNotice:
          discarded > 0
            ? { kind: 'warning', message: `已从该步骤重新编排，丢弃之后的 ${discarded} 步。` }
            : previewExited
              ? { kind: 'warning', message: '已退出步骤预览，回到引擎当前场面。' }
              : get().injectNotice
      })
      if (res.boardState) {
        syncJumpToStepWrapped(res.boardState)
      }
      if (res.node) {
        restoreEngineSteps(newTimeline)
      }
      if (res.node && res.diff) {
        const actContext =
          res.actTurn !== undefined && res.actTurnPlayer !== undefined && res.actPhase !== undefined
            ? { turn: res.actTurn, turnPlayer: res.actTurnPlayer, phase: res.actPhase }
            : undefined
        appendEngineStepFromAnswer(
          answer,
          res.node,
          res.diff,
          newTimeline,
          res.boardState ?? null,
          actContext
        )
      }
    } catch (err) {
      console.error('[useDuelEngineStore] submitAnswer failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '提交操作失败'
      })
    }
  },

  jumpToStep: async (stepId: string): Promise<boolean> => {
    if (!get().timeline.some((node) => node.id === stepId)) {
      console.warn(`[useDuelEngineStore] 步骤 ${stepId} 不在当前引擎时间线，已跳过跳转`)
      return false
    }
    set({ loading: true, error: null })
    try {
      const res = await window.api.duelEngineJumpToStep(stepId)
      const pendingRequest = await window.api
        .duelEngineGetPendingRequest()
        .catch(() => get().pendingRequest)
      const previewExited = useDuelStore.getState().previewReturn !== null
      useDuelStore.getState().exitPreview()
      set({
        loading: false,
        boardState: res.boardState,
        pendingRequest,
        currentStepId: res.currentStepId,
        injectNotice: previewExited
          ? { kind: 'warning', message: '已退出步骤预览，回到引擎当前场面。' }
          : get().injectNotice
      })
      syncJumpToStepWrapped(res.boardState)
      restoreEngineSteps(get().timeline)
      return true
    } catch (err) {
      console.error('[useDuelEngineStore] jumpToStep failed:', err)
      set({
        loading: false,
        error: err instanceof Error ? err.message : '回退/跳转步骤失败'
      })
      return false
    }
  },

  undo: async () => {
    const { timeline, currentStepId, jumpToStep } = get()
    if (!currentStepId || timeline.length === 0) return
    const currentIndex = timeline.findIndex((node) => node.id === currentStepId)
    if (currentIndex < 0) return
    const previous = [...timeline]
      .map((node, index) => ({ id: node.id, index }))
      .reverse()
      .find((item) => item.index < currentIndex && hasEngineStep(item.id))
    if (previous) await jumpToStep(previous.id)
  },

  redo: async () => {
    const { timeline, currentStepId, jumpToStep } = get()
    if (!currentStepId || timeline.length === 0) return
    const currentIndex = timeline.findIndex((node) => node.id === currentStepId)
    if (currentIndex < 0) return
    const next = timeline
      .map((node, index) => ({ id: node.id, index }))
      .find((item) => item.index > currentIndex && hasEngineStep(item.id))
    if (next) await jumpToStep(next.id)
  }
})
