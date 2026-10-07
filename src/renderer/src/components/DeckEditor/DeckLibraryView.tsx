import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useMemo, useState } from 'react'
import {
  DeckData,
  groupDepth,
  groupLeafName,
  groupParentPath,
  isGroupDescendant
} from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import { GroupNameModal } from './GroupNameModal'
import { YdkPasteModal } from './YdkPasteModal'
import {
  Layers,
  Plus,
  FolderOpen,
  ClipboardPaste,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Search,
  Edit3,
  Copy,
  Trash2,
  Download,
  Clock,
  BookOpen,
  FolderPlus,
  FolderInput,
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
    cardDetails,
    fetchDeckList,
    createGroup,
    renameGroup,
    deleteGroup,
    assignDeckGroup,
    setSelectedGroup,
    setSearchKeyword,
    openDeck,
    createNewDeck,
    deleteDeckFromLibrary,
    duplicateDeckInLibrary,
    importDeckFileToLibrary,
    importDeckTextToLibrary
  } = useDeckEditorStore()

  const [contextMenu, setContextMenu] = useState<DeckContextMenuState | null>(null)
  const [groupMenu, setGroupMenu] = useState<GroupMenuState | null>(null)

  const [moveMenuDeckId, setMoveMenuDeckId] = useState<string | null>(null)

  const [groupModal, setGroupModal] = useState<{ original: string | null } | null>(null)

  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const [importMenuOpen, setImportMenuOpen] = useState<boolean>(false)
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false)

  useEffect(() => {
    void fetchDeckList()
  }, [fetchDeckList])

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => {
      setContextMenu(null)
      setMoveMenuDeckId(null)
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!groupMenu) return
    const close = (): void => setGroupMenu(null)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [groupMenu])

  useEffect(() => {
    if (!importMenuOpen) return
    const close = (): void => setImportMenuOpen(false)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [importMenuOpen])

  const ungroupedCount = useMemo(() => deckList.filter((d) => !d.group?.trim()).length, [deckList])

  const getCoverCode = (deck: DeckData): number | undefined => {
    if (deck.coverCard) return deck.coverCard
    if (deck.extra && deck.extra.length > 0) return deck.extra[0]
    if (deck.main && deck.main.length > 0) return deck.main[0]
    return undefined
  }

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deckList) {
      const g = d.group?.trim()
      if (!g) continue
      let cur: string | null = g
      while (cur) {
        map.set(cur, (map.get(cur) || 0) + 1)
        cur = groupParentPath(cur)
      }
    }
    return map
  }, [deckList])

  const searchMatchedDecks = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return null
    return deckList.filter((deck) => {
      const matchName = deck.name.toLowerCase().includes(kw)
      const matchDesc = deck.description?.toLowerCase().includes(kw)
      const matchGroup = deck.group?.toLowerCase().includes(kw)
      const matchTag = deck.tags?.some((t) => t.toLowerCase().includes(kw))
      return Boolean(matchName || matchDesc || matchGroup || matchTag)
    })
  }, [deckList, searchKeyword])

  const visibleDecks = useMemo(() => {
    const source = searchMatchedDecks ?? deckList
    if (selectedGroup === null) return source.filter((d) => !d.group?.trim())
    return source.filter((d) => d.group?.trim() === selectedGroup)
  }, [deckList, selectedGroup, searchMatchedDecks])

  const visibleGroups = useMemo(() => {
    const pool = deckGroups.filter((g) =>
      selectedGroup === null ? groupParentPath(g) === null : groupParentPath(g) === selectedGroup
    )
    if (!searchMatchedDecks) return pool
    const hit = new Set<string>()
    for (const d of searchMatchedDecks) {
      const g = d.group?.trim()
      if (!g) continue
      let cur: string | null = g
      while (cur) {
        hit.add(cur)
        cur = groupParentPath(cur)
      }
    }
    return pool.filter((g) => hit.has(g))
  }, [deckGroups, selectedGroup, searchMatchedDecks])

  const breadcrumb = useMemo(() => {
    const chain: string[] = []
    let cur = selectedGroup
    while (cur) {
      chain.unshift(cur)
      cur = groupParentPath(cur)
    }
    return chain
  }, [selectedGroup])

  const handleContextMenu = (e: React.MouseEvent, deck: DeckData): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, deck })
  }

  const handleDuplicate = async (deck: DeckData): Promise<void> => {
    if (deck.id) {
      await duplicateDeckInLibrary(deck.id)
    }
  }

  const handleExportSingle = async (deck: DeckData): Promise<void> => {
    const res = await window.api.saveDeckFile(deck)
    if (res.success && res.filePath) {
      alert(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  const handleDelete = async (deck: DeckData): Promise<void> => {
    if (!deck.id) return
    if (confirm(`确认删除卡组「${deck.name}」？此操作不可逆。`)) {
      await deleteDeckFromLibrary(deck.id)
    }
  }

  const handleGroupContextMenu = (e: React.MouseEvent, group: string | null): void => {
    if (dragOverGroup !== null) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu(null)
    setMoveMenuDeckId(null)
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
    if (confirm(parts.join('\n'))) {
      await deleteGroup(name)
    }
  }

  const menuX = contextMenu ? Math.min(contextMenu.x, window.innerWidth - 190) : 0
  const menuY = contextMenu ? Math.min(contextMenu.y, window.innerHeight - 180) : 0
  const groupMenuX = groupMenu ? Math.min(groupMenu.x, window.innerWidth - 200) : 0
  const groupMenuY = groupMenu ? Math.min(groupMenu.y, window.innerHeight - 160) : 0

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <header className="h-14 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 [-webkit-app-region:drag]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <Layers className="w-5 h-5" />
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
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5 px-1">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{selectedGroup === null ? '分组' : '子分组'}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1">
                  {visibleGroups.map((group) => {
                    const isDropTarget = dragOverGroup === group
                    return (
                      <Tooltip key={group}>
                        <TooltipTrigger
                          render={
                            <div
                              data-deck-folder
                              onClick={() => setSelectedGroup(group)}
                              onContextMenu={(e) => handleGroupContextMenu(e, group)}
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
                                isDropTarget
                                  ? 'bg-primary/15 ring-1 ring-inset ring-primary/50'
                                  : 'hover:bg-accent'
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
                          }
                        />
                        <TooltipContent>{group}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
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
                {visibleDecks.map((deck) => {
                  const coverCode = getCoverCode(deck)
                  const coverCard = coverCode ? cardDetails[coverCode] : undefined

                  return (
                    <div
                      key={deck.id || deck.name}
                      data-deck-card
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/deck-id', deck.id || '')
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => void openDeck(deck)}
                      onContextMenu={(e) => handleContextMenu(e, deck)}
                      className="group relative flex gap-3 rounded-lg bg-card border border-border/70 hover:border-primary/60 transition-all duration-200 hover:shadow-md overflow-hidden cursor-pointer p-2.5"
                    >
                      <div className="relative h-20 w-14 shrink-0 rounded-md bg-slate-950/80 overflow-hidden flex items-center justify-center">
                        <img
                          src={getCardImageUrl(coverCode)}
                          alt={deck.name}
                          onError={(e) => {
                            e.currentTarget.src = CARD_BACK_IMAGE
                          }}
                          className="h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                        />
                        {deck.group?.trim() && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <div className="absolute top-1 left-1 right-1 flex items-center gap-0.5 text-[9px] font-semibold text-white/90 bg-black/65 backdrop-blur-xs px-1 py-0.5 rounded">
                                  <Folder className="w-2 h-2 shrink-0" />
                                  <span className="truncate">
                                    {groupLeafName(deck.group.trim())}
                                  </span>
                                </div>
                              }
                            />
                            <TooltipContent>{deck.group.trim()}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {deck.name}
                              </h3>
                            }
                          />
                          <TooltipContent>{deck.name}</TooltipContent>
                        </Tooltip>

                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>
                            {deck.updatedAt
                              ? new Date(deck.updatedAt).toLocaleDateString()
                              : '未同步'}
                          </span>
                          {coverCard && (
                            <Tooltip>
                              <TooltipTrigger
                                render={<span className="truncate ml-1">· {coverCard.name}</span>}
                              />
                              <TooltipContent>{coverCard.name}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {deck.tags && deck.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1.5">
                            {deck.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[9px] font-medium px-1 py-px rounded bg-muted/80 text-muted-foreground border border-border/40"
                              >
                                #{t}
                              </span>
                            ))}
                            {deck.tags.length > 2 && (
                              <span className="text-[9px] text-muted-foreground self-center">
                                +{deck.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1.5 leading-snug">
                          {deck.description ? (
                            <span>{deck.description}</span>
                          ) : (
                            <span className="italic text-muted-foreground/60">暂无描述</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-[10px] font-mono font-medium text-muted-foreground mt-auto pt-1.5">
                          <span className="text-foreground">
                            主 <span className="font-bold">{deck.main.length}</span>
                          </span>
                          <span className="text-foreground">
                            额外 <span className="font-bold">{deck.extra.length}</span>
                          </span>
                          <span>
                            副 <span>{deck.side.length}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
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

      {contextMenu && (
        <div
          style={{ left: menuX, top: menuY }}
          className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
            {contextMenu.deck.name}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setContextMenu(null)
              void openDeck(contextMenu.deck)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>打开 / 编辑</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setContextMenu(null)
              void handleDuplicate(contextMenu.deck)
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
              setContextMenu(null)
              void handleExportSingle(contextMenu.deck)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>导出 YDK</span>
          </Button>

          <Separator className="my-1" />

          <div
            className="relative"
            onMouseEnter={() => {
              if (contextMenu.deck.id) setMoveMenuDeckId(contextMenu.deck.id)
            }}
            onMouseLeave={() => setMoveMenuDeckId(null)}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
            >
              <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
              <span>移动到分组</span>
              <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
            </Button>

            {moveMenuDeckId === contextMenu.deck.id && (
              <ScrollArea className="absolute left-full top-0 z-[70] min-w-40 max-h-72 bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-2xl">
                <div className="p-1 text-xs">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const id = contextMenu.deck.id
                      setContextMenu(null)
                      setMoveMenuDeckId(null)
                      if (id) void assignDeckGroup(id, '')
                    }}
                    className={cn(
                      'w-full px-2 py-1.5 flex items-center gap-2 text-left rounded transition-colors',
                      !contextMenu.deck.group?.trim()
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
                      <Tooltip key={g}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                const id = contextMenu.deck.id
                                setContextMenu(null)
                                setMoveMenuDeckId(null)
                                if (id) void assignDeckGroup(id, g)
                              }}
                              style={{ paddingLeft: `${8 + (groupDepth(g) - 1) * 12}px` }}
                              className={cn(
                                'w-full pr-2 py-1.5 flex items-center gap-2 text-left rounded transition-colors',
                                contextMenu.deck.group === g
                                  ? 'bg-primary/15 text-primary font-semibold'
                                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                              )}
                            >
                              <Folder className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{groupLeafName(g)}</span>
                            </button>
                          }
                        />
                        <TooltipContent>{g}</TooltipContent>
                      </Tooltip>
                    ))}

                  {deckGroups.length === 0 && (
                    <p className="px-2 py-1.5 text-[10px] text-muted-foreground/70 leading-relaxed">
                      还没有分组。右键空白处可新建。
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator className="my-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setContextMenu(null)
              void handleDelete(contextMenu.deck)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
            <span>删除卡组</span>
          </Button>
        </div>
      )}

      {groupMenu && (
        <div
          style={{ left: groupMenuX, top: groupMenuY }}
          className="fixed z-[65] min-w-48 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {groupMenu.group === null ? (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1">
                {selectedGroup ? `在「${groupLeafName(selectedGroup)}」下新建` : '新建分组'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openGroupModal(null)}
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
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
                      {groupLeafName(groupMenu.group)}
                    </div>
                  }
                />
                <TooltipContent>{groupMenu.group}</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openGroupModal(null)}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>新建子分组</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const name = groupMenu.group
                  if (name === null) return
                  openGroupModal(name)
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
                  const name = groupMenu.group
                  setGroupMenu(null)
                  if (name) void handleDeleteGroup(name)
                }}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                <span>删除分组</span>
              </Button>
            </>
          )}
        </div>
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
