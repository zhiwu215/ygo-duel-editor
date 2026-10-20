import React from 'react'
import { groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { Button } from '../ui/button'
import { Edit3, FolderPlus, Plus, Trash2 } from 'lucide-react'

interface GroupMenuProps {
  menu: { x: number; y: number; group: string | null }
  onClose: () => void
  onOpenGroupModal: (original: string | null) => void
  onDeleteGroup: (name: string) => void
}

export const GroupMenu: React.FC<GroupMenuProps> = ({
  menu,
  onClose,
  onOpenGroupModal,
  onDeleteGroup
}) => {
  const { selectedGroup, createNewDeck } = useDeckEditorStore()

  const menuX = Math.min(menu.x, window.innerWidth - 200)
  const menuY = Math.min(menu.y, window.innerHeight - 160)

  return (
    <div
      style={{ left: menuX, top: menuY }}
      className="fixed z-[65] min-w-48 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.group === null ? (
        <>
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1">
            {selectedGroup ? `在「${groupLeafName(selectedGroup)}」下新建` : '新建分组'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenGroupModal(null)}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{selectedGroup ? '新建子分组' : '新建分组'}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewDeck}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>新建卡组</span>
          </Button>
        </>
      ) : (
        <>
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
            {groupLeafName(menu.group)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenGroupModal(null)}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>新建子分组</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const name = menu.group
              if (name === null) return
              onOpenGroupModal(name)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>重命名分组</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const name = menu.group
              onClose()
              if (name) void onDeleteGroup(name)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
            <span>删除分组</span>
          </Button>
        </>
      )}
    </div>
  )
}
