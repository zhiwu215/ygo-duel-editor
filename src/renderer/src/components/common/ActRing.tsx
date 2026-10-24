import React from 'react'
import actTexture from '../../assets/textures/act.png'
import { cn } from '../../lib/utils'

export const ActRing: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={actTexture}
    alt=""
    className={cn('command-ring pointer-events-none object-contain', className)}
  />
)
