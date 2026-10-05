import React, { useEffect, useMemo, useState } from 'react'
import { DeckData } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { YdkPasteModal } from './YdkPasteModal'
import {
  Layers,
  Plus,
  FolderOpen,
  ClipboardPaste,
  ChevronDown,
  Folder,
  Search,
  Edit3,
  Copy,
  Trash2,
  Download,
  Clock,
  BookOpen
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeckContextMenuState {
  x: number
  y: number
  deck: DeckData
}

export const DeckLibraryView: React.FC = () => {
  const {
    deckList,
    selectedGroup,
    searchKeyword,
    cardDetails,
    fetchDeckList,
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
  const [importMenuOpen, setImportMenuOpen] = useState<boolean>(false)
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false)

  useEffect(() => {
    void fetchDeckList()
  }, [fetchDeckList])

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
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

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deckList) {
      const g = d.group?.trim() || '未分组'
      map.set(g, (map.get(g) || 0) + 1)
    }
    return Array.from(map.entries())
  }, [deckList])

  const filteredDecks = useMemo(() => {
    return deckList.filter((deck) => {
      if (selectedGroup) {
        const g = deck.group?.trim() || '未分组'
        if (g !== selectedGroup) return false
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        const matchName = deck.name.toLowerCase().includes(kw)
        const matchDesc = deck.description?.toLowerCase().includes(kw)
        const matchGroup = deck.group?.toLowerCase().includes(kw)
        const matchTag = deck.tags?.some((t) => t.toLowerCase().includes(kw))
        if (!matchName && !matchDesc && !matchGroup && !matchTag) {
          return false
        }
      }
      return true
    })
  }, [deckList, selectedGroup, searchKeyword])

  const getCoverCode = (deck: DeckData): number | undefined => {
    if (deck.coverCard) return deck.coverCard
    if (deck.extra && deck.extra.length > 0) return deck.extra[0]
    if (deck.main && deck.main.length > 0) return deck.main[0]
    return undefined
  }

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

  const menuX = contextMenu ? Math.min(contextMenu.x, window.innerWidth - 190) : 0
  const menuY = contextMenu ? Math.min(contextMenu.y, window.innerHeight - 180) : 0

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <header className="h-14 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">卡组资产库</h1>
              <Badge variant="secondary" className="text-[11px] font-mono px-1.5 py-0 h-4.5">
                {deckList.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">决斗推演、同人剧情编排与 Combo 展开资产</p>
          </div>
        </div>

        <div className="relative w-80 max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索卡组名称、剧情描述或标签..."
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

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportMenuOpen((v) => !v)}
              title="导入 YDK 卡组"
              className="h-8 text-xs gap-1.5 font-medium"
            >
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span>导入 YDK</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>

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
        </div>
      </header>

      <div className="px-6 py-2.5 bg-muted/20 border-b border-border/60 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0 mr-1">
          <Folder className="w-3.5 h-3.5" />
          <span>分组:</span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedGroup(null)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer',
            selectedGroup === null
              ? 'bg-primary text-primary-foreground font-bold shadow-xs'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          全部 ({deckList.length})
        </button>

        {groups.map(([group, count]) => {
          const isActive = selectedGroup === group
          return (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(isActive ? null : group)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1',
                isActive
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="max-w-40 truncate">{group}</span>
              <span className="text-[10px] opacity-75 font-mono">({count})</span>
            </button>
          )
        })}
      </div>

      <main className="flex-1 overflow-y-auto p-6 min-h-0 bg-background/50">
        {filteredDecks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDecks.map((deck) => {
              const coverCode = getCoverCode(deck)
              const coverCard = coverCode ? cardDetails[coverCode] : undefined

              return (
                <div
                  key={deck.id || deck.name}
                  onClick={() => void openDeck(deck)}
                  onContextMenu={(e) => handleContextMenu(e, deck)}
                  className="group relative flex flex-col rounded-xl bg-card border border-border/70 hover:border-primary/60 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden cursor-pointer"
                >
                  <div className="h-44 w-full bg-slate-950/80 relative overflow-hidden flex items-center justify-center border-b border-border/40">
                    <img
                      src={getCardImageUrl(coverCode)}
                      alt={deck.name}
                      onError={(e) => {
                        e.currentTarget.src = CARD_BACK_IMAGE
                      }}
                      className="h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />

                    {deck.group?.trim() && (
                      <div className="absolute top-2.5 left-2.5 max-w-[70%] flex items-center gap-1 bg-background/85 backdrop-blur-xs border border-border/60 text-[10px] font-semibold text-foreground/90 px-2 py-0.5 rounded-full shadow-xs">
                        <Folder className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{deck.group.trim()}</span>
                      </div>
                    )}

                    {coverCard && (
                      <div className="absolute bottom-1.5 left-2 max-w-[85%] truncate text-[11px] font-medium text-white/90 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                        王牌: {coverCard.name}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col flex-1 gap-2.5">
                    <div>
                      <h3
                        className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1"
                        title={deck.name}
                      >
                        {deck.name}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {deck.updatedAt
                            ? new Date(deck.updatedAt).toLocaleDateString()
                            : '未同步'}
                        </span>
                      </div>
                    </div>

                    {deck.tags && deck.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {deck.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/40"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground line-clamp-2 min-h-8">
                      {deck.description ? (
                        <span>{deck.description}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">
                          暂无背景描述或 Combo 说明
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono font-medium px-2 py-1.5 rounded-md bg-muted/40 border border-border/40 mt-auto">
                      <span className="text-foreground">
                        主 <span className="font-bold">{deck.main.length}</span>
                      </span>
                      <span className="text-foreground">
                        额外 <span className="font-bold">{deck.extra.length}</span>
                      </span>
                      <span className="text-muted-foreground">
                        副 <span>{deck.side.length}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">没有找到匹配的卡组</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchKeyword || selectedGroup
                  ? '尝试切换分组或清除搜索关键词'
                  : '暂无卡组，点击上方按钮新建或导入 YDK 卡组'}
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
                  清除所有筛选
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
      </main>

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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setContextMenu(null)
              void handleDelete(contextMenu.deck)
            }}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除卡组</span>
          </Button>
        </div>
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
