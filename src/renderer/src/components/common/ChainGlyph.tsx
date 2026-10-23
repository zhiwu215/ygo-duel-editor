import React from 'react'
import chainTexture from '../../assets/textures/chain.png'
import { cn } from '../../lib/utils'

export const ChainGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <img src={chainTexture} alt="" className={cn('object-contain', className)} />
)
