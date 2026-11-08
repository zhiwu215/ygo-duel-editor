import {
  CardLocation,
  type EngineBoardState,
  type EngineCard,
  type EngineCardRef,
  type EngineTimelineNode
} from '@shared/index'
import type { SessionState } from './session-state'
import type { ProvenanceOrigin } from './provenance-tracker'
import { ReplayDivergenceError } from './replay-policy'
import { remapRecordedAnswers } from './answer-remap'
import { applyCardEditSource, type CardEditAction } from './card-edit-source'
import type { AnswerCodeRemap } from './answer-align'

export interface CardEditBase {
  ops: SessionState['ops']
  initParams: SessionState['initParams']
  timeline: EngineTimelineNode[]
  currentStepId: string
}

export interface CardEditReplayDeps {
  readBoard(): EngineBoardState
  truncateToCurrentStep(): void
  replayTo(stepId: string, freshIdentity: boolean, codeRemap?: AnswerCodeRemap): Promise<void>
  restoreTimeline(nodes: EngineTimelineNode[], currentStepId: string): void
}

export interface CardEditReplayArgs {
  action: CardEditAction
  origins: ProvenanceOrigin[]
  oldCode: number
  resolved: { instanceId: string; card: EngineCard }
  stepId: string
  base: CardEditBase
}

export interface CardEditReplayOutcome {
  origin?: ProvenanceOrigin
  missed?: ProvenanceOrigin
  divergence?: { error: ReplayDivergenceError; origin: ProvenanceOrigin }
  error?: unknown
}

export function captureCardEditBase(state: SessionState): CardEditBase {
  return {
    ops: structuredClone(state.ops),
    initParams: state.initParams ? structuredClone(state.initParams) : null,
    timeline: state.timeline.getAllNodes().map((node) => structuredClone(node)),
    currentStepId: state.timeline.getCurrentStep()?.node.id ?? ''
  }
}

export function restoreCardEditBase(
  state: SessionState,
  deps: CardEditReplayDeps,
  base: CardEditBase
): void {
  state.ops = structuredClone(base.ops)
  state.initParams = base.initParams ? structuredClone(base.initParams) : null
  deps.restoreTimeline(base.timeline, base.currentStepId)
}

export function prepareCardEditOrigin(
  state: SessionState,
  args: CardEditReplayArgs,
  origin: ProvenanceOrigin
): boolean {
  if (!applyCardEditSource(state, origin, args.action)) return false
  if (args.action.type === 'replace') {
    remapRecordedAnswers(state, args.oldCode, args.action.code, {
      controller: args.resolved.card.controller,
      location: args.resolved.card.location,
      sequence: args.resolved.card.sequence
    })
  }
  return true
}

export function cardEditCodeRemap(action: CardEditAction, oldCode: number): AnswerCodeRemap | null {
  if (action.type !== 'replace' || action.code === oldCode) return null
  return { oldCode, newCode: action.code }
}

async function replayCardEditOrigin(
  state: SessionState,
  deps: CardEditReplayDeps,
  args: CardEditReplayArgs,
  origin: ProvenanceOrigin
): Promise<unknown | null> {
  restoreCardEditBase(state, deps, args.base)
  if (!prepareCardEditOrigin(state, args, origin)) {
    return new Error('该卡的来源记录不存在，无法编辑。')
  }
  try {
    await deps.replayTo(
      args.stepId,
      true,
      cardEditCodeRemap(args.action, args.oldCode) ?? undefined
    )
    deps.truncateToCurrentStep()
    return null
  } catch (err) {
    return err
  }
}

export async function replayCardEdit(
  state: SessionState,
  deps: CardEditReplayDeps,
  args: CardEditReplayArgs
): Promise<CardEditReplayOutcome> {
  let missed: ProvenanceOrigin | undefined
  let divergence: CardEditReplayOutcome['divergence']
  let error: unknown

  for (const origin of args.origins) {
    const failure = await replayCardEditOrigin(state, deps, args, origin)
    if (failure) {
      if (failure instanceof ReplayDivergenceError && failure.forkStepId) {
        divergence ??= { error: failure, origin }
      } else {
        error ??= failure
      }
      continue
    }
    if (args.action.type === 'remove') return { origin }
    if (cardLandedAt(deps.readBoard(), args.resolved.card, args.action.code)) return { origin }
    missed ??= origin
  }

  return { missed, divergence, error }
}

export async function restoreCardEdit(
  state: SessionState,
  deps: CardEditReplayDeps,
  base: CardEditBase
): Promise<boolean> {
  restoreCardEditBase(state, deps, base)
  try {
    await deps.replayTo(base.currentStepId, true)
    return true
  } catch (err) {
    console.error('[card-editor] 回滚编辑后重演失败:', err)
    return false
  }
}

export function cardLandedAt(
  board: EngineBoardState,
  target: EngineCardRef,
  code: number
): boolean {
  const exactSequence =
    target.location !== CardLocation.DECK && target.location !== CardLocation.EXTRA
  return board.allCards.some(
    (card) =>
      card.code === code &&
      card.controller === target.controller &&
      card.location === target.location &&
      (!exactSequence || card.sequence === target.sequence)
  )
}
