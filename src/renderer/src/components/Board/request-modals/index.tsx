import React from 'react'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { deriveSelection } from '../../../utils/duelSelection'
import { AnnounceModal } from './AnnounceModal'
import { CardSelectModal } from './CardSelectModal'
import { ChainModal } from './ChainModal'
import { CounterModal } from './CounterModal'
import { OptionModal } from './OptionModal'
import { PositionModal } from './PositionModal'
import { RpsModal } from './RpsModal'
import { SortModal } from './SortModal'
import { SumModal } from './SumModal'
import { YesNoModal } from './YesNoModal'

export const DuelRequestModals: React.FC = () => {
  const request = useDuelEngineStore((s) => s.pendingRequest)
  if (!request) return null

  const data = request.data
  const key = request.id

  switch (data.kind) {
    case 'yesno':
      return <YesNoModal key={key} request={request} data={data} />
    case 'option':
      return <OptionModal key={key} request={request} data={data} />
    case 'position':
      return <PositionModal key={key} request={request} data={data} />
    case 'announce':
      return <AnnounceModal key={key} request={request} data={data} />
    case 'counter':
      return <CounterModal key={key} request={request} data={data} />
    case 'sum': {
      if (deriveSelection(request)?.mode === 'point') return null
      return <SumModal key={key} request={request} data={data} />
    }
    case 'sort':
      return <SortModal key={key} request={request} data={data} />
    case 'rps':
      return <RpsModal key={key} request={request} />
    case 'chain':
      return <ChainModal key={key} request={request} data={data} />
    case 'card':
    case 'tribute': {
      if (deriveSelection(request)?.mode === 'point') return null
      return <CardSelectModal key={key} request={request} data={data} />
    }
    case 'idle':
    case 'battle':
    case 'place':
    case 'disfield':
    case 'unselect':
      return null
  }
}
