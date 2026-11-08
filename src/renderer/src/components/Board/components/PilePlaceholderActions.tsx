import React from 'react'
import { Plus } from 'lucide-react'
import { usePlaceholderAdd } from '../../../hooks/usePlaceholderAdd'
import { Button } from '../../ui/button'

export type PlaceholderSide = 'top' | 'bottom'

export const PilePlaceholderActions: React.FC<{
  controller: 0 | 1
  duelistId?: string
  onAdded?: (side: PlaceholderSide) => void
}> = ({ controller, duelistId, onAdded }) => {
  const { canAdd, reason, addPlaceholder } = usePlaceholderAdd(controller, duelistId)

  const handleAdd = async (side: PlaceholderSide): Promise<void> => {
    const added = await addPlaceholder(side === 'top' ? 'deck-top' : 'deck-bottom')
    if (added) onAdded?.(side)
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!canAdd}
        onClick={() => void handleAdd('top')}
        className="h-7 gap-1.5 px-2.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        卡组顶添加占位卡
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!canAdd}
        onClick={() => void handleAdd('bottom')}
        className="h-7 gap-1.5 px-2.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        卡组底添加占位卡
      </Button>
      {!canAdd && reason && <span className="text-[10px] text-muted-foreground">{reason}</span>}
    </div>
  )
}
