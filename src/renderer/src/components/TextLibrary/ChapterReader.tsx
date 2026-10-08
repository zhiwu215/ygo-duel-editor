import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Minus, Save, Search } from 'lucide-react'
import { TextChapter, TextMeta } from '@shared/index'
import { WindowControls } from '../ui/window-controls'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { cn } from '../../lib/utils'

interface ChapterReaderProps {
  text: TextMeta
  onBack: () => Promise<void>
  onTextUpdated: () => Promise<void>
  onDeleted: () => Promise<void>
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
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
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
        setPicked(new Set())
        setActiveId(list[0]?.id ?? null)
        setAnchor(list[0]?.id ?? null)
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

  const toggle = (id: string, shiftKey: boolean): void => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (shiftKey && anchor) {
        const list = filtered.map((c) => c.id)
        const a = list.indexOf(anchor)
        const b = list.indexOf(id)
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          const allOn = list.slice(lo, hi + 1).every((x) => next.has(x))
          for (let i = lo; i <= hi; i++) {
            if (allOn) next.delete(list[i])
            else next.add(list[i])
          }
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!shiftKey) setAnchor(id)
  }

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

  const handleSend = async (): Promise<void> => {
    const list = chapters.filter((c) => picked.has(c.id))
    if (list.length === 0) {
      flash('请先选择章节')
      return
    }
    const total = list.reduce((sum, c) => sum + (c.wordCount || 0), 0)
    const names = list.map((c) => c.title)
    const label = names.length === 1 ? names[0] : `${names[0]} 等 ${names.length} 章`

    const res = await window.api.agentHandoff({
      prompt: `请根据《${text.title}》的「${label}」编排一场决斗剧情（共 ${list.length} 章、约 ${total.toLocaleString()} 字）。

要求：
- 先判断原文里哪几段适合改写成决斗，只编排这些段落；
- 把角色与冲突改写为决斗双方的动作与台词，按回合与阶段拆分为可执行步骤；
- 保留原文关键设定与人物性格，不要照抄原文叙述句式；
- 同时给出开局盘面（双方 LP、场上卡片与表示形式、手牌），以便直接摆到决斗场上。

已附加这 ${list.length} 章原文，请先用 read_text_source 通读后再动笔。`,
      textSource: {
        textId: text.id,
        chapterId: list[0].id,
        chapterIds: list.map((c) => c.id),
        title: `《${text.title}》· ${label}`,
        wordCount: total
      }
    })
    if (!res.success) {
      flash(res.error || '交给背后灵失败')
      return
    }
    flash(`已把 ${list.length} 章交给背后灵编排`)
  }

  const activeChapter = chapters.find((c) => c.id === activeId)
  const dirty = draft !== savedText
  const allOn = chapters.length > 0 && picked.size === chapters.length
  const partial = picked.size > 0 && !allOn
  const allFilteredOn = filtered.length > 0 && filtered.every((c) => picked.has(c.id))

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <header className="shrink-0 border-b border-border/60 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 px-4 h-11">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void onBack()}
                  className="[-webkit-app-region:no-drag] w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              }
            />
            <TooltipContent>返回素材库</TooltipContent>
          </Tooltip>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{text.title}</div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {chapters.length} 章 · 选中 {picked.size} 章
            </div>
          </div>
          <div className="flex-1" />
          <div className="[-webkit-app-region:no-drag] flex items-center gap-2 -mr-3">
            {dirty && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">未保存</span>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
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
                }
              />
              <TooltipContent>保存本章正文</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={picked.size === 0}

                    className="flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    <span>交给背后灵编排（{picked.size} 章）</span>
                  </button>
                }
              />
              <TooltipContent>把选中的章节交给背后灵编排成对局</TooltipContent>
            </Tooltip>
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
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
              <span
                onClick={() =>
                  setPicked(allFilteredOn ? new Set() : new Set(filtered.map((c) => c.id)))
                }
                className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    'w-3 h-3 rounded-[3px] border shrink-0 flex items-center justify-center',
                    allOn
                      ? 'bg-primary border-primary'
                      : partial
                        ? 'bg-primary/40 border-primary'
                        : 'border-muted-foreground/40'
                  )}
                >
                  {allOn ? (
                    <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                  ) : partial ? (
                    <Minus className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                  ) : null}
                </span>
                <span>全选</span>
              </span>
              <span className="font-mono">
                {picked.size}/{chapters.length}
              </span>
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
                  const on = picked.has(c.id)
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
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle(c.id, e.shiftKey)
                        }}
                        className="w-3 h-3 rounded-[3px] border shrink-0 flex items-center justify-center"
                      >
                        <span
                          className={cn(
                            'w-full h-full rounded-[2px] flex items-center justify-center',
                            on ? 'bg-primary' : 'bg-transparent'
                          )}
                        >
                          {on && (
                            <Check
                              className="w-2.5 h-2.5 text-primary-foreground"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                      </span>
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
                  className="h-full resize-none border-0 bg-transparent px-4 py-3 text-[13px] leading-[1.9] shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
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

function countWords(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0
  const rest = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + rest
}
