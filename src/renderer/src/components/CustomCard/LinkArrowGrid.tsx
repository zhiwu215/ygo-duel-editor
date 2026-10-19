import React from 'react'
import { LINK_MARKERS } from '@shared/index'
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
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">连接箭头（至少一个）</Label>
      <div className="grid grid-cols-3 gap-1 w-fit">
        {LINK_ARROW_GRID.flat().map((cell) =>
          cell === null ? (
            <button
              key="clear-cell"
              type="button"
              onClick={onClear}
              disabled={markers === 0}
              title="清空已选箭头"
              className={cn(
                'w-8 h-8 rounded border text-[10px] font-semibold transition-colors',
                markers === 0
                  ? 'bg-secondary/40 text-muted-foreground/50 border-border cursor-not-allowed'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer'
              )}
            >
              清空
            </button>
          ) : (
            <button
              key={cell.mask}
              type="button"
              onClick={() => onToggleMarker(cell.mask)}
              className={cn(
                'w-8 h-8 rounded border text-xs transition-colors',
                (markers & cell.mask) !== 0
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
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
