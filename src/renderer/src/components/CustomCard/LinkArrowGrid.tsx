import React from 'react'
import { LINK_MARKERS, linkMarkerCount } from '@shared/index'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

const LINK_ARROW_GRID: Array<Array<{ mask: number; label: string } | null>> = [
  [LINK_MARKERS[0], LINK_MARKERS[1], LINK_MARKERS[2]],
  [LINK_MARKERS[3], null, LINK_MARKERS[4]],
  [LINK_MARKERS[5], LINK_MARKERS[6], LINK_MARKERS[7]]
]

interface LinkArrowGridProps {
  markers: number
  onToggleMarker: (mask: number) => void
  onClear: () => void
}

export const LinkArrowGrid: React.FC<LinkArrowGridProps> = ({
  markers,
  onToggleMarker,
  onClear
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-[11px] text-muted-foreground">连接箭头</Label>
        <span className="font-mono text-[11px] text-muted-foreground">
          {linkMarkerCount(markers)} / 8
        </span>
      </div>
      <div className="grid w-fit grid-cols-3 gap-1">
        {LINK_ARROW_GRID.flat().map((cell) =>
          cell === null ? (
            <button
              key="clear-cell"
              type="button"
              onClick={onClear}
              disabled={markers === 0}
              className={cn(
                'h-9 w-9 rounded-md border text-[10px] font-semibold transition-colors',
                markers === 0
                  ? 'cursor-not-allowed border-border bg-secondary/40 text-muted-foreground/50'
                  : 'cursor-pointer border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
              )}
            >
              清空
            </button>
          ) : (
            <button
              key={cell.mask}
              type="button"
              aria-pressed={(markers & cell.mask) !== 0}
              onClick={() => onToggleMarker(cell.mask)}
              className={cn(
                'h-9 w-9 rounded-md border text-sm transition-colors',
                (markers & cell.mask) !== 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {cell.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
