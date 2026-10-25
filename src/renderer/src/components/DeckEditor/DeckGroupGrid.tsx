import React, { useState } from 'react'
import { groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { DeckFolderTile } from '../common/DeckFolderTile'
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
        {groups.map((group) => (
          <DeckFolderTile
            key={group}
            data-deck-folder
            label={groupLeafName(group)}
            highlight={dragOverGroup === group}
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
          />
        ))}
      </div>
    </div>
  )
}
