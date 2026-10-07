import { ScrollArea } from '../ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookMarked,
  MessageSquareQuote,
  Plus,
  Search,
  Trash2,
  Copy,
  Check,
  Pencil,
  ChevronRight,
  Upload,
  Download,
  GripVertical
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CardNoteEntry, CardNoteKind, CardNote } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { WindowControls } from '../ui/window-controls'
import { Input } from '../ui/input'
import { CardImageViewer } from '../CardDetail/CardImageViewer'
import { CardNoteEditor } from './CardNoteEditor'
import { CardNoteAdder } from './CardNoteAdder'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { confirmDialog } from '../../stores/useDialogStore'

function parseSortId(id: string): { kind: CardNoteKind; label: string } | null {
  const sep = id.indexOf('::')
  if (sep <= 0) return null
  const k = id.slice(0, sep)
  if (k !== 'chant' && k !== 'note') return null
  return { kind: k as CardNoteKind, label: id.slice(sep + 2) }
}

function buildSortId(kind: CardNoteKind, label: string): string {
  return `${kind}::${label}`
}

export const CardNoteApp: React.FC = () => {
  const [entries, setEntries] = useState<CardNoteEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editor, setEditor] = useState<{
    cardCode: number
    cardName: string
    kind: CardNoteKind
    initial: { label: string; text: string }
  } | null>(null)
  const [showAdder, setShowAdder] = useState(false)
  const [previewCard, setPreviewCard] = useState<number | null>(null)

  const flash = useCallback((msg: string): void => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }, [])

  const fetchAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setEntries(await window.api.listCardNotes())
    } catch (err) {
      console.error('[CardNoteApp] 读取召唤词库失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const applyReorder = useCallback(
    async (
      cardCode: number,
      kind: CardNoteKind,
      fromLabel: string,
      toLabel: string
    ): Promise<void> => {
      if (!fromLabel || fromLabel === toLabel) return
      let nextLabels: string[] | null = null
      setEntries((prev) =>
        prev.map((e) => {
          if (e.cardCode !== cardCode) return e
          const list = kind === 'chant' ? [...e.chants] : [...e.notes]
          const fromIdx = list.findIndex((c) => c.label === fromLabel)
          const toIdx = list.findIndex((c) => c.label === toLabel)
          if (fromIdx < 0 || toIdx < 0) return e
          list.splice(toIdx, 0, ...list.splice(fromIdx, 1))
          nextLabels = list.map((c) => c.label)
          return kind === 'chant' ? { ...e, chants: list } : { ...e, notes: list }
        })
      )
      if (nextLabels) {
        void window.api.reorderCardNotes(cardCode, kind, nextLabels)
      }
    },
    []
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

  useEffect(() => {
    let cancelled = false
    window.api
      .listCardNotes()
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((err) => {
        console.error('[CardNoteApp] 初始读取失败:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (!search.trim()) return true
        const kw = search.trim().toLowerCase()
        return (
          e.cardName.toLowerCase().includes(kw) ||
          String(e.cardCode).includes(kw) ||
          e.chants.some(
            (c) => c.label.toLowerCase().includes(kw) || c.text.toLowerCase().includes(kw)
          )
        )
      }),
    [entries, search]
  )

  const handleSave = useCallback(
    async (cardCode: number, kind: CardNoteKind, label: string, text: string): Promise<boolean> => {
      const res = await window.api.saveCardNote({ cardCode, kind, label, text })
      if (!res.success) {
        flash(res.error || '保存失败')
        return false
      }
      await fetchAll()
      return true
    },
    [fetchAll, flash]
  )

  const handleDelete = useCallback(
    async (cardCode: number, kind: CardNoteKind, label: string): Promise<void> => {
      const kindLabel = kind === 'chant' ? '召唤词' : '描述'
      const ok = await confirmDialog({
        title: `删除${kindLabel}「${label}」`,
        confirmText: '删除'
      })
      if (!ok) return
      await window.api.deleteCardNote(cardCode, kind, label)
      await fetchAll()
      flash('已删除')
    },
    [fetchAll, flash]
  )

  const existingLabelsFor = useCallback(
    (cardCode: number, kind: CardNoteKind): string[] => {
      const entry = entries.find((e) => e.cardCode === cardCode)
      if (!entry) return []
      return (kind === 'chant' ? entry.chants : entry.notes).map((c) => c.label)
    },
    [entries]
  )

  const handleCopy = useCallback(async (key: string, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch (err) {
      console.error('[CardNoteApp] 复制失败:', err)
    }
  }, [])

  const handleExport = async (): Promise<void> => {
    const res = await window.api.exportCardNoteLibrary()
    if (res.success && res.filePath) flash('已导出卡牌图鉴')
  }

  const handleImport = async (): Promise<void> => {
    const res = await window.api.importCardNoteLibrary()
    if (res.success) {
      await fetchAll()
      flash(`已导入 ${res.imported} 条`)
    } else if (res.error) {
      flash(res.error)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-11 px-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center gap-3 shrink-0 [-webkit-app-region:drag]">
        <BookMarked className="w-4 h-4 text-primary shrink-0" />
        <span className="font-bold text-sm tracking-wide">卡牌图鉴</span>
        <div className="ml-auto flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void handleImport()}
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
                  onClick={() => void handleExport()}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                </button>
              }
            />
            <TooltipContent>把你的图鉴导出为 JSON 文件</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setShowAdder(true)}
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增卡片</span>
                </button>
              }
            />
            <TooltipContent>按卡名或卡密录入新的召唤词或描述</TooltipContent>
          </Tooltip>
          <WindowControls />
        </div>
      </header>

      <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索卡名 / 卡密 / 图鉴内容"
            className="h-8 pl-8 text-xs bg-muted/40"
          />
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
                {search ? '没有匹配的召唤词' : '还没有录入任何召唤词'}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {search
                  ? '换个关键词试试'
                  : '卡库里没有召唤词和卡片描述。点右上角「新增卡片」开始。'}
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewCard(entry.cardCode)
                                }}

                                className="shrink-0 cursor-zoom-in rounded transition-transform duration-150 hover:scale-105"
                              >
                                <img
                                  src={getCardImageUrl(entry.cardCode, true)}
                                  alt={entry.cardName}
                                  className="w-8 h-11 object-cover rounded border border-border/60"
                                  onError={(e) => {
                                    const el = e.currentTarget
                                    if (el.src !== CARD_BACK_IMAGE) el.src = CARD_BACK_IMAGE
                                  }}
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
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditor({
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
                                  setEditor({
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
                          <TooltipContent>添加描述</TooltipContent>
                        </Tooltip>
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
                                {entry.chants.map((chant, index) => (
                                  <SortableChantRow
                                    key={chant.label}
                                    chant={chant}
                                    blockedByReadonly={entry.chants
                                      .slice(0, index)
                                      .some((c) => c.readonly)}
                                    copyKey={`${entry.cardCode}:chant:${chant.label}`}
                                    copiedKey={copiedKey}
                                    onCopy={handleCopy}
                                    onEdit={() =>
                                      setEditor({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'chant',
                                        initial: { label: chant.label, text: chant.text }
                                      })
                                    }
                                    onDelete={() =>
                                      void handleDelete(entry.cardCode, 'chant', chant.label)
                                    }
                                  />
                                ))}
                              </SortableContext>
                            </div>
                          )}

                          {entry.notes.length > 0 && (
                            <div className="pt-1.5 mt-1.5 border-t border-border/50 space-y-1.5">
                              <div className="text-[10px] font-semibold text-muted-foreground">
                                描述
                              </div>
                              <SortableContext
                                items={entry.notes.map((n) => buildSortId('note', n.label))}
                                strategy={verticalListSortingStrategy}
                              >
                                {entry.notes.map((note, index) => (
                                  <SortableNoteRow
                                    key={note.label}
                                    note={note}
                                    blockedByReadonly={entry.notes
                                      .slice(0, index)
                                      .some((n) => n.readonly)}
                                    copyKey={`${entry.cardCode}:note:${note.label}`}
                                    copiedKey={copiedKey}
                                    onCopy={handleCopy}
                                    onEdit={() =>
                                      setEditor({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'note',
                                        initial: { label: note.label, text: note.text }
                                      })
                                    }
                                    onDelete={() =>
                                      void handleDelete(entry.cardCode, 'note', note.label)
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

      {editor && (
        <CardNoteEditor
          cardName={editor.cardName}
          kind={editor.kind}
          initial={editor.initial}
          existingLabels={existingLabelsFor(editor.cardCode, editor.kind)}
          onSave={(label, text) => handleSave(editor.cardCode, editor.kind, label, text)}
          onClose={() => setEditor(null)}
        />
      )}

      {showAdder && (
        <CardNoteAdder
          existingLabelsFor={existingLabelsFor}
          onSave={async (cardCode, kind, label, text) => {
            const res = await window.api.saveCardNote({ cardCode, kind, label, text })
            if (!res.success) {
              flash(res.error || '保存失败')
              return false
            }
            await fetchAll()
            flash(kind === 'chant' ? '已录入召唤词' : '已添加描述')
            return true
          }}
          onClose={() => setShowAdder(false)}
        />
      )}

      {previewCard !== null && (
        <CardImageViewer
          cardCode={previewCard}
          cardName={entries.find((e) => e.cardCode === previewCard)?.cardName ?? ''}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  )
}

interface SortableRowProps {
  copyKey: string
  copiedKey: string | null
  onCopy: (key: string, text: string) => Promise<void> | void
  onEdit: () => void
  onDelete: () => void
}

function SortableChantRow({
  chant,
  blockedByReadonly,
  copyKey,
  copiedKey,
  onCopy,
  onEdit,
  onDelete
}: SortableRowProps & { chant: CardNote; blockedByReadonly: boolean }): React.JSX.Element {
  const draggable = !chant.readonly && !blockedByReadonly
  const id = buildSortId('chant', chant.label)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border border-border/70 bg-background/40 px-2.5 py-2 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40 z-10' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {draggable && (
          <span aria-hidden="true" className="shrink-0 text-muted-foreground/40 -ml-0.5">
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        <span className="text-[10px] font-semibold text-foreground truncate flex-1">
          {chant.label}
        </span>
        {chant.readonly && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="shrink-0 text-[9px] px-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                  内置
                </span>
              }
            />
            <TooltipContent>内置的经典条目，不可修改</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => void onCopy(copyKey, chant.text)}
                className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === copyKey ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            }
          />
          <TooltipContent>复制</TooltipContent>
        </Tooltip>
        {!chant.readonly && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onEdit}
                    className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
      <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
        {chant.text}
      </p>
      {(chant.user || chant.source) && (
        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed">
          {chant.user && (
            <span>
              使用者：<span className="text-foreground/80">{chant.user}</span>
            </span>
          )}
          {chant.user && chant.source && <span className="mx-1.5">·</span>}
          {chant.source && <span>出自：{chant.source}</span>}
        </p>
      )}
    </div>
  )
}

function SortableNoteRow({
  note,
  blockedByReadonly,
  copyKey,
  copiedKey,
  onCopy,
  onEdit,
  onDelete
}: SortableRowProps & { note: CardNote; blockedByReadonly: boolean }): React.JSX.Element {
  const draggable = !note.readonly && !blockedByReadonly
  const id = buildSortId('note', note.label)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border border-border/70 bg-background/40 px-2.5 py-2 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40 z-10' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {draggable && (
          <span aria-hidden="true" className="shrink-0 text-muted-foreground/40 -ml-0.5">
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        <span className="text-[10px] font-semibold text-foreground/80 truncate flex-1">
          {note.label}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => void onCopy(copyKey, note.text)}
                className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === copyKey ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            }
          />
          <TooltipContent>复制</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onEdit}
                className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            }
          />
          <TooltipContent>编辑</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            }
          />
          <TooltipContent>删除</TooltipContent>
        </Tooltip>
      </div>
      <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
        {note.text}
      </p>
    </div>
  )
}
