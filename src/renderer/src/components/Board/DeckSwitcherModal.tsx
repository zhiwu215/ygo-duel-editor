import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DeckData, groupLeafName } from '@shared/index'
import { useDeckSwitcherStore } from '../../stores/useDeckSwitcherStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { resolveViewerDuelist } from '../../utils/duelistNames'
import {
  getGroupBreadcrumb,
  getSearchMatchedDecks,
  getVisibleGroups
} from '../../utils/deckLibraryView'
import { CardImage } from '../ui/CardImage'
import { DeckFolderTile } from '../common/DeckFolderTile'
import { X, Search, Layers, SquarePen, Plus, Folder, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

export const DeckSwitcherModal: React.FC = () => {
  const controller = useDeckSwitcherStore((s) => s.controller)

  if (controller === null) return null

  return <DeckSwitcherContent key={controller} controller={controller} />
}

const DeckSwitcherContent: React.FC<{ controller: 0 | 1 }> = ({ controller }) => {
  const closeDeckSwitcher = useDeckSwitcherStore((s) => s.closeDeckSwitcher)
  const applyDeckToPlayer = useDuelStore((s) => s.applyDeckToPlayer)
  const duelists = useDuelStore((s) => s.state.duelists)
  const activeDuelistIds = useDuelStore((s) => s.activeDuelistIds)
  const currentTurn = useDuelStore((s) => s.currentTurn)

  const targetDuelist = resolveViewerDuelist(
    duelists,
    controller,
    activeDuelistIds[controller],
    currentTurn
  )

  const [decks, setDecks] = useState<DeckData[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [query, setQuery] = useState<string>('')

  const [deckMenu, setDeckMenu] = useState<{ x: number; y: number; deck: DeckData } | null>(null)
  const [deckMenuPos, setDeckMenuPos] = useState({ x: 0, y: 0 })
  const deckMenuRef = useRef<HTMLDivElement>(null)
  const closeDeckMenu = (): void => setDeckMenu(null)

  useLayoutEffect(() => {
    if (!deckMenu || !deckMenuRef.current) return
    const { width, height } = deckMenuRef.current.getBoundingClientRect()
    setDeckMenuPos({
      x: Math.max(8, Math.min(deckMenu.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(deckMenu.y, window.innerHeight - height - 8))
    })
  }, [deckMenu])

  useEffect(() => {
    let cancelled = false
    window.api
      .getDeckLibrary()
      .then((library) => {
        if (!cancelled) {
          setDecks(library.decks)
          setGroups(library.groups)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDecks([])
          setGroups([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeDeckSwitcher()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDeckSwitcher])

  useDismissOnOutside(deckMenuRef, Boolean(deckMenu), closeDeckMenu, {
    capture: true,
    preventDefaultOnEscape: true
  })

  const matchedDecks = useMemo(() => getSearchMatchedDecks(decks, query), [decks, query])

  const visibleDecks = useMemo(() => {
    if (matchedDecks) return matchedDecks
    return decks.filter((deck) => (deck.group?.trim() || null) === selectedGroup)
  }, [decks, matchedDecks, selectedGroup])

  const visibleGroups = useMemo(
    () => (matchedDecks ? [] : getVisibleGroups(groups, selectedGroup, null)),
    [groups, selectedGroup, matchedDecks]
  )

  const breadcrumb = useMemo(() => getGroupBreadcrumb(selectedGroup), [selectedGroup])

  const handleApply = (deck: DeckData): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      useDuelEngineStore.setState({ error: '引擎校验中无法切换卡组，请先退出引擎后再试。' })
      closeDeckSwitcher()
      return
    }
    applyDeckToPlayer(controller, deck, targetDuelist?.id)
    closeDeckSwitcher()
  }

  const handleDeckContextMenu = (e: React.MouseEvent, deck: DeckData): void => {
    e.preventDefault()
    e.stopPropagation()
    setDeckMenu({ x: e.clientX, y: e.clientY, deck })
  }

  const openDeckInEditor = (deck: DeckData): void => {
    setDeckMenu(null)
    closeDeckSwitcher()
    void window.api.openDeckEditor(deck.id)
  }

  const handleCreateDeck = (): void => {
    closeDeckSwitcher()
    void window.api.openDeckEditor(undefined, true)
  }

  const ctrlLabel = targetDuelist ? targetDuelist.name : controller === 0 ? '我方' : '对方'

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in"
        onClick={closeDeckSwitcher}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-tight">切换卡组</h2>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full border text-[10px] font-bold leading-none',
                  controller === 0
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40'
                )}
              >
                {ctrlLabel}主卡组
              </span>
            </div>

            <button
              type="button"
              onClick={closeDeckSwitcher}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索卡组"
                className="h-7 text-xs pl-8 pr-2"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateDeck}
              className="h-7 text-xs gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增卡组</span>
            </Button>
          </div>

          {breadcrumb.length > 0 && !matchedDecks && (
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="flex items-center gap-1 transition-colors hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>全部</span>
              </button>
              {breadcrumb.map((path, index) => (
                <span key={path} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(path)}
                    className={cn(
                      'flex min-w-0 items-center gap-1 transition-colors hover:text-foreground cursor-pointer',
                      index === breadcrumb.length - 1 && 'font-semibold text-foreground'
                    )}
                  >
                    {index === 0 && <Folder className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{groupLeafName(path)}</span>
                  </button>
                </span>
              ))}
            </div>
          )}

          <ScrollArea className="flex-1 min-h-[240px]">
            <div className="p-4">
              {isLoading ? (
                <p className="text-xs text-muted-foreground py-12 text-center">正在读取卡组库...</p>
              ) : decks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm font-semibold text-foreground">还没有卡组</p>
                </div>
              ) : (
                <>
                  {visibleGroups.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                        <Folder className="h-3.5 w-3.5" />
                        <span>{selectedGroup === null ? '分组' : '子分组'}</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1">
                        {visibleGroups.map((group) => (
                          <DeckFolderTile
                            key={group}
                            label={groupLeafName(group)}
                            onClick={() => setSelectedGroup(group)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedGroup === null &&
                    !matchedDecks &&
                    visibleGroups.length > 0 &&
                    visibleDecks.length > 0 && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <span>未分组</span>
                        <span className="font-mono text-[10px] opacity-70">
                          ({visibleDecks.length})
                        </span>
                      </div>
                    )}

                  {visibleDecks.length > 0 ? (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                      {visibleDecks.map((deck) => {
                        const cover = deck.coverCard || deck.extra[0] || deck.main[0]
                        return (
                          <button
                            key={deck.id || deck.name}
                            type="button"
                            onClick={() => handleApply(deck)}
                            onContextMenu={(e) => handleDeckContextMenu(e, deck)}
                            className="flex items-center gap-2.5 p-2 rounded-lg border border-border/70 hover:border-blue-500/70 hover:bg-blue-500/[0.06] text-left transition-colors cursor-pointer"
                          >
                            <CardImage
                              code={cover}
                              small
                              alt={deck.name}
                              className="w-8 h-[46px] object-cover rounded shrink-0 border border-border/60"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate">{deck.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                主 {deck.main.length} / 额外 {deck.extra.length}
                              </p>
                              {(deck.group || (deck.tags && deck.tags.length > 0)) && (
                                <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                                  {[deck.group, ...(deck.tags || [])].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    (matchedDecks || visibleGroups.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                        <Layers className="w-9 h-9 opacity-25 stroke-[1.5]" />
                        <p className="text-xs">
                          {matchedDecks
                            ? '没有匹配的卡组'
                            : selectedGroup
                              ? '该分组内还没有卡组'
                              : '没有可切换的卡组'}
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
            <Button size="sm" onClick={closeDeckSwitcher} className="px-5 h-7 text-xs">
              取消
            </Button>
          </div>
        </div>
      </div>

      {deckMenu && deckMenu.deck.id && (
        <div
          ref={deckMenuRef}
          style={{ left: deckMenuPos.x, top: deckMenuPos.y }}
          className="fixed z-[70] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDeckInEditor(deckMenu.deck)}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
          >
            <SquarePen className="w-3.5 h-3.5 text-muted-foreground" />
            <span>进入卡组编辑</span>
          </Button>
        </div>
      )}
    </>
  )
}
