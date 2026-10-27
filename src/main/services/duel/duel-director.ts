import fs from 'fs'
import path from 'path'
import {
  EngineDuelInitParams,
  EngineTimelineNode,
  EngineBoardState,
  EngineRequest,
  EngineSubmitAnswerResult,
  Answer,
  EngineInjectResult,
  InjectCommand,
  TimingPolicy,
  EngineSessionDoc,
  EngineSessionImportPayload,
  EngineCardRef,
  EngineCardEditResult,
  EngineProvenance
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

  inject(command: InjectCommand): Promise<EngineInjectResult> {
    return duelSession.inject(command)
  }

  jumpToStep(stepId: string): Promise<{
    boardState: EngineBoardState
    currentStepId: string
  }> {
    return duelSession.jumpToStep(stepId)
  }

  getProvenance(ref: EngineCardRef): EngineProvenance {
    return duelSession.getProvenance(ref)
  }

  async replaceCard(ref: EngineCardRef, newCode: number): Promise<EngineCardEditResult> {
    return duelSession.replaceCard(ref, newCode)
  }

  async removeCard(ref: EngineCardRef): Promise<EngineCardEditResult> {
    return duelSession.removeCard(ref)
  }

  getTimeline(): EngineTimelineNode[] {
    return duelSession.getTimeline()
  }

  getPendingRequest(): EngineRequest | null {
    return duelSession.getPendingRequest()
  }

  getAllTimelineResponses(skipInitialSetup = false, startOpIndex?: number): Uint8Array[] {
    return duelSession.getAllTimelineResponses(skipInitialSetup, startOpIndex)
  }

  getSeed(): number[] {
    return duelSession.getSeed()
  }

  getInitParams(): EngineDuelInitParams | null {
    return duelSession.getInitParams()
  }

  hasInjectOps(): boolean {
    return duelSession.hasInjectOps()
  }

  recordMessageStream(): Promise<{ messages: Uint8Array[]; responses: Uint8Array[] }> {
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
