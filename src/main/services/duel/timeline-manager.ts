import { EngineTimelineNode, EngineBoardState, EnginePendingAction } from '@shared/index'

export interface EngineStepRecord {
  node: EngineTimelineNode
  responseToNext?: Uint8Array
  snapshot: Uint8Array
  pendingMsgRaw?: Uint8Array
}

export class EngineTimelineManager {
  private steps = new Map<string, EngineStepRecord>()
  private currentStepId: string | null = null
  private rootStepId: string | null = null

  clear(): void {
    this.steps.clear()
    this.currentStepId = null
    this.rootStepId = null
  }

  addStep(
    title: string,
    player: 0 | 1,
    boardState: EngineBoardState,
    pendingAction: EnginePendingAction | null,
    logs: string[],
    snapshot: Uint8Array,
    responseFromParent?: Uint8Array,
    pendingMsgRaw?: Uint8Array
  ): EngineTimelineNode {
    const parentId = this.currentStepId
    const parent = parentId ? this.steps.get(parentId) : null
    const stepNumber = parent ? parent.node.stepNumber + 1 : 1

    const id = `step-${stepNumber}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    if (parent && responseFromParent) {
      parent.responseToNext = responseFromParent
    }

    const node: EngineTimelineNode = {
      id,
      parentId,
      stepNumber,
      title,
      player,
      logs,
      boardState,
      pendingAction,
      createdAt: Date.now()
    }

    this.steps.set(id, {
      node,
      snapshot,
      pendingMsgRaw
    })

    if (!this.rootStepId) {
      this.rootStepId = id
    }

    this.currentStepId = id
    return node
  }

  getCurrentStep(): EngineStepRecord | null {
    if (!this.currentStepId) return null
    return this.steps.get(this.currentStepId) || null
  }

  getStep(id: string): EngineStepRecord | null {
    return this.steps.get(id) || null
  }

  setCurrentStepId(id: string): boolean {
    if (this.steps.has(id)) {
      this.currentStepId = id
      return true
    }
    return false
  }

  getAllNodes(): EngineTimelineNode[] {
    const list: EngineTimelineNode[] = []
    for (const record of this.steps.values()) {
      list.push(record.node)
    }
    return list.sort((a, b) => a.stepNumber - b.stepNumber)
  }

  getHistoryPath(targetId = this.currentStepId): EngineTimelineNode[] {
    const path: EngineTimelineNode[] = []
    let curr = targetId ? this.steps.get(targetId) : null
    while (curr) {
      path.unshift(curr.node)
      curr = curr.node.parentId ? this.steps.get(curr.node.parentId) : null
    }
    return path
  }
}
