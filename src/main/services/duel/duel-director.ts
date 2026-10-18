import fs from 'fs'
import path from 'path'
import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineRequest,
  Answer,
  EngineInjectResult,
  InjectCommand,
  TimingPolicy
} from '@shared/index'
import { getOcgcoreEngine, isEngineReady } from './ocgcore-engine'
import { duelSession, SubmitAnswerResult } from './duel-session'

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
    pendingRequest: EngineRequest | null
    initialNode: EngineTimelineNode
  }> {
    return duelSession.startDuel(params)
  }

  submitAnswer(answer: Answer): SubmitAnswerResult {
    return duelSession.submitAnswer(answer)
  }

  setTimingPolicy(policy: TimingPolicy): TimingPolicy {
    return duelSession.setTimingPolicy(policy)
  }

  inject(command: InjectCommand): EngineInjectResult {
    return duelSession.inject(command)
  }

  jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
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

  getPendingRequest(): EngineRequest | null {
    return duelSession.getPendingRequest()
  }

  getAllTimelineResponses(): Uint8Array[] {
    return duelSession.getAllTimelineResponses()
  }
}

export const duelDirector = DuelDirector.getInstance()
