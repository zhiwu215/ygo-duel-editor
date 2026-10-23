import React, { useLayoutEffect, useRef, useState } from 'react'
import { DeckData, groupDepth, groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import { useDeckFileExport } from '../../hooks/useDeckFileExport'
import { cn } from '../../lib/utils'
import {
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Folder,
  FolderInput,
  Inbox,
  Trash2
} from 'lucide-react'

interface DeckCardMenuProps {
  menu: { x: number; y: number; deck: DeckData }
  onClose: () => void
}

interface MoveMenuState {
  side: 'left' | 'right'
  offsetY: number | null
}

const MOVE_MENU_WIDTH = 176
const VIEWPORT_MARGIN = 8

export const DeckCardMenu: React.FC<DeckCardMenuProps> = ({ menu, onClose }) => {
  const { deckGroups, openDeck, duplicateDeckInLibrary, assignDeckGroup, deleteDeckFromLibrary } =
    useDeckEditorStore()
  const [moveMenu, setMoveMenu] = useState<MoveMenuState | null>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const exportDeckFile = useDeckFileExport()

  useLayoutEffect(() => {
    const el = submenuRef.current
    if (!moveMenu || moveMenu.offsetY !== null || !el) return
    const rect = el.getBoundingClientRect()
    const overflowBottom = Math.max(0, rect.bottom - (window.innerHeight - VIEWPORT_MARGIN))
    const offsetY =
      rect.top - overflowBottom < VIEWPORT_MARGIN ? VIEWPORT_MARGIN - rect.top : -overflowBottom
    setMoveMenu({ ...moveMenu, offsetY })
  }, [moveMenu])

  const openMoveMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!menu.deck.id) return
    const rect = e.currentTarget.getBoundingClientRect()
    setMoveMenu({
      side: rect.right + MOVE_MENU_WIDTH + VIEWPORT_MARGIN <= window.innerWidth ? 'right' : 'left',
      offsetY: null
    })
  }

  const handleDuplicate = async (deck: DeckData): Promise<void> => {
    if (deck.id) {
      await duplicateDeckInLibrary(deck.id)
    }
  }

  const handleExport = async (deck: DeckData): Promise<void> => {
    await exportDeckFile(() => window.api.saveDeckFile(deck))
  }

  const handleDelete = async (deck: DeckData): Promise<void> => {
    if (!deck.id) return
    if (
      await confirmDialog({
        title: `删除卡组「${deck.name}」`,
        description: '此操作不可逆。',
        confirmText: '删除'
      })
    ) {
      await deleteDeckFromLibrary(deck.id)
    }
  }

  const menuX = Math.min(menu.x, window.innerWidth - 190)
  const menuY = Math.min(menu.y, window.innerHeight - 180)

  return (
    <div
      style={{ left: menuX, top: menuY }}
      className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
        {menu.deck.name}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClose()
          void openDeck(menu.deck)
        }}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
        <span>编辑</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClose()
          void handleDuplicate(menu.deck)
        }}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        <span>复制副本</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClose()
          void handleExport(menu.deck)
        }}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-muted-foreground" />
        <span>导出 YDK</span>
      </Button>

      <Separator className="my-1" />

      <div className="relative" onMouseEnter={openMoveMenu} onMouseLeave={() => setMoveMenu(null)}>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
        >
          <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
          <span>移动到分组</span>
          <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
        </Button>

        {moveMenu && (
          <div
            ref={submenuRef}
            style={{
              transform: moveMenu.offsetY ? `translateY(${moveMenu.offsetY}px)` : undefined,
              visibility: moveMenu.offsetY === null ? 'hidden' : undefined
            }}
            className={cn(
              'absolute top-0 z-[70] w-44',
              moveMenu.side === 'right' ? 'left-full' : 'right-full'
            )}
          >
            <ScrollArea className="max-h-72 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-2xl">
              <div className="p-1 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    const id = menu.deck.id
                    onClose()
                    setMoveMenu(null)
                    if (id) void assignDeckGroup(id, '')
                  }}
                  className={cn(
                    'w-full h-7 px-2 flex items-center gap-2 text-left rounded transition-colors',
                    !menu.deck.group?.trim()
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Inbox className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">未分组</span>
                </button>

                {[...deckGroups]
                  .sort((a, b) => a.localeCompare(b, 'zh-CN'))
                  .map((g) => (
                    <button
                      key={g}
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        const id = menu.deck.id
                        onClose()
                        setMoveMenu(null)
                        if (id) void assignDeckGroup(id, g)
                      }}
                      style={{ paddingLeft: `${8 + (groupDepth(g) - 1) * 12}px` }}
                      className={cn(
                        'w-full h-7 pr-2 flex items-center gap-2 text-left rounded transition-colors',
                        menu.deck.group === g
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <Folder className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{groupLeafName(g)}</span>
                    </button>
                  ))}

                {deckGroups.length === 0 && (
                  <p className="px-2 py-1.5 text-[10px] text-muted-foreground/70 leading-relaxed">
                    还没有分组。右键空白处可新建。
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <Separator className="my-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClose()
          void handleDelete(menu.deck)
        }}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
        <span>删除卡组</span>
      </Button>
    </div>
  )
}
