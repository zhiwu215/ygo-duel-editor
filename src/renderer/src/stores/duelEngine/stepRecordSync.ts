import { DuelStep, EngineCard, EngineTimelineNode } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { recordEngineStep } from './stepRecords'

function stepPosition(step: DuelStep): {
  controller: 0 | 1
  location: number
  sequence: number
} | null {
  const candidates = [
    {
      controller: step.toController ?? step.fromController ?? step.actionPlayer,
      location: step.toLocation,
      sequence: step.toSequence
    },
    {
      controller: step.fromController ?? step.actionPlayer,
      location: step.fromLocation,
      sequence: step.fromSequence
    }
  ]
  for (const candidate of candidates) {
    if (candidate.location === undefined || candidate.sequence === undefined) continue
    return {
      controller: candidate.controller,
      location: candidate.location,
      sequence: candidate.sequence
    }
  }
  return null
}

function patchStepBoardAfter(step: DuelStep, card: EngineCard): DuelStep['boardAfter'] {
  const board = step.boardAfter
  if (!board || board.length === 0) return board
  const from = {
    controller: step.fromController ?? step.actionPlayer,
    location: step.fromLocation,
    sequence: step.fromSequence
  }
  const to = {
    controller: step.toController ?? step.fromController ?? step.actionPlayer,
    location: step.toLocation,
    sequence: step.toSequence
  }
  let changed = false
  const next = board.map((item) => {
    if (item.code !== step.cardCode) return item
    const atFrom =
      from.location !== undefined &&
      from.sequence !== undefined &&
      item.controller === from.controller &&
      item.location === from.location &&
      item.sequence === from.sequence
    const atTo =
      to.location !== undefined &&
      to.sequence !== undefined &&
      item.controller === to.controller &&
      item.location === to.location &&
      item.sequence === to.sequence
    if (!atFrom && !atTo) return item
    changed = true
    return {
      ...item,
      code: card.code,
      controller: card.controller,
      location: card.location,
      sequence: card.sequence,
      position: card.position
    }
  })
  return changed ? next : board
}

export function syncEngineStepsFromTimeline(
  timeline: EngineTimelineNode[],
  fromOpIndex = -1
): void {
  const steps = useDuelStore.getState().state.steps || []
  if (steps.length === 0) return
  const byId = new Map(timeline.map((node) => [node.id, node] as const))
  let changed = false
  const next = steps.map((step) => {
    if (step.origin !== 'engine' || !step.actId) return step
    const node = byId.get(step.endActId ?? step.actId)
    if (!node) return step
    if (node.opIndex < fromOpIndex) return step
    const position = stepPosition(step)
    if (!position) return step
    const card = node.boardState.allCards.find(
      (item) =>
        item.controller === position.controller &&
        item.location === position.location &&
        item.sequence === position.sequence
    )
    if (!card) return step
    const name = card.card?.name ?? String(card.code)
    if (step.cardCode === card.code && step.cardName === name) return step
    const boardAfter = patchStepBoardAfter(step, card)
    const description =
      step.description && step.cardName && step.cardName !== name
        ? step.description.split(step.cardName).join(name)
        : step.description
    changed = true
    const updated: DuelStep = {
      ...step,
      cardCode: card.code,
      cardName: name,
      boardAfter,
      description
    }
    recordEngineStep(step.actId, updated)
    return updated
  })
  if (!changed) return
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...prev.state, steps: next }
  }))
}
