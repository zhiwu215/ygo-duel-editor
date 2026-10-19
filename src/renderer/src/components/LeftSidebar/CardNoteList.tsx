import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookMarked,
  MessageSquareQuote,
  Plus,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  Upload,
  Download,
  PenLine,
  Library
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CardNoteKind } from '@shared/index'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import { Input } from '../ui/input'
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { WindowControls } from '../ui/window-controls'
import { CardImage } from '../ui/CardImage'
import { useCardNoteStore } from '../../stores/useCardNoteStore'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { useCopyFeedback } from '../../hooks/useCopyFeedback'
import {
  buildDisplayEntries,
  buildSortId,
  filterDisplayEntries,
  parseSortId,
  type DisplayEntry,
  type EntryFilterId
} from '../../utils/cardNoteSort'
import { SortableNoteRow } from './SortableNoteRow'

export interface CardNoteEditorState {
  cardCode: number
  cardName: string
  kind: CardNoteKind
  initial: { label: string; text: string; source?: string }
}

interface CardNoteListProps {
  onEdit: (editor: CardNoteEditorState) => void
  onPreview: (cardCode: number) => void
  onOpenCardMenu: (e: React.MouseEvent, entry: DisplayEntry) => void
  onOpenAdder: () => void
}

const ENTRY_FILTERS: Array<{ id: EntryFilterId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'custom', label: '自建卡' },
  { id: 'library', label: '卡库卡' }
]

