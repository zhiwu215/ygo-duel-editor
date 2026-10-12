import fs from 'fs'
import path from 'path'
import {
  EngineDuelInitParams,
  EnginePendingAction,
  EngineTimelineNode,
  EngineBoardState
} from '@shared/index'
import { getOcgcoreEngine, isEngineReady } from './ocgcore-engine'
import { duelSession, SubmitActionResult } from './duel-session'

export class DuelDirector {
  private static instance: DuelDirector

  static getInstance(): DuelDirector {
    if (!DuelDirector.instance) {
      DuelDirector.instance = new DuelDirector()
    }
    return DuelDirector.instance
  }

  isReady(): boolean {
    return isEngineReady()
  }

  getVersion(): string {
    try {
      const entry = require.resolve('koishipro-core.js') as string
      const pkg = JSON.parse(
        fs.readFileSync(path.join(path.dirname(entry), '../package.json'), 'utf-8')
      ) as { version?: string }
      return pkg.version || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async initEngine(): Promise<void> {
    await getOcgcoreEngine()
  }

  startDuel(params: EngineDuelInitParams): Promise<{
    boardState: EngineBoardState
    pendingAction: EnginePendingAction | null
    initialNode: EngineTimelineNode
  }> {
    return duelSession.startDuel(params)
  }

  submitAction(optionId: string, payload?: unknown): SubmitActionResult {
    return duelSession.submitAction(optionId, payload)
  }

  jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    pendingAction: EnginePendingAction | null
    currentStepId: string
  }> {
    return duelSession.jumpToStep(stepId)
  }

  getTimeline(): EngineTimelineNode[] {
    return duelSession.getTimeline()
  }

  getBoardState(): EngineBoardState {
    return duelSession.getBoardState()
  }

  getPendingAction(): EnginePendingAction | null {
    return duelSession.getPendingAction()
  }

  getAllTimelineResponses(): Uint8Array[] {
    return duelSession.getAllTimelineResponses()
  }
}

export const duelDirector = DuelDirector.getInstance()
