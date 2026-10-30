import type { DuelPuzzleState, EngineSessionDoc, EngineTimelineNode } from '@shared/index'

export interface RebuiltSessionWithoutInjections {
  doc: EngineSessionDoc
  droppedInjections: number
  keptSteps: number
}

export function rebuildSessionWithoutInjections(
  doc: EngineSessionDoc,
  puzzleState: DuelPuzzleState
): RebuiltSessionWithoutInjections | null {
  const keptOps: EngineSessionDoc['ops'] = []
  const newIndexByOld = new Map<number, number>()
  let droppedInjections = 0

  doc.ops.forEach((op, oldIndex) => {
    if (op.type === 'inject') {
      droppedInjections += 1
      return
    }
    newIndexByOld.set(oldIndex, keptOps.length)
    keptOps.push(op)
  })
  if (droppedInjections === 0 || keptOps.length === 0) return null

  const byId = new Map(doc.timeline.map((node) => [node.id, node]))
  let cursor = byId.get(doc.currentStepId)
  const path: EngineTimelineNode[] = []
  const visited = new Set<string>()
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    path.push(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  path.reverse()

  const keptPath = path.filter((node) => doc.ops[node.opIndex]?.type !== 'inject')
  if (keptPath.length === 0) return null

  const timeline = keptPath.map((node, index) => {
    const mapped = node.opIndex < 0 ? node.opIndex : newIndexByOld.get(node.opIndex)
    return {
      ...node,
      parentId: index === 0 ? null : keptPath[index - 1].id,
      opIndex: mapped ?? -1
    }
  })
  const current = timeline[timeline.length - 1]

  return {
    doc: {
      ...doc,
      initParams: { ...doc.initParams, puzzleState },
      ops: keptOps,
      timeline,
      currentStepId: current.id,
      suspended: false,
      boardFingerprint: undefined
    },
    droppedInjections,
    keptSteps: timeline.length
  }
}