export const CardNoteList: React.FC<CardNoteListProps> = ({
  onEdit,
  onPreview,
  onOpenCardMenu,
  onOpenAdder
}) => {
  const { cards: customCards, openCreate, openEdit } = useCustomCardStore()
  const {
    entries,
    initialLoading: loading,
    flash: feedback,
    notify,
    applyReorder,
    removeNote,
    removeCustomCard,
    clearEntry,
    exportLibrary,
    importLibrary
  } = useCardNoteStore()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [originFilter, setOriginFilter] = useState<EntryFilterId>('all')
  const { copiedField, copy } = useCopyFeedback('CardNoteApp')

  const displayEntries = useMemo(
    () => buildDisplayEntries(entries, customCards),
    [entries, customCards]
  )

  const previousCustomIds = useRef<Set<number> | null>(null)
  useEffect(() => {
    const ids = new Set(customCards.map((c) => c.id))
    const prev = previousCustomIds.current
    previousCustomIds.current = ids
    if (!prev) return
    const added = [...ids].filter((id) => !prev.has(id))
    if (added.length === 0) return
    const latest = added[added.length - 1]
    setExpanded((prevExpand) => ({ ...prevExpand, [latest]: true }))
    notify('已新增自建卡，可在下方添加召唤词或备注')
  }, [customCards, notify])

  const filtered = useMemo(
    () => filterDisplayEntries(displayEntries, search, originFilter),
    [displayEntries, search, originFilter]
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleEntryDragEnd =
    (cardCode: number) =>
    (event: DragEndEvent): void => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = parseSortId(String(active.id))
      const to = parseSortId(String(over.id))
      if (!from || !to || from.kind !== to.kind) return
      void applyReorder(cardCode, from.kind, from.label, to.label)
    }

  return (
    <>
      <header className="h-11 px-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center gap-3 shrink-0 [-webkit-app-region:drag]">
        <BookMarked className="w-4 h-4 text-primary shrink-0" />
        <span className="font-bold text-sm tracking-wide">卡牌图鉴</span>
        <div className="ml-auto flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void importLibrary()}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>
              }
            />
            <TooltipContent>从 JSON 文件导入</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void exportLibrary()}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                </button>
              }
            />
            <TooltipContent>把你的图鉴导出为 JSON 文件</TooltipContent>
          </Tooltip>
          <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增卡片</span>
                </button>
              }
            />
            <PopoverContent align="end" className="w-48 p-1">
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false)
                  openCreate()
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer text-left"
              >
                <PenLine className="w-3.5 h-3.5 text-violet-500" />
                <span>新建自建卡</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false)
                  onOpenAdder()
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer text-left"
              >
                <Library className="w-3.5 h-3.5 text-sky-500" />
                <span>为现有卡录入图鉴</span>
              </button>
            </PopoverContent>
          </Popover>
          <WindowControls />
        </div>
      </header>

      <div className="px-4 py-2.5 border-b border-border/60 shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索卡名 / 卡密 / 图鉴内容"
            className="h-8 pl-8 text-xs bg-muted/40"
          />
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/50 shrink-0 ml-auto">
          {ENTRY_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setOriginFilter(opt.id)}
              className={`py-1 px-2.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                originFilter === opt.id
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-500 text-[11px] shrink-0">
          {feedback}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 [scrollbar-gutter:stable]">
        <div className="px-4 pb-4 pt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-16">读取中…</p>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center mx-auto mb-3">
                <BookMarked className="w-5 h-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-semibold text-foreground/85">
                {search
                  ? '没有匹配的召唤词'
                  : originFilter === 'custom'
                    ? '还没有自建卡'
                    : '还没有录入任何召唤词'}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {search
                  ? '换个关键词试试'
                  : originFilter === 'custom'
                    ? '点右上角「新增卡片」→「新建自建卡」。'
                    : '卡库里没有召唤词和卡片备注。点右上角「新增卡片」开始。'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((entry) => {
                const isOpen = expanded[entry.cardCode] ?? false
                return (
                  <Collapsible
                    key={entry.cardCode}
                    open={isOpen}
                    onOpenChange={(o) => setExpanded((prev) => ({ ...prev, [entry.cardCode]: o }))}
                    className="rounded-lg border border-border/70 bg-card/40 overflow-hidden"
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setExpanded((prev) => ({ ...prev, [entry.cardCode]: !isOpen }))
                          }
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 -ml-1 text-muted-foreground transition-transform duration-300 ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        />
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onContextMenu={(e) => onOpenCardMenu(e, entry)}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onPreview(entry.cardCode)
                                }}

                                className="shrink-0 cursor-zoom-in rounded transition-transform duration-150 hover:scale-105"
                              >
                                <CardImage
                                  code={entry.cardCode}
                                  small
                                  alt={entry.cardName}
                                  className="w-8 h-11 object-cover rounded border border-border/60"
                                />
                              </button>
                            }
                          />
                          <TooltipContent>放大查看卡图</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="min-w-0 flex-1 text-xs font-semibold text-foreground truncate">
                                {entry.cardName}
                              </span>
                            }
                          />
                          <TooltipContent>{entry.cardName}</TooltipContent>
                        </Tooltip>
                        {entry.isCustom && (
                          <span className="shrink-0 text-[9px] px-1 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25">
                            自建
                          </span>
                        )}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEdit({
                                    cardCode: entry.cardCode,
                                    cardName: entry.cardName,
                                    kind: 'chant',
                                    initial: { label: '', text: '' }
                                  })
                                }}

                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>添加召唤词</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEdit({
                                    cardCode: entry.cardCode,
                                    cardName: entry.cardName,
                                    kind: 'note',
                                    initial: { label: '', text: '' }
                                  })
                                }}

                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                              >
                                <MessageSquareQuote className="w-3.5 h-3.5" />
                              </button>
                            }
                          />
                          <TooltipContent>添加备注</TooltipContent>
                        </Tooltip>
                        {!entry.isCustom && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void clearEntry(entry.cardCode)
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              }
                            />
                            <TooltipContent>
                              清空该卡全部召唤词与备注（内置条目保留）
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {entry.isCustom && (
                          <>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEdit(entry.cardCode)
                                    }}
                                    className="p-1 rounded text-violet-500/80 hover:text-violet-500 hover:bg-violet-500/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                }
                              />
                              <TooltipContent>编辑自建卡信息</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void removeCustomCard(entry.cardCode)
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                }
                              />
                              <TooltipContent>删除自建卡</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-2.5 pb-2.5 pt-0.5 space-y-2">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleEntryDragEnd(entry.cardCode)}
                        >
                          {entry.chants.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-semibold text-muted-foreground">
                                召唤词
                              </div>
                              <SortableContext
                                items={entry.chants.map((c) => buildSortId('chant', c.label))}
                                strategy={verticalListSortingStrategy}
                              >
                                {entry.chants.map((chant) => (
                                  <SortableNoteRow
                                    key={chant.label}
                                    kind="chant"
                                    item={chant}
                                    copyKey={`${entry.cardCode}:chant:${chant.label}`}
                                    copiedField={copiedField}
                                    onCopy={copy}
                                    onEdit={() =>
                                      onEdit({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'chant',
                                        initial: {
                                          label: chant.label,
                                          text: chant.text,
                                          source: chant.source
                                        }
                                      })
                                    }
                                    onDelete={() =>
                                      void removeNote(entry.cardCode, 'chant', chant.label)
                                    }
                                  />
                                ))}
                              </SortableContext>
                            </div>
                          )}

                          {entry.notes.length > 0 && (
                            <div className="pt-1.5 mt-1.5 border-t border-border/50 space-y-1.5">
                              <div className="text-[10px] font-semibold text-muted-foreground">
                                备注
                              </div>
                              <SortableContext
                                items={entry.notes.map((n) => buildSortId('note', n.label))}
                                strategy={verticalListSortingStrategy}
                              >
                                {entry.notes.map((note) => (
                                  <SortableNoteRow
                                    key={note.label}
                                    kind="note"
                                    item={note}
                                    copyKey={`${entry.cardCode}:note:${note.label}`}
                                    copiedField={copiedField}
                                    onCopy={copy}
                                    onEdit={() =>
                                      onEdit({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'note',
                                        initial: { label: note.label, text: note.text }
                                      })
                                    }
                                    onDelete={() =>
                                      void removeNote(entry.cardCode, 'note', note.label)
                                    }
                                  />
                                ))}
                              </SortableContext>
                            </div>
                          )}
                        </DndContext>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}
