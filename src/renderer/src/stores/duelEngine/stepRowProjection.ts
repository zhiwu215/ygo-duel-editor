import { DuelLogEvent, DuelStep, EngineTimelineNode } from '@shared/index'
import { useDuelStore } from '../useDuelStore'

function collectEvents(timeline: EngineTimelineNode[], start: number, end: number): DuelLogEvent[] {
  const events: DuelLogEvent[] = []
  for (let index = start; index <= end; index += 1) {
    const nodeEvents = timeline[index]?.logEvents
    if (nodeEvents && nodeEvents.length > 0) events.push(...nodeEvents)
  }
  return events
}

export function timelineStepEvents(
  timeline: EngineTimelineNode[],
  startId: string | null | undefined,
  endId: string | null | undefined
): DuelLogEvent[] | null {
  if (!startId) return null
  const start = timeline.findIndex((node) => node.id === startId)
  if (start < 0) return null
  const raw = endId ? timeline.findIndex((node) => node.id === endId) : start
  return collectEvents(timeline, start, raw < start ? start : raw)
}

export function isRootAnchoredStep(timeline: EngineTimelineNode[], step: DuelStep): boolean {
  const startId = step.startActId ?? step.actId
  if (!startId) return true
  const start = timeline.findIndex((node) => node.id === startId)
  return start < 0 || timeline[start].parentId === null
}

function sameEvents(left: DuelLogEvent[] | undefined, right: DuelLogEvent[]): boolean {
  if (!left || left.length !== right.length) return false
  return left.every((event, index) => event === right[index])
}

export function projectEngineStepRows(
  timeline: EngineTimelineNode[],
  cursorId: string | null
): void {
  if (!cursorId || timeline.length === 0) return
  const indexById = new Map(timeline.map((node, index) => [node.id, index] as const))
  const cursor = indexById.get(cursorId)
  if (cursor === undefined) return
  const steps = useDuelStore.getState().state.steps || []
  if (steps.length === 0) return
  let changed = false
  const next = steps.map((step) => {
    if (step.origin !== 'engine' || isRootAnchoredStep(timeline, step)) return step
    const startId = step.startActId ?? step.actId
    const start = startId ? indexById.get(startId) : undefined
    if (start === undefined || start > cursor) return step
    const endId = step.endActId ?? step.actId
    const end = endId ? (indexById.get(endId) ?? start) : start
    const events = collectEvents(timeline, start, Math.min(Math.max(end, start), cursor))
    if (sameEvents(step.logEvents, events)) return step
    changed = true
    return { ...step, logEvents: events }
  })
  if (!changed) return
  useDuelStore.setState((prev) => ({ ...prev, state: { ...prev.state, steps: next } }))
}
