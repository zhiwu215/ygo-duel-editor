import type { EngineTimelineNode } from '../types/duelEngine'
import type { EngineSessionDoc } from './sessionDoc'

export function branchEngineSession(doc: EngineSessionDoc, stepId: string): EngineSessionDoc {
  const byId = new Map(doc.timeline.map((node) => [node.id, node]))
  const target = byId.get(stepId)
  if (!target) throw new Error('该步骤没有可恢复的引擎记录，无法创建引擎分支。')
  const timeline: EngineTimelineNode[] = []
  const visited = new Set<string>()
  let node: EngineTimelineNode | undefined = target
  while (node) {
    if (visited.has(node.id)) throw new Error('引擎历史存在循环，无法创建分支。')
    visited.add(node.id)
    timeline.unshift(node)
    if (node.parentId === null) break
    node = byId.get(node.parentId)
    if (!node) throw new Error('引擎历史不完整，无法创建分支。')
  }
  if (target.opIndex < -1 || target.opIndex >= doc.ops.length) {
    throw new Error('引擎操作记录不完整，无法创建分支。')
  }
  const branch = structuredClone({
    ...doc,
    timeline,
    ops: doc.ops.slice(0, target.opIndex + 1),
    currentStepId: stepId
  })
  delete branch.suspended
  delete branch.boardFingerprint
  return branch
}
