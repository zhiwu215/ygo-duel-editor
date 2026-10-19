import React from 'react'
import { CardLocation, FieldCard } from '@shared/index'
import { CardImage } from '../../ui/CardImage'

export const OverlayMaterialStack: React.FC<{ card: FieldCard }> = ({ card }) => {
  if (card.location !== CardLocation.MZONE) return null
  if (!card.overlayMaterials || card.overlayMaterials.length === 0) return null
  return (
    <>
      {card.overlayMaterials.map((matCode, idx) => {
        const count = card.overlayMaterials.length
        const depth = count - 1 - idx
        const step = count > 3 ? 14 / count : 4.5
        const xOffset = -((depth + 1) * step)

        return (
          <div
            key={`oru_${matCode}_${idx}`}
            className="absolute inset-0 rounded overflow-hidden shadow-sm border border-neutral-900/60 pointer-events-none select-none bg-black/40"
            style={{
              transform: `translateX(${xOffset}px)`,
              zIndex: idx + 1
            }}
          >
            <CardImage
              code={matCode}
              small
              alt={`ORU-${matCode}`}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>
        )
      })}
    </>
  )
}
