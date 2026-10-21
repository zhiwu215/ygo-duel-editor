import React from 'react'
import { LINK_MARKERS } from '@shared/index'
import { LINK_MARKER_ICONS } from '../../utils/linkMarkerIcons'

export const LinkMarkerArrows: React.FC<{ markers: number }> = ({ markers }) => (
  <span className="inline-flex items-center gap-0.5 align-middle">
    {LINK_MARKERS.map(({ mask }) => {
      const Icon = LINK_MARKER_ICONS[mask]
      if (!Icon || (markers & mask) === 0) return null
      return (
        <span key={mask} className="inline-flex items-center">
          [<Icon className="w-3.5 h-3.5" strokeWidth={2} />]
        </span>
      )
    })}
  </span>
)
