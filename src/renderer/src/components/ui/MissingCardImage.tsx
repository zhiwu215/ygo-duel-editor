import React from 'react'
import { MISSING_CARD_NAME } from '@shared/index'
import { MISSING_CARD_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'

interface MissingCardImageProps {
  className?: string
}

export const MissingCardImage: React.FC<MissingCardImageProps> = ({ className }) => (
  <img
    src={MISSING_CARD_IMAGE}
    alt={MISSING_CARD_NAME}
    draggable={false}
    className={cn('pointer-events-none object-fill', className)}
  />
)
