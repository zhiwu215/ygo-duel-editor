import {
  CardLocation,
  DuelLogEvent,
  DuelStep,
  EngineCard,
  EngineTimelineNode,
  isPlaceholderCard
} from '@shared/index'
import { resolveCardName } from '../../utils/cardNames'
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

function drawnCardInstanceId(
  step: DuelStep,
  board: NonNullable<DuelStep['boardAfter']>
): string | undefined {
  if (step.instanceId && board.some((item) => item.instanceId === step.instanceId)) {
    return step.instanceId
  }
  const hand = board.filter(
    (item) => item.controller === step.actionPlayer && item.location === CardLocation.HAND
  )
  if (hand.length === 0) return undefined
  if (step.toSequence !== undefined) {
    const atSequence = hand.find((item) => item.sequence === step.toSequence)
    if (atSequence) return atSequence.instanceId
  }
  const sameCode = step.cardCode ? hand.filter((item) => item.code === step.cardCode) : []
  const candidates = sameCode.length > 0 ? sameCode : hand
  return candidates.reduce((best, item) => (item.sequence > best.sequence ? item : best)).instanceId
}

function patchStepBoardAfter(
  step: DuelStep,
  card: { code: number; controller: 0 | 1; location: number; sequence: number; position?: number }
): DuelStep['boardAfter'] {
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
  const drawTargetId = step.actionType === 'DRAW' ? drawnCardInstanceId(step, board) : undefined
  let changed = false
  const next = board.map((item) => {
    if (item.code !== step.cardCode) return item
    const atFrom =
      step.actionType !== 'DRAW' &&
      from.location !== undefined &&
      from.sequence !== undefined &&
      item.controller === from.controller &&
      item.location === from.location &&
      item.sequence === from.sequence
    const atTo =
      step.actionType !== 'DRAW' &&
      to.location !== undefined &&
      to.sequence !== undefined &&
      item.controller === to.controller &&
      item.location === to.location &&
      item.sequence === to.sequence
    const isDrawMatch = drawTargetId !== undefined && item.instanceId === drawTargetId
    if (!atFrom && !atTo && !isDrawMatch) return item
    changed = true
    return {
      ...item,
      code: card.code,
      controller: card.controller,
      location: card.location,
      sequence: step.actionType === 'DRAW' ? item.sequence : card.sequence,
      position: card.position ?? item.position
    }
  })
  return changed ? next : board
}

function humanizeEngineLog(text: string): string {
  return text
    .replace(/^Player 0: /, '我方：')
    .replace(/^Player 1: /, '对方：')
    .replace(/\s*\[\s*\]\s*$/, '')
}

function resolveTargetCard(
  step: DuelStep,
  node: EngineTimelineNode
): { code: number; name: string; card?: EngineCard } | null {
  const position = stepPosition(step)
  if (position) {
    const found = node.boardState.allCards.find(
      (item) =>
        item.controller === position.controller &&
        item.location === position.location &&
        item.sequence === position.sequence
    )
    if (found) {
      return {
        code: found.code,
        name: found.card?.name ?? resolveCardName(found.code),
        card: found
      }
    }
  }

  if (step.actionType === 'DRAW') {
    const draw = node.logEvents?.find(
      (e): e is Extract<DuelLogEvent, { kind: 'draw' }> => e.kind === 'draw'
    )
    const first = draw?.cards?.[0]
    if (first && first.code > 0) {
      return {
        code: first.code,
        name: first.name || resolveCardName(first.code)
      }
    }
  }

  if (node.logEvents) {
    for (const event of node.logEvents) {
      if (event.kind === 'summon' || event.kind === 'set' || event.kind === 'activate') {
        if (
          step.cardCode &&
          (event.card.code === step.cardCode || isPlaceholderCard(step.cardCode))
        ) {
          return {
            code: event.card.code,
            name: event.card.name ?? resolveCardName(event.card.code)
          }
        }
      }
    }
  }

  return null
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
    if (fromOpIndex >= 0 && node.opIndex < fromOpIndex) return step
    const targetCard = resolveTargetCard(step, node)
    if (!targetCard) return step
    const name = targetCard.name
    if (step.cardCode === targetCard.code && step.cardName === name) return step
    const oldName = step.cardName
    const cardData = targetCard.card ?? {
      code: targetCard.code,
      controller: step.toController ?? step.fromController ?? step.actionPlayer,
      location: step.toLocation ?? CardLocation.HAND,
      sequence: step.toSequence ?? 0,
      position: step.toPosition
    }
    const boardAfter = patchStepBoardAfter(step, cardData)
    const description =
      step.description && oldName && oldName !== name
        ? step.description.split(oldName).join(name)
        : humanizeEngineLog(node.title)
    const texts = step.texts?.map((block) => ({
      ...block,
      text:
        oldName && block.text.includes(oldName) ? block.text.split(oldName).join(name) : block.text
    }))
    const logEvents = node.logEvents ?? step.logEvents
    changed = true
    const updated: DuelStep = {
      ...step,
      cardCode: targetCard.code,
      cardName: name,
      boardAfter,
      description,
      logEvents,
      ...(texts ? { texts } : {})
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
