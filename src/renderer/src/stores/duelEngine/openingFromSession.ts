import {
  createLightweightSnapshot,
  type DuelPuzzleState,
  type EngineSessionDoc,
  type EngineTimelineNode,
  type FieldCard
} from '@shared/index'
import { applyInjectionToOpening } from './openingInjection'

export function reconstructOpeningFromSession(doc: EngineSessionDoc): DuelPuzzleState | null {
  const base = doc.initParams.puzzleState
  if (!base) return null
  let opening = createLightweightSnapshot(base.cards)
  const nodes = [...doc.timeline].sort((left, right) => left.opIndex - right.opIndex)
  const current = doc.timeline.find((node) => node.id === doc.currentStepId)
  const maxOpIndex = current?.opIndex ?? doc.ops.length - 1
  let previous: EngineTimelineNode | undefined

  for (let index = 0; index <= maxOpIndex; index++) {
    const op = doc.ops[index]
    const node = nodes.find((item) => item.opIndex === index)
    if (op.type === 'inject' && !op.removed && op.command.op === 'add-card' && node && previous) {
      opening = applyInjectionToOpening({
        opening,
        before: previous.boardState,
        after: node.boardState,
        command: op.command,
        masterRule: base.masterRule,
        duelistIdOf: (controller) =>
          base.duelists?.find((duelist) => duelist.team === controller)?.id
      }).opening
    }
    if (node) previous = node
  }

  const cards: FieldCard[] = opening.map((card) => ({
    instanceId: card.instanceId,
    code: card.code,
    controller: card.controller,
    owner: card.owner ?? card.controller,
    location: card.location,
    sequence: card.sequence,
    position: card.position,
    overlayMaterials: [...(card.overlayMaterials ?? [])],
    duelistId: card.duelistId,
    customAtk: card.customAtk,
    customDef: card.customDef
  }))
  return {
    ...structuredClone(base),
    cards,
    steps: [],
    initialBoardSnapshot: opening,
    initialLp: base.initialLp ?? [base.players[0]?.lp ?? 8000, base.players[1]?.lp ?? 8000]
  }
}
