import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DeckData, groupLeafName, groupParentPath, isGroupDescendant } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { WindowControls } from '../ui/window-controls'
import { GroupNameModal } from './GroupNameModal'
import { YdkPasteModal } from './YdkPasteModal'
import { DeckCardMenu } from './DeckCardMenu'
import { GroupMenu } from './GroupMenu'
import { DeckGroupGrid } from './DeckGroupGrid'
import { DeckCardTile } from './DeckCardTile'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import {
  getGroupBreadcrumb,
  getGroupCounts,
  getSearchMatchedDecks,
  getUngroupedCount,
  getVisibleDecks,
  getVisibleGroups
} from '../../utils/deckLibraryView'
import {
  SquareStack,
  Plus,
  FolderOpen,
  ClipboardPaste,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Search,
  BookOpen,
  FolderPlus,
  Inbox
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeckContextMenuState {
  x: number
  y: number
  deck: DeckData
}

interface GroupMenuState {
  x: number
  y: number
  group: string | null
}

export const DeckLibraryView: React.FC = () => {
  const {
    deckList,
    deckGroups,
    selectedGroup,
    searchKeyword,
    fetchDeckList,
    createGroup,
    renameGroup,
    deleteGroup,
    setSelectedGroup,
    setSearchKeyword,
    createNewDeck,
    importDeckFileToLibrary,
    importDeckTextToLibrary
  } = useDeckEditorStore()

  const [contextMenu, setContextMenu] = useState<DeckContextMenuState | null>(null)
  const [groupMenu, setGroupMenu] = useState<GroupMenuState | null>(null)

  const [groupModal, setGroupModal] = useState<{ original: string | null } | null>(null)

  const [importMenuOpen, setImportMenuOpen] = useState<boolean>(false)
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false)

  useEffect(() => {
    void fetchDeckList()
  }, [fetchDeckList])

  const closeContextMenu = useCallback((): void => setContextMenu(null), [])
  const closeGroupMenu = useCallback((): void => setGroupMenu(null), [])
  const closeImportMenu = useCallback((): void => setImportMenuOpen(false), [])

  useDismissOnOutside(null, Boolean(contextMenu), closeContextMenu)
  useDismissOnOutside(null, Boolean(groupMenu), closeGroupMenu)
  useDismissOnOutside(null, importMenuOpen, closeImportMenu)

  const ungroupedCount = useMemo(() => getUngroupedCount(deckList), [deckList])

  const groupCounts = useMemo(() => getGroupCounts(deckList), [deckList])

  const searchMatchedDecks = useMemo(
    () => getSearchMatchedDecks(deckList, searchKeyword),
    [deckList, searchKeyword]
  )

  const visibleDecks = useMemo(
    () => getVisibleDecks(deckList, selectedGroup, searchMatchedDecks),
    [deckList, selectedGroup, searchMatchedDecks]
  )

  const visibleGroups = useMemo(
    () => getVisibleGroups(deckGroups, selectedGroup, searchMatchedDecks),
    [deckGroups, selectedGroup, searchMatchedDecks]
  )

  const breadcrumb = useMemo(() => getGroupBreadcrumb(selectedGroup), [selectedGroup])

  const handleContextMenu = (e: React.MouseEvent, deck: DeckData): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, deck })
  }

  const handleGroupContextMenu = (e: React.MouseEvent, group: string | null): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu(null)
    setGroupMenu({ x: e.clientX, y: e.clientY, group })
  }

  const openGroupModal = (original: string | null): void => {
    setContextMenu(null)
    setGroupMenu(null)
    setGroupModal({ original })
  }

  const handleCreateGroup = async (name: string): Promise<boolean> => {
    return createGroup(name, selectedGroup)
  }

  const handleDeleteGroup = async (name: string): Promise<void> => {
    const count = groupCounts.get(name) ?? 0
    const kids = deckGroups.filter((g) => isGroupDescendant(g, name)).length
    const parts = [`确认删除分组「${name}」？`]
    if (kids > 0) parts.push(`其下 ${kids} 个子分组会一并删除。`)
    if (count > 0) {
      parts.push(
        `该分组下的 ${count} 个卡组将退回「${groupParentPath(name) || '未分组'}」，卡组本身不会被删除。`
      )
    }
    if (
      await confirmDialog({
        title: `删除分组「${name}」`,
        description: parts.join('\n'),
        confirmText: '删除'
      })
    ) {
      await deleteGroup(name)
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <header className="h-14 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 [-webkit-app-region:drag]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <SquareStack className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-foreground">卡组</h1>
        </div>

        <div className="relative w-80 max-w-sm [-webkit-app-region:no-drag]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-8.5 h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportMenuOpen((v) => !v)}
                    className="h-8 text-xs gap-1.5 font-medium"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>导入 YDK</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                }
              />
              <TooltipContent>导入 YDK 卡组</TooltipContent>
            </Tooltip>

            {importMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-1 z-50"
              >
                <div className="w-44 bg-popover border border-border rounded-md overflow-hidden shadow-lg py-1">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setImportMenuOpen(false)
                      void importDeckFileToLibrary()
                    }}
                    className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">从 .ydk 文件导入</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setImportMenuOpen(false)
                      setShowPasteModal(true)
                    }}
                    className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">粘贴 YDK 文本</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={createNewDeck}
            className="h-8 text-xs gap-1.5 font-bold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新建卡组</span>
          </Button>

          <WindowControls className="-mr-6 ml-1" />
        </div>
      </header>

      <main
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('[data-deck-card]')) return
          e.preventDefault()
          setContextMenu(null)
          setGroupMenu({ x: e.clientX, y: e.clientY, group: null })
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background/50"
      >
        <div className="shrink-0 px-5 pt-5">
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>全部</span>
              </button>
              {breadcrumb.map((path, i) => (
                <span key={path} className="flex items-center gap-1 min-w-0">
                  <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(path)}
                    className={cn(
                      'flex items-center gap-1 min-w-0 transition-colors cursor-pointer hover:text-foreground',
                      i === breadcrumb.length - 1 && 'text-foreground font-semibold'
                    )}
                  >
                    {i === 0 && <Folder className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{groupLeafName(path)}</span>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-5">
            {visibleGroups.length > 0 && (
              <DeckGroupGrid groups={visibleGroups} onGroupContextMenu={handleGroupContextMenu} />
            )}

            {selectedGroup === null && visibleDecks.length > 0 && ungroupedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2.5">
                <Inbox className="w-3.5 h-3.5" />
                <span>未分组</span>
                <span className="font-mono text-[10px] opacity-70">({ungroupedCount})</span>
              </div>
            )}

            {visibleDecks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {visibleDecks.map((deck) => (
                  <DeckCardTile
                    key={deck.id || deck.name}
                    deck={deck}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {searchKeyword
                      ? '没有找到匹配的卡组'
                      : selectedGroup
                        ? '该分组内还没有卡组'
                        : '还没有卡组'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchKeyword
                      ? '尝试清除搜索关键词'
                      : selectedGroup
                        ? '把卡组拖进来，或在卡组右键菜单里选择「移动到分组」'
                        : '点击上方按钮新建或导入 YDK 卡组；右键空白处可新建分组'}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {(searchKeyword || selectedGroup) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchKeyword('')
                        setSelectedGroup(null)
                      }}
                      className="h-8 text-xs"
                    >
                      {searchKeyword ? '清除搜索' : '返回全部'}
                    </Button>
                  )}
                  {!searchKeyword && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openGroupModal(null)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>{selectedGroup ? '新建子分组' : '新建分组'}</span>
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={createNewDeck}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建卡组</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      <footer className="h-7 shrink-0 border-t border-border/70 bg-muted/30 px-4 flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
        <span>{deckList.length} 个卡组</span>
        {selectedGroup !== null && <span className="truncate">当前：{selectedGroup}</span>}
      </footer>

      {contextMenu && <DeckCardMenu menu={contextMenu} onClose={closeContextMenu} />}

      {groupMenu && (
        <GroupMenu
          menu={groupMenu}
          onClose={closeGroupMenu}
          onOpenGroupModal={openGroupModal}
          onDeleteGroup={(name) => void handleDeleteGroup(name)}
        />
      )}

      {groupModal && (
        <GroupNameModal
          initialName={groupModal.original ? groupLeafName(groupModal.original) : null}
          existingGroups={deckGroups}
          parentPath={selectedGroup}
          onClose={() => setGroupModal(null)}
          onConfirm={async (name) =>
            groupModal.original === null
              ? await handleCreateGroup(name)
              : await renameGroup(groupModal.original, name)
          }
        />
      )}

      {showPasteModal && (
        <YdkPasteModal
          onConfirm={async (text, deckName) => importDeckTextToLibrary(text, deckName)}
          onClose={() => setShowPasteModal(false)}
        />
      )}
    </div>
  )
}
