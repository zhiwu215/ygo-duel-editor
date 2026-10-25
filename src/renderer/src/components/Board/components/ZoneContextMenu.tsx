import React from 'react'
import { CardLocation } from '@shared/index'
import type { RefObject } from 'react'
import { Button } from '../../ui/button'

const LOCATION_LABELS: Record<number, string> = {
  [CardLocation.EXTRA]: '额外卡组',
  [CardLocation.DECK]: '主卡组',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.REMOVED]: '除外区'
}

export const ZoneContextMenu: React.FC<{
  menuRef: RefObject<HTMLDivElement | null>
  menuPos: { x: number; y: number }
  controller: 0 | 1
  location: number
  isEngine: boolean
  onSwitchDeck: () => void
  onAddPlaceholder?: () => void
}> = ({ menuRef, menuPos, controller, location, isEngine, onSwitchDeck, onAddPlaceholder }) => (
  <div
    ref={menuRef}
    style={{ left: menuPos.x, top: menuPos.y }}
    className="fixed z-[60] min-w-48 max-w-56 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-52">
      {controller === 0 ? '我方' : '对方'}
      {LOCATION_LABELS[location] || '区域'}
    </div>

    {location === CardLocation.DECK && (
      <Button
        variant="ghost"
        size="sm"
        disabled={isEngine}
        onClick={onSwitchDeck}
        className="w-full justify-start h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
      >
        <span>切换卡组</span>
      </Button>
    )}

    {location === CardLocation.DECK && onAddPlaceholder && (
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddPlaceholder}
        className="w-full justify-start h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer"
      >
        添加占位卡
      </Button>
    )}
  </div>
)
