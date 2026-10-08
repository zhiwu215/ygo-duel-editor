import React, { useEffect, useState } from 'react'
import { BookOpen, Loader2, X } from 'lucide-react'
import { DuelSourceRef, TextChapter } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { cn } from '../../lib/utils'

interface DuelSourceReaderDialogProps {
  sourceRef: DuelSourceRef
  onClose: () => void
}

interface ReaderChapter {
  id: string
  title: string
  wordCount?: number
  content?: string
}

export const DuelSourceReaderDialog: React.FC<DuelSourceReaderDialogProps> = ({
  sourceRef,
  onClose
}) => {
  const [chapters, setChapters] = useState<ReaderChapter[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api
      .getTextChapters(sourceRef.textId)
      .then((all) => {
        if (cancelled) return
        const picked = sourceRef.chapterIds
          .map((id) => all.find((c) => c.id === id))
          .filter((c): c is TextChapter => Boolean(c))
        setChapters(picked)
        setActiveId(picked[0]?.id ?? null)
      })
      .catch((err) => {
        console.error('[DuelSourceReader] 章节读取失败:', err)
      })
    return () => {
      cancelled = true
    }
  }, [sourceRef])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    window.api
      .getTextChapterContent(sourceRef.textId, activeId)
      .then((res) => {
        if (cancelled || !res.success || !res.content) return
        const text = res.content
        setChapters((prev) =>
          prev ? prev.map((c) => (c.id === activeId ? { ...c, content: text } : c)) : prev
        )
      })
      .catch((err) => {
        console.error('[DuelSourceReader] 正文读取失败:', err)
      })
    return () => {
      cancelled = true
    }
  }, [sourceRef, activeId])

  const activeChapter = chapters?.find((c) => c.id === activeId)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col !p-0 !bg-card !text-card-foreground !max-w-3xl border border-border rounded-xl shadow-2xl w-full h-[78vh] overflow-hidden select-none"
      >
        <DialogHeader className="!flex !flex-row items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 space-y-0">
          <BookOpen className="w-4 h-4 text-violet-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-bold text-sm truncate">
              《{sourceRef.textTitle || '未命名文本'}》
            </DialogTitle>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              本局来自该文本的 {sourceRef.chapterIds.length} 个章节
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex">
          <ScrollArea className="w-48 lg:w-56 shrink-0 border-r border-border/60">
            <div className="p-1.5 space-y-0.5">
              {chapters === null ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                chapters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'w-full px-2 py-1.5 rounded text-left transition-colors cursor-pointer border border-transparent',
                      activeId === c.id
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <span
                      className={cn(
                        'block text-[11px] truncate',
                        activeId === c.id
                          ? 'text-violet-600 dark:text-violet-300 font-semibold'
                          : 'text-foreground/85'
                      )}
                    >
                      {c.title}
                    </span>
                    {c.wordCount ? (
                      <span className="block text-[9px] text-muted-foreground/70 font-mono mt-0.5">
                        {(c.wordCount || 0).toLocaleString()} 字
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <ScrollArea className="flex-1 min-w-0">
            <div className="p-4">
              {activeChapter?.content === undefined || activeChapter?.content === null ? (
                <div className="py-20 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <div className="text-[11.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans select-text cursor-text">
                  {activeChapter.content}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
