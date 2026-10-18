import { EngineTimelineNode, EngineBoardState, EngineRequest } from '@shared/index'

export interface EngineStepRecord {
  node: EngineTimelineNode
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
    pendingRequest: EngineRequest | null,
    logs: string[],
    opIndex: number
  ): EngineTimelineNode {
    const parentId = this.currentStepId
    const parent = parentId ? this.steps.get(parentId) : null
    const stepNumber = parent ? parent.node.stepNumber + 1 : 1

    const id = `step-${stepNumber}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    const node: EngineTimelineNode = {
      id,
      parentId,
      stepNumber,
      title,
      player,
      logs,
      boardState,
      pendingRequest,
      opIndex,
      createdAt: Date.now()
    }

    this.steps.set(id, { node })

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

  retainHistory(id: string): void {
    const path = this.getHistoryPath(id)
    if (path.length === 0) return
    const allowed = new Set(path.map((node) => node.id))
    for (const key of [...this.steps.keys()]) {
      if (!allowed.has(key)) this.steps.delete(key)
    }
    this.currentStepId = id
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
