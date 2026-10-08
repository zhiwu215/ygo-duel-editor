import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import { useEffect, useRef, useState, type JSX, type RefObject } from 'react'
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, Loader2 } from 'lucide-react'
import { AgentTextSourceRef, TextChapter, TextMeta } from '@shared/index'
import { cn } from '../../lib/utils'

interface TextSourcePickerProps {
  pos: { right: number; bottom: number } | null

  anchorRef: RefObject<HTMLDivElement | null>
  onClose: () => void

  onAttach: (selection: AgentTextSourceRef) => void
}

export function TextSourcePicker({
  pos,
  anchorRef,
  onClose,
  onAttach
}: TextSourcePickerProps): JSX.Element {
  const [texts, setTexts] = useState<TextMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTextId, setExpandedTextId] = useState<string | null>(null)
  const [chaptersByText, setChaptersByText] = useState<Record<string, TextChapter[]>>({})
  const [chapterLoadingId, setChapterLoadingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const list = await window.api.getTextList()
        if (!cancelled) setTexts(list)
      } catch (err) {
        console.error('[TextSourcePicker] load texts failed:', err)
        if (!cancelled) setError('小说资料库加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleImport = async (): Promise<void> => {
    if (importing) return
    setImporting(true)
    setError(null)
    try {
      const res = await window.api.importTextFile()
      if (res.success && res.text) {
        const list = await window.api.getTextList()
        setTexts(list)
        if (res.text.id) setExpandedTextId(res.text.id)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      console.error('[TextSourcePicker] import failed:', err)
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const toggleText = async (text: TextMeta): Promise<void> => {
    if (expandedTextId === text.id) {
      setExpandedTextId(null)
      return
    }
    setExpandedTextId(text.id)
    if (chaptersByText[text.id]) return
    setChapterLoadingId(text.id)
    try {
      const chapters = await window.api.getTextChapters(text.id)
      setChaptersByText((prev) => ({ ...prev, [text.id]: chapters }))
    } catch (err) {
      console.error('[TextSourcePicker] load chapters failed:', err)
      setError('章节列表加载失败')
    } finally {
      setChapterLoadingId(null)
    }
  }

  return (
    <div
      ref={containerRef}
      style={pos ? { right: pos.right, bottom: pos.bottom } : undefined}
      className="fixed z-[70] mb-1 w-64 max-w-[calc(100vw-1.5rem)]"
    >
      <div className="bg-popover border border-border rounded-md overflow-hidden shadow-lg">
        <div className="px-2.5 py-2 border-b border-border flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground min-w-0">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">文本素材</span>
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing}

                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 shrink-0"
                >
                  {importing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FilePlus2 className="w-3 h-3" />
                  )}
                  <span>导入</span>
                </button>
              }
            />
            <TooltipContent>导入本地小说文件（txt / md / epub），自动按章节拆分</TooltipContent>
          </Tooltip>
        </div>

        <ScrollArea className="max-h-72">
          <div className="py-1">
            {loading ? (
              <div className="flex items-center justify-center gap-1.5 px-3 py-4 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>加载中...</span>
              </div>
            ) : texts.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-muted-foreground leading-4 text-center">
                资料库还没有小说。
                <br />
                点上方「导入」选择 TXT / MD 文件即可
              </div>
            ) : (
              texts.map((text) => {
                const open = expandedTextId === text.id
                const chapters = chaptersByText[text.id]
                return (
                  <div key={text.id}>
                    <button
                      type="button"
                      onClick={() => void toggleText(text)}
                      className={cn(
                        'w-full px-2.5 py-1.5 flex items-center gap-1.5 text-left text-[11px] transition-colors hover:bg-muted/60',
                        open && 'bg-muted/40'
                      )}
                    >
                      {open ? (
                        <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 min-w-0 truncate font-medium">{text.title}</span>
                      <span className="shrink-0 text-[9px] text-muted-foreground font-mono">
                        {text.chapterCount ?? 0} 章
                      </span>
                    </button>

                    {open &&
                      (chapterLoadingId === text.id ? (
                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>章节加载中...</span>
                        </div>
                      ) : chapters && chapters.length > 0 ? (
                        <ScrollArea className="max-h-40 border-t border-border/40">
                          <div>
                            {chapters.map((chapter) => (
                              <button
                                key={chapter.id}
                                type="button"
                                onClick={() =>
                                  onAttach({
                                    textId: text.id,
                                    chapterId: chapter.id,
                                    title: `${text.title} · ${chapter.title}`,
                                    wordCount: chapter.wordCount
                                  })
                                }
                                className="w-full pl-6 pr-2.5 py-1 flex items-center gap-1.5 text-left text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                              >
                                <span className="flex-1 min-w-0 truncate">{chapter.title}</span>
                                <span className="shrink-0 font-mono text-[9px]">
                                  {chapter.wordCount} 字
                                </span>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="pl-6 pr-2.5 py-1.5 text-[10px] text-muted-foreground/70">
                          无章节（可尝试在资料库重新拆分）
                        </div>
                      ))}
                  </div>
                )
              })
            )}

            {error && (
              <div className="mx-2.5 my-1 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
