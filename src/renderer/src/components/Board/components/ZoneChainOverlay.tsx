import React from 'react'
import { CardLocation } from '@shared/index'
import type { DuelChainCard, EngineBoardState } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { visibleChains } from '../../../stores/duelEngine/chainState'
import { normalizeEngineCardPosition } from '../../../utils/engineCardPosition'
import { cn } from '../../../lib/utils'
import { ChainRing } from './ChainRing'

interface ZoneChainOverlayProps {
  controller: 0 | 1
  location: number
  sequence: number
  compact: boolean
  ignoreSequence?: boolean
}

function resolvePosition(
  chains: DuelChainCard[],
  board: EngineBoardState | null,
  masterRule: number
): DuelChainCard[] {
  return chains.flatMap((chain) => {
    const card = chain.instanceId
      ? board?.allCards.find((item) => item.instanceId === chain.instanceId)
      : undefined
    const position = normalizeEngineCardPosition(
      masterRule,
      card?.location ?? chain.location,
      card?.sequence ?? chain.sequence
    )
    if (position.location === CardLocation.HAND && !card) return []
    return [
      {
        ...chain,
        controller: card?.controller ?? chain.controller,
        location: position.location,
        sequence: position.sequence
      }
    ]
  })
}

function matchZone(
  chains: DuelChainCard[],
  controller: 0 | 1,
  location: number,
  sequence: number,
  ignoreSequence: boolean
): DuelChainCard[] {
  const matchesLocation = (chain: DuelChainCard): boolean => {
    if (chain.location === location) {
      return ignoreSequence || chain.sequence === sequence
    }
    return (
      location === CardLocation.SZONE && sequence === 5 && chain.location === CardLocation.FZONE
    )
  }
  return chains
    .filter((chain) => chain.controller === controller && matchesLocation(chain))
    .sort((a, b) => a.index - b.index)
}

export const ZoneChainOverlay: React.FC<ZoneChainOverlayProps> = ({
  controller,
  location,
  sequence,
  compact,
  ignoreSequence = false
}) => {
  const chains = useDuelEngineStore((state) => state.boardChains)
  const board = useDuelEngineStore((state) => state.boardState)
  const masterRule = useDuelStore((state) => state.state.masterRule)
  const visible = matchZone(
    resolvePosition(visibleChains(chains), board, masterRule),
    controller,
    location,
    sequence,
    ignoreSequence
  )
  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className={cn('relative h-full', compact ? 'w-[68.6%]' : 'w-full')}>
        {visible.map((chain, order) => (
          <div
            key={chain.index}
            className="absolute left-0 w-full"
            style={{ top: `${50 - order * 25}%`, transform: 'translateY(-50%)' }}
          >
            <ChainRing index={chain.index} />
          </div>
        ))}
      </div>
    </div>
  )
}
