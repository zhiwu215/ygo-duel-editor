import React, { useState } from 'react'
import { groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { cn } from '../../lib/utils'
import { Folder } from 'lucide-react'

interface DeckGroupGridProps {
  groups: string[]
  onGroupContextMenu: (e: React.MouseEvent, group: string) => void
}

export const DeckGroupGrid: React.FC<DeckGroupGridProps> = ({ groups, onGroupContextMenu }) => {
  const { selectedGroup, setSelectedGroup, assignDeckGroup } = useDeckEditorStore()
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5 px-1">
        <Folder className="w-3.5 h-3.5" />
        <span>{selectedGroup === null ? '分组' : '子分组'}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1">
        {groups.map((group) => {
          const isDropTarget = dragOverGroup === group
          return (
            <div
              key={group}
              data-deck-folder
              onClick={() => setSelectedGroup(group)}
              onContextMenu={(e) => {
                if (dragOverGroup !== null) return
                onGroupContextMenu(e, group)
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('text/deck-id')) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOverGroup !== group) setDragOverGroup(group)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return
                if (dragOverGroup === group) setDragOverGroup(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragOverGroup(null)
                const deckId = e.dataTransfer.getData('text/deck-id')
                if (deckId) void assignDeckGroup(deckId, group)
              }}
              className={cn(
                'group cursor-pointer rounded-md px-2 py-2.5 flex flex-col items-center gap-1.5 min-w-0 transition-colors',
                isDropTarget ? 'bg-primary/15 ring-1 ring-inset ring-primary/50' : 'hover:bg-accent'
              )}
            >
              <Folder
                className="h-11 w-11 text-foreground/75 fill-foreground/5 transition-colors group-hover:text-foreground"
                strokeWidth={1.5}
              />
              <span className="max-w-full rounded-sm px-1 text-center text-[11px] leading-tight font-medium text-foreground line-clamp-2 break-words group-hover:bg-accent-foreground/10">
                {groupLeafName(group)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
