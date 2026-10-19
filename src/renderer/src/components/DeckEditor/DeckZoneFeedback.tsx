import React from 'react'
import { useDndContext } from '@dnd-kit/core'
import { canPlaceInSection, CdbCard } from '@shared/index'
import { DeckDragSourceData, DeckDropTargetData } from './deckDnd'
import { Ban, Plus } from 'lucide-react'

export const DeckZoneFeedback: React.FC<{
  cardDetails: Record<number, CdbCard>
  isDragActive: boolean
}> = ({ cardDetails, isDragActive }) => {
  const { active, over } = useDndContext()
  const source = active?.data.current as DeckDragSourceData | undefined
  const target = over?.data.current as DeckDropTargetData | undefined
  const targetSection = target && target.kind !== 'search-panel' ? target.section : null
  if (!isDragActive || !source || !targetSection) return null

  const valid =
    source.source === 'search'
      ? canPlaceInSection(source.card.type, targetSection)
      : source.section === targetSection ||
        cardDetails[source.code] === undefined ||
        canPlaceInSection(cardDetails[source.code].type, targetSection)

  if (source.source !== 'search' && valid) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="w-24 h-24 rounded-full bg-white shadow-2xl ring-1 ring-black/10 flex items-center justify-center">
        {valid ? (
          <Plus className="w-12 h-12 text-blue-600" strokeWidth={3} />
        ) : (
          <Ban className="w-11 h-11 text-red-600" strokeWidth={2.5} />
        )}
      </div>
    </div>
  )
}
