import { create } from 'zustand'
import { CdbCard, DuelStep, ManualOp, createLightweightSnapshot, createStepId } from '@shared/index'
import { isManualCapturePaused } from './duel/manualCaptureGate'
import { useDuelStore } from './duel'
import { useDuelEngineStore } from './duelEngine'

export interface ManualStagingSession {
  instanceId: string
  cardCode: number
  cardName: string
  controller: 0 | 1
  description: string
  ops: ManualOp[]
}

interface StagingState {
  session: ManualStagingSession | null
  begin: (session: Omit<ManualStagingSession, 'ops'>) => void
  pushOp: (op: ManualOp, cardData?: CdbCard) => void
  complete: () => void
}

const capturedCardData = new Map<number, CdbCard>()

export function findCapturedCardData(code: number): CdbCard | undefined {
  return capturedCardData.get(code)
}

export const useStagingStore = create<StagingState>((set, get) => ({
  session: null,

  begin: (session) => set({ session: { ...session, ops: [] } }),

  pushOp: (op, cardData) => {
    if (isManualCapturePaused()) return
    const { session } = get()
    if (!session) return
    if (op.type === 'add' && cardData) capturedCardData.set(cardData.id, cardData)
    set({ session: { ...session, ops: [...session.ops, op] } })
  },

  complete: () => {
    const session = get().session
    if (!session) return
    set({ session: null })
    const duel = useDuelStore.getState()
    const step: DuelStep = {
      id: createStepId(),
      turn: duel.currentTurn,
      turnPlayer: duel.activeTurnPlayer,
      phase: duel.currentPhase,
      actionPlayer: session.controller,
      actionType: 'ACTIVATE',
      cardCode: session.cardCode,
      cardName: session.cardName,
      description: session.description
        ? `发动【${session.cardName}】效果：${session.description}`
        : `发动【${session.cardName}】效果`,
      boardAfter: createLightweightSnapshot(duel.state.cards),
      manual: true,
      manualOps: session.ops,
      afterActId: useDuelEngineStore.getState().currentStepId ?? undefined
    }

    const selected = duel.currentStepIndex
    const total = (duel.state.steps || []).length
    if (selected !== null && selected < total - 1) {
      duel.insertStep(step)
      duel.setCurrentStepIndex(selected + 1)
    } else {
      duel.addStep(step)
    }
  }
}))
