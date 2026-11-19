import type { DuelStep, EngineTimelineNode } from '@shared/index'

export function engineHistoryTargets(
  timeline: readonly EngineTimelineNode[],
  cursorId: string | null,
  steps: readonly DuelStep[] | undefined,
  isReplay: boolean
): { previous?: string; next?: string } {
  const cursor = timeline.findIndex((node) => node.id === cursorId)
  if (cursor < 0) return {}

  const stepStarts = new Set(steps?.map((step) => step.startActId ?? step.actId))
  const targets: { previous?: string; next?: string } = {}
  const addTarget = (index: number): void => {
    if (index < cursor) targets.previous = timeline[index].id
    if (index > cursor) targets.next ??= timeline[index].id
  }

  if (isReplay) {
    timeline.forEach((node, index) => {
      if (stepStarts.has(node.id)) addTarget(index)
    })
    return targets
  }

  addTarget(0)
  const actionStarts = [1]
  for (let index = 2; index < timeline.length; index++) {
    const answered = timeline[index - 1].pendingRequest?.kind
    if (
      answered === 'idle' ||
      answered === 'battle' ||
      (answered !== 'place' && stepStarts.has(timeline[index].id))
    ) {
      actionStarts.push(index)
    }
  }
  for (const [index, start] of actionStarts.entries()) {
    const end = actionStarts[index + 1] ?? timeline.length
    if (start === end) break
    const hasPlacement = timeline
      .slice(start, end)
      .some((node) => node.pendingRequest?.kind === 'place')
    if (hasPlacement) {
      addTarget(start - 1)
      addTarget(end - 1)
    } else if (stepStarts.has(timeline[start].id)) {
      addTarget(start)
    }
  }
  return targets
}
