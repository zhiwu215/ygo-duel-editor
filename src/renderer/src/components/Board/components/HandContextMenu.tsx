import React from 'react'
import { useContextMenuStore } from '../../../stores/useContextMenuStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { alertDialog } from '../../../stores/useDialogStore'
import { usePlaceholderHand } from '../../../hooks/usePlaceholderHand'
import { Button } from '../../ui/button'

export const HandContextMenu: React.FC<{
  menuRef: React.RefObject<HTMLDivElement | null>
  menuPos: { x: number; y: number }
  controller: 0 | 1
  duelistId: string
}> = ({ menuRef, menuPos, controller, duelistId }) => {
  const closeMenu = useContextMenuStore((s) => s.closeMenu)
  const { canAdd, reason, addPlaceholder } = usePlaceholderHand(controller, duelistId)

  const handleAdd = async (): Promise<void> => {
    if (!canAdd) {
      closeMenu()
      void alertDialog(reason ?? '当前无法添加占位卡。')
      return
    }
    closeMenu()
    const added = await addPlaceholder()
    if (added) return
    const error = useDuelEngineStore.getState().error
    void alertDialog(`添加占位卡失败${error ? `\n\n${error}` : ''}`)
  }

  return (
    <div
      ref={menuRef}
      style={{ left: menuPos.x, top: menuPos.y }}
      className="fixed z-[60] min-w-40 max-w-56 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-disabled={!canAdd}
        onClick={() => void handleAdd()}
        className={`w-full justify-start gap-2 h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer ${
          canAdd ? '' : 'opacity-60'
        }`}
      >
        添加占位卡
      </Button>
      {reason && (
        <div className="px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">{reason}</div>
      )}
    </div>
  )
}
