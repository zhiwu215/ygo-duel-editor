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
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  GripVertical
} from 'lucide-react'
import { CardNoteEntry, CardNoteKind } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { WindowControls } from '../ui/window-controls'
import { Input } from '../ui/input'
import { CardImageViewer } from '../CardDetail/CardImageViewer'
import { CardNoteEditor } from './CardNoteEditor'
import { CardNoteAdder } from './CardNoteAdder'

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
  const [dragging, setDragging] = useState<{
    code: number
    kind: CardNoteKind
    label: string
  } | null>(null)
  const [dropHint, setDropHint] = useState<{
    code: number
    kind: CardNoteKind
    label: string
  } | null>(null)

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
      setDragging(null)
      setDropHint(null)
      if (!fromLabel || fromLabel === toLabel) return
      const entry = entries.find((e) => e.cardCode === cardCode)
      if (!entry) return
      const list = kind === 'chant' ? entry.chants : entry.notes
      const labels = list.map((c) => c.label)
      const from = labels.indexOf(fromLabel)
      const to = labels.indexOf(toLabel)
      if (from < 0 || to < 0) return
      labels.splice(to, 0, ...labels.splice(from, 1))
      await window.api.reorderCardNotes(cardCode, kind, labels)
      await fetchAll()
    },
    [entries, fetchAll]
  )

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
      const res = await window.api.saveCardNote({ cardCode, kind, label, text, updatedAt: 0 })
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
      if (!confirm(`删除${kindLabel}「${label}」？`)) return
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
      {}
      <header className="h-11 px-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center gap-3 shrink-0 [-webkit-app-region:drag]">
        <BookMarked className="w-4 h-4 text-primary shrink-0" />
        <span className="font-bold text-sm tracking-wide">卡牌图鉴</span>
        <div className="ml-auto flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => void handleImport()}
            title="从 JSON 文件导入"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            title="把你的图鉴导出为 JSON 文件"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowAdder(true)}
            title="按卡名或卡密录入新的召唤词或描述"
            className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增卡片</span>
          </button>
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

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 min-h-0">
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
              const variantCount = entry.variantCodes.length
              return (
                <div
                  key={entry.cardCode}
                  className="rounded-lg border border-border/70 bg-card/40 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [entry.cardCode]: !isOpen }))
                      }
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {entry.cardName}
                        </div>
                        {variantCount > 1 && (
                          <span className="text-[10px] text-muted-foreground/70 truncate shrink-0">
                            {variantCount} 卡密
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewCard(entry.cardCode)}
                      title="放大查看卡图"
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
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          cardCode: entry.cardCode,
                          cardName: entry.cardName,
                          kind: 'chant',
                          initial: { label: '', text: '' }
                        })
                      }
                      title="为这张卡再录一个版本的召唤词"
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          cardCode: entry.cardCode,
                          cardName: entry.cardName,
                          kind: 'note',
                          initial: { label: '', text: '' }
                        })
                      }
                      title="为这张卡添加一条描述"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                    >
                      <MessageSquareQuote className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-2.5 pb-2.5 pt-0.5 space-y-2">
                      {entry.chants.map((chant, index) => {
                        const key = `${entry.cardCode}:chant:${chant.label}`
                        const draggable = !chant.readonly && index > 0
                        return (
                          <div
                            key={chant.label}
                            draggable={draggable}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/card-note-label', chant.label)
                              e.dataTransfer.effectAllowed = 'move'
                              setDragging({
                                code: entry.cardCode,
                                kind: 'chant',
                                label: chant.label
                              })
                            }}
                            onDragEnd={() => {
                              setDragging(null)
                              setDropHint(null)
                            }}
                            onDragOver={(e) => {
                              if (!draggable) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              setDropHint({
                                code: entry.cardCode,
                                kind: 'chant',
                                label: chant.label
                              })
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const from = e.dataTransfer.getData('text/card-note-label')
                              applyReorder(entry.cardCode, 'chant', from, chant.label)
                            }}
                            className={`rounded border border-border/70 bg-background/40 px-2.5 py-2 ${
                              draggable ? 'cursor-grab active:cursor-grabbing' : ''
                            } ${
                              dropHint?.code === entry.cardCode &&
                              dropHint.kind === 'chant' &&
                              dropHint.label === chant.label &&
                              dragging?.label !== chant.label
                                ? 'ring-1 ring-primary/50'
                                : ''
                            } ${dragging?.label === chant.label ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center gap-1.5">
                              {draggable && (
                                <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                              )}
                              <span className="text-[10px] font-semibold text-foreground truncate flex-1">
                                {chant.label}
                              </span>
                              {chant.readonly && (
                                <span
                                  className="shrink-0 text-[9px] px-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                                  title="内置的经典条目，不可修改"
                                >
                                  内置
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleCopy(key, chant.text)}
                                title="复制"
                                className="p-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                              >
                                {copiedKey === key ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {!chant.readonly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditor({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'chant',
                                        initial: { label: chant.label, text: chant.text }
                                      })
                                    }
                                    title="编辑"
                                    className="p-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDelete(entry.cardCode, 'chant', chant.label)
                                    }
                                    title="删除"
                                    className="p-0.5 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
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
                      })}

                      {entry.notes.length > 0 && (
                        <div className="pt-1.5 mt-1.5 border-t border-border/50 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            <MessageSquareQuote className="w-3 h-3" />
                            <span>描述</span>
                          </div>
                          {entry.notes.map((note, index) => {
                            const key = `${entry.cardCode}:note:${note.label}`
                            const draggable = index > 0
                            return (
                              <div
                                key={note.label}
                                draggable={draggable}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/card-note-label', note.label)
                                  e.dataTransfer.effectAllowed = 'move'
                                  setDragging({
                                    code: entry.cardCode,
                                    kind: 'note',
                                    label: note.label
                                  })
                                }}
                                onDragEnd={() => {
                                  setDragging(null)
                                  setDropHint(null)
                                }}
                                onDragOver={(e) => {
                                  if (!draggable) return
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = 'move'
                                  setDropHint({
                                    code: entry.cardCode,
                                    kind: 'note',
                                    label: note.label
                                  })
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const from = e.dataTransfer.getData('text/card-note-label')
                                  applyReorder(entry.cardCode, 'note', from, note.label)
                                }}
                                className={`rounded border border-border/70 bg-background/40 px-2.5 py-2 ${
                                  draggable ? 'cursor-grab active:cursor-grabbing' : ''
                                } ${
                                  dropHint?.code === entry.cardCode &&
                                  dropHint.kind === 'note' &&
                                  dropHint.label === note.label &&
                                  dragging?.label !== note.label
                                    ? 'ring-1 ring-primary/50'
                                    : ''
                                } ${dragging?.label === note.label ? 'opacity-40' : ''}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {draggable && (
                                    <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                  )}
                                  <span className="text-[10px] font-semibold text-foreground/80 truncate flex-1">
                                    {note.label}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopy(key, note.text)}
                                    title="复制"
                                    className="p-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                  >
                                    {copiedKey === key ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditor({
                                        cardCode: entry.cardCode,
                                        cardName: entry.cardName,
                                        kind: 'note',
                                        initial: { label: note.label, text: note.text }
                                      })
                                    }
                                    title="编辑"
                                    className="p-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDelete(entry.cardCode, 'note', note.label)
                                    }
                                    title="删除"
                                    className="p-0.5 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
                                  {note.text}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
            const res = await window.api.saveCardNote({ cardCode, kind, label, text, updatedAt: 0 })
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
