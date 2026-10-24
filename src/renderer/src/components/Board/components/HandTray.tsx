import React from 'react'
import { CardLocation, Duelist } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import {
  orderEditorCardsByEngineHand,
  useDuelEngineStore
} from '../../../stores/useDuelEngineStore'
import { SingleHandTray } from './SingleHandTray'
import { MultiHandTray } from './MultiHandTray'

interface HandTrayProps {
  controller: 0 | 1
  isTop: boolean
}

const HandTrayBase: React.FC<HandTrayProps> = ({ controller, isTop }) => {
  const state = useDuelStore((s) => s.state)
  const engineBoardState = useDuelEngineStore((s) => s.boardState)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)

  const rawDuelists = (state.duelists || []).filter((d) => d.team === controller)
  const totalCount = state.duelists?.length || 2
  const duelists: Duelist[] =
    rawDuelists.length > 0
      ? rawDuelists
      : [
          {
            id: `duelist_${controller}_0`,
            team: controller,
            name: controller === 0 ? '我方' : '对方',
            lp: state.players[controller]?.lp ?? 8000,
            isFirst: controller === 0,
            turnOrder: controller === 0 ? 1 : 2
          }
        ]

  const localHandCards = state.cards
    .filter((c) => c.controller === controller && c.location === CardLocation.HAND)
    .sort((a, b) => a.sequence - b.sequence)

  const teamHandCards =
    (isEngineActive
      ? orderEditorCardsByEngineHand(controller, localHandCards, engineBoardState)
      : null) ?? localHandCards

  if (duelists.length === 1) {
    return (
      <SingleHandTray
        duelist={duelists[0]}
        controller={controller}
        isTop={isTop}
        cards={teamHandCards}
        totalCount={totalCount}
      />
    )
  }

  return (
    <MultiHandTray
      duelists={duelists}
      controller={controller}
      isTop={isTop}
      teamHandCards={teamHandCards}
      totalCount={totalCount}
    />
  )
}

export const HandTray = React.memo(HandTrayBase)
