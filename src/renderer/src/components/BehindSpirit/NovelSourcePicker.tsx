import { useEffect, useRef, useState, type JSX, type RefObject } from 'react'
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, Loader2 } from 'lucide-react'
import { AgentNovelSourceRef, NovelChapter, NovelMeta } from '@shared/index'
import { cn } from '../../lib/utils'

interface NovelSourcePickerProps {
  /** 浮层锚点（视口坐标，右下角定位），由父组件算好传入 */
  pos: { right: number; bottom: number } | null
  /** 触发按钮的 ref：点外部关闭时用来豁免触发器本身 */
  anchorRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  /** 选中章节后回调（传资料库章节形态的素材） */
  onAttach: (selection: AgentNovelSourceRef) => void
}

/**
 * 小说素材选择浮层（Portal 到 body，同 BehindSpiritPanel 的模型选择浮层模式）
 *
 * 小说正文不在浮层里读取：选章后只把定位器交给父组件，
 * 正文由主进程在发送消息时经 libraryService 读取，避免浮层拉几万字卡 UI。
 */
export function NovelSourcePicker({
  pos,
  anchorRef,
  onClose,
  onAttach
}: NovelSourcePickerProps): JSX.Element {
  const [novels, setNovels] = useState<NovelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNovelId, setExpandedNovelId] = useState<string | null>(null)
  const [chaptersByNovel, setChaptersByNovel] = useState<Record<string, NovelChapter[]>>({})
  const [chapterLoadingId, setChapterLoadingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 浮层根容器：Portal 到 body 后，「点外部关闭」靠这个 ref 判断点击是否落在浮层内
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
        const list = await window.api.getNovelList()
        if (!cancelled) setNovels(list)
      } catch (err) {
        console.error('[NovelSourcePicker] load novels failed:', err)
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
      const res = await window.api.importNovelFile()
      if (res.success && res.novel) {
        const list = await window.api.getNovelList()
        setNovels(list)
        if (res.novel.id) setExpandedNovelId(res.novel.id)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      console.error('[NovelSourcePicker] import failed:', err)
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const toggleNovel = async (novel: NovelMeta): Promise<void> => {
    if (expandedNovelId === novel.id) {
      setExpandedNovelId(null)
      return
    }
    setExpandedNovelId(novel.id)
    if (chaptersByNovel[novel.id]) return
    setChapterLoadingId(novel.id)
    try {
      const chapters = await window.api.getNovelChapters(novel.id)
      setChaptersByNovel((prev) => ({ ...prev, [novel.id]: chapters }))
    } catch (err) {
      console.error('[NovelSourcePicker] load chapters failed:', err)
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
            <span className="truncate">小说素材</span>
          </span>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing}
            title="导入本地小说文件（txt / md / epub），自动按章节拆分"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 shrink-0"
          >
            {importing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FilePlus2 className="w-3 h-3" />
            )}
            <span>导入</span>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-1.5 px-3 py-4 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : novels.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-muted-foreground leading-4 text-center">
              资料库还没有小说。
              <br />
              点上方「导入」选择 TXT / MD 文件即可
            </div>
          ) : (
            novels.map((novel) => {
              const open = expandedNovelId === novel.id
              const chapters = chaptersByNovel[novel.id]
              return (
                <div key={novel.id}>
                  <button
                    type="button"
                    onClick={() => void toggleNovel(novel)}
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
                    <span className="flex-1 min-w-0 truncate font-medium">{novel.title}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground font-mono">
                      {novel.chapterCount ?? 0} 章
                    </span>
                  </button>

                  {open &&
                    (chapterLoadingId === novel.id ? (
                      <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>章节加载中...</span>
                      </div>
                    ) : chapters && chapters.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border-t border-border/40">
                        {chapters.map((chapter) => (
                          <button
                            key={chapter.id}
                            type="button"
                            onClick={() =>
                              onAttach({
                                novelId: novel.id,
                                chapterId: chapter.id,
                                title: `${novel.title} · ${chapter.title}`,
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
      </div>
    </div>
  )
}
