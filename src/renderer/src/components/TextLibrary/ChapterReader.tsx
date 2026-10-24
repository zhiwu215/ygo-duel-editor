import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Save, Search } from 'lucide-react'
import { TextChapter, TextMeta } from '@shared/index'
import { countWords } from '@shared/engine/textSplitter'
import { WindowControls } from '../ui/window-controls'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { cn } from '../../lib/utils'

interface ChapterReaderProps {
  text: TextMeta
  onBack: () => Promise<void>
  onTextUpdated: () => Promise<void>
  flash: (msg: string) => void
}

export const ChapterReader: React.FC<ChapterReaderProps> = ({
  text,
  onBack,
  onTextUpdated,
  flash
}) => {
  const [chapters, setChapters] = useState<TextChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [savedText, setSavedText] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api
      .getTextChapters(text.id)
      .then((list) => {
        if (cancelled) return
        setChapters(list)
        setActiveId(list[0]?.id ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[ChapterReader] 读取章节失败:', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [text.id])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    window.api
      .getTextChapterContent(text.id, activeId)
      .then((res) => {
        if (cancelled) return
        const text = res.success && res.content ? res.content : ''
        setDraft(text)
        setSavedText(text)
      })
      .catch((err) => console.error('[ChapterReader] 读取正文失败:', err))
    return () => {
      cancelled = true
    }
  }, [activeId, text.id])

  const pickChapter = (id: string): void => {
    if (id === activeId) return
    setActiveId(id)
    setDraft('')
    setSavedText('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return chapters
    return chapters.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.index + 1 + '').includes(q)
    )
  }, [chapters, search])

  const handleSave = async (): Promise<void> => {
    if (!activeId || draft === savedText) return
    setSaving(true)
    const res = await window.api.updateTextChapterContent(text.id, activeId, draft)
    setSaving(false)
    if (!res.success) {
      flash(res.error || '保存失败')
      return
    }
    setSavedText(draft)
    setChapters((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, wordCount: countWords(draft) } : c))
    )
    await onTextUpdated()
    flash('已保存本章正文')
  }

  const activeChapter = chapters.find((c) => c.id === activeId)
  const dirty = draft !== savedText

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <header className="shrink-0 border-b border-border/60 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 px-4 h-11">
          <button
            type="button"
            onClick={() => void onBack()}
            className="[-webkit-app-region:no-drag] w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{text.title}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{chapters.length} 章</div>
          </div>
          <div className="flex-1" />
          <div className="[-webkit-app-region:no-drag] flex items-center gap-2 -mr-4">
            {dirty && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">未保存</span>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-border text-xs font-medium hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>保存</span>
            </button>
            <WindowControls />
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-64 shrink-0 border-r border-border/60 flex flex-col min-h-0">
          <div className="shrink-0 px-2.5 py-2 border-b border-border/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索章节"
                className="h-7 pl-8 text-[11px] bg-muted/40"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="py-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-8 px-3">
                  {search ? '没有匹配的章节' : '未能拆出章节'}
                </p>
              ) : (
                filtered.map((c) => {
                  const active = c.id === activeId
                  return (
                    <div
                      key={c.id}
                      onClick={() => pickChapter(c.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 text-[11px] cursor-pointer transition-colors',
                        active
                          ? 'bg-primary/15 text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <span className="flex-1 truncate">{c.title}</span>
                      <span className="font-mono text-[9px] opacity-60 shrink-0">
                        {(c.wordCount || 0).toLocaleString()}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          {activeChapter ? (
            <>
              <div className="shrink-0 px-4 py-2 border-b border-border/60 flex items-center gap-2">
                <input
                  key={activeChapter.id}
                  defaultValue={activeChapter.title}
                  onBlur={(e) => {
                    const title = e.target.value.trim()
                    if (!title || title === activeChapter.title) {
                      e.target.value = activeChapter.title
                      return
                    }
                    void window.api
                      .updateTextChapterTitle(text.id, activeChapter.id, title)
                      .then((res) => {
                        if (!res.success) {
                          flash(res.error || '重命名失败')
                          e.target.value = activeChapter.title
                          return
                        }
                        setChapters((prev) =>
                          prev.map((c) => (c.id === activeChapter.id ? { ...c, title } : c))
                        )
                        void onTextUpdated()
                      })
                  }}
                  className="flex-1 min-w-0 bg-transparent font-semibold text-sm outline-none focus:border-b border-primary/60 h-6"
                />
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  第 {activeChapter.index} 章 · {(activeChapter.wordCount || 0).toLocaleString()} 字
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <Textarea
                  key={activeChapter.id}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  placeholder="本章正文为空"
                  style={{ fontSize: 'var(--content-font-size)' }}
                  className="h-full resize-none border-0 bg-transparent px-4 py-3 leading-[1.9] shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[11px] text-muted-foreground">从左侧选择章节查看正文</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
