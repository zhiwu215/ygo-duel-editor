import { EngineCardEditResult } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { syncJumpToStepWrapped } from './boardReconcile'
import {
  appendDiscardNotice,
  discardFutureSteps,
  restoreEngineSteps,
  splitTimeline
} from './stepRecords'
import { syncEngineStepsFromTimeline } from './stepRecordSync'
import type { DuelEngineStore } from './types'

export async function applyCardEditResult(
  get: () => DuelEngineStore,
  set: (partial: Partial<DuelEngineStore>) => void,
  res: EngineCardEditResult,
  successMessage: string
): Promise<boolean> {
  if (res.error) {
    set({ loading: false, error: res.error })
    return false
  }

  const prevTimeline = get().timeline
  const currentId = get().currentStepId
  const splitId =
    res.currentStepId && prevTimeline.some((node) => node.id === res.currentStepId)
      ? res.currentStepId
      : currentId
  const boundaryNode =
    prevTimeline.find((node) => node.id === splitId) ??
    prevTimeline.find((node) => node.id === currentId)
  const fromOpIndex = boundaryNode?.opIndex ?? -1
  const previewExited = useDuelStore.getState().previewReturn !== null
  useDuelStore.getState().exitPreview()
  const { kept, dropped } = splitTimeline(prevTimeline, splitId)
  const node = res.node
  const timeline = node
    ? kept.some((item) => item.id === node.id)
      ? kept.map((item) => (item.id === node.id ? node : item))
      : [...kept, node]
    : kept
  const currentStepId = res.currentStepId ?? node?.id ?? currentId
  const discarded = discardFutureSteps(kept, dropped)

  set({
    loading: false,
    error: null,
    boardState: res.boardState ?? get().boardState,
    pendingRequest: res.pendingRequest ?? null,
    timeline,
    currentStepId,
    injectNotice: {
      kind: res.warning ? 'warning' : 'success',
      message: `${appendDiscardNotice(res.warning ?? successMessage, discarded)}${previewExited ? '（已退出步骤预览）' : ''}`
    }
  })
  if (res.boardState) syncJumpToStepWrapped(res.boardState)
  restoreEngineSteps(timeline)
  syncEngineStepsFromTimeline(timeline, fromOpIndex)

  const latestTimeline = await window.api.duelEngineGetTimeline().catch(() => null)
  if (latestTimeline) {
    set({ timeline: latestTimeline })
    restoreEngineSteps(latestTimeline)
    syncEngineStepsFromTimeline(latestTimeline, fromOpIndex)
  }
  return true
}
