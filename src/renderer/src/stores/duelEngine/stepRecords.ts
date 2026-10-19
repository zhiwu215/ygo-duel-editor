import { DuelStep, EngineTimelineNode } from '@shared/index'
import { useDuelStore } from '../useDuelStore'

const engineSteps = new Map<string, DuelStep>()

export function hasEngineStep(id: string): boolean {
  return engineSteps.has(id)
}

export function recordEngineStep(id: string, step: DuelStep): void {
  engineSteps.set(id, step)
}

export function clearEngineSteps(): void {
  engineSteps.clear()
}

export function findHostStep(
  node: EngineTimelineNode,
  timeline: EngineTimelineNode[]
): { id: string; step: DuelStep } | null {
  const byId = new Map(timeline.map((n) => [n.id, n]))
  let cursor = node.parentId ? byId.get(node.parentId) : undefined
  while (cursor) {
    const stored = engineSteps.get(cursor.id)
    if (stored) return { id: cursor.id, step: stored }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return null
}

export function storeEngineStep(hostId: string, nextId: string | null, step: DuelStep): void {
  engineSteps.delete(hostId)
  const stored: DuelStep = nextId ? { ...step, actId: nextId } : step
  engineSteps.set(stored.actId ?? hostId, stored)
  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      steps: (prev.state.steps || []).map((s) => (s.actId === hostId ? stored : s))
    }
  }))
}

export function restoreEngineSteps(timeline: EngineTimelineNode[]): void {
  const present = new Set(
    (useDuelStore.getState().state.steps || [])
      .map((step) => step.actId)
      .filter((id): id is string => Boolean(id))
  )
  const restored = timeline
    .filter((node) => engineSteps.has(node.id) && !present.has(node.id))
    .map((node) => engineSteps.get(node.id)!)
  if (restored.length === 0) return
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...prev.state, steps: [...(prev.state.steps || []), ...restored] }
  }))
}

export function splitTimeline(
  timeline: EngineTimelineNode[],
  currentId: string | null
): { kept: EngineTimelineNode[]; dropped: EngineTimelineNode[] } {
  const index = timeline.findIndex((node) => node.id === currentId)
  if (index < 0) return { kept: timeline, dropped: [] }
  return { kept: timeline.slice(0, index + 1), dropped: timeline.slice(index + 1) }
}

export function discardFutureSteps(
  keptTimeline: EngineTimelineNode[],
  droppedTimeline: EngineTimelineNode[]
): number {
  if (droppedTimeline.length === 0) return 0
  const keptIds = new Set(keptTimeline.map((node) => node.id))
  const droppedIds = new Set(
    droppedTimeline.map((node) => node.id).filter((id) => !keptIds.has(id))
  )
  if (droppedIds.size === 0) return 0
  for (const id of droppedIds) engineSteps.delete(id)
  const steps = useDuelStore.getState().state.steps || []
  const next = steps.filter((step) => !step.actId || !droppedIds.has(step.actId))
  if (next.length !== steps.length) {
    useDuelStore.setState((prev) => ({ ...prev, state: { ...prev.state, steps: next } }))
  }
  return steps.length - next.length
}

export function appendDiscardNotice(message: string, discarded: number): string {
  return discarded > 0 ? `${message}（已丢弃之后的 ${discarded} 步）` : message
}
