import type {
  DuelChainCard,
  EngineBoardState,
  EngineStepEvent,
  EngineTimelineNode
} from '@shared/index'

function findChainCard(
  board: EngineBoardState | undefined,
  controller: 0 | 1,
  location: number,
  sequence: number
): string | undefined {
  return board?.allCards.find(
    (card) =>
      card.controller === controller && card.location === location && card.sequence === sequence
  )?.instanceId
}

export function applyChainEvents(
  chains: DuelChainCard[],
  events: EngineStepEvent[],
  previousBoard?: EngineBoardState,
  currentBoard?: EngineBoardState
): DuelChainCard[] {
  let next = chains
  for (const event of events) {
    if (event.kind === 'chain') {
      next = [
        ...next,
        {
          controller: event.controller,
          location: event.location,
          sequence: event.sequence,
          index: event.chainCount,
          instanceId:
            findChainCard(previousBoard, event.controller, event.location, event.sequence) ??
            findChainCard(currentBoard, event.controller, event.location, event.sequence)
        }
      ]
    } else if (event.kind === 'chain-solving') {
      next = next.map((chain) =>
        chain.index === event.chainCount ? { ...chain, solved: true } : chain
      )
    } else if (event.kind === 'chain-end') {
      next = []
    }
  }
  return next
}

export function chainStateAtNode(
  timeline: EngineTimelineNode[],
  nodeId: string | null
): DuelChainCard[] {
  if (!nodeId) return []
  const index = timeline.findIndex((node) => node.id === nodeId)
  if (index < 0) return []
  let chains: DuelChainCard[] = []
  for (let i = 0; i <= index; i += 1) {
    chains = applyChainEvents(
      chains,
      timeline[i].events,
      timeline[i - 1]?.boardState,
      timeline[i].boardState
    )
  }
  return chains
}

export function visibleChains(chains: DuelChainCard[]): DuelChainCard[] {
  if (chains.length <= 1) return []
  const solved = chains.filter((chain) => chain.solved).map((chain) => chain.index)
  const firstSolved = solved.length > 0 ? Math.min(...solved) : Number.POSITIVE_INFINITY
  return chains.filter((chain) => chain.index < firstSolved)
}
