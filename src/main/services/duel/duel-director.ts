import fs from 'fs'
import path from 'path'
import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineCardEditResult,
  EngineCardRef,
  EngineProvenance,
  EngineRequest,
  EngineSubmitAnswerResult,
  Answer,
  EngineInjectResult,
  InjectCommand,
  TimingPolicy,
  EngineSessionDoc,
  EngineSessionImportPayload
} from '@shared/index'
import { getOcgcoreEngine } from './ocgcore-engine'
import { duelSession } from './duel-session'
import type { EngineReplayStartPayload } from './replay-session'

export class DuelDirector {
  private static instance: DuelDirector

  static getInstance(): DuelDirector {
    if (!DuelDirector.instance) {
      DuelDirector.instance = new DuelDirector()
    }
    return DuelDirector.instance
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

  submitAnswer(answer: Answer): EngineSubmitAnswerResult {
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

  getPendingRequest(): EngineRequest | null {
    return duelSession.getPendingRequest()
  }

  getProvenance(ref: EngineCardRef): EngineProvenance {
    return duelSession.getProvenance(ref)
  }

  replaceCard(ref: EngineCardRef, newCode: number): EngineCardEditResult {
    return duelSession.replaceCard(ref, newCode)
  }

  removeCard(ref: EngineCardRef): EngineCardEditResult {
    return duelSession.removeCard(ref)
  }

  getAllTimelineResponses(): Uint8Array[] {
    return duelSession.getAllTimelineResponses()
  }

  recordMessageStream(): { messages: Uint8Array[]; responses: Uint8Array[] } {
    return duelSession.recordMessageStream()
  }

  exportSessionDoc(): EngineSessionDoc {
    return duelSession.exportSessionDoc()
  }

  importSessionDoc(doc: EngineSessionDoc): Promise<EngineSessionImportPayload> {
    return duelSession.importSessionDoc(doc)
  }

  startReplay(bytes: Uint8Array, fileName: string): Promise<EngineReplayStartPayload> {
    return duelSession.startReplay(bytes, fileName)
  }

  exitReplay(): void {
    duelSession.exitReplay()
  }
}

export const duelDirector = DuelDirector.getInstance()
