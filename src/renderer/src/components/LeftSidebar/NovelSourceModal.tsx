import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { NovelChapter, NovelMeta } from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { cn } from '../../lib/utils'

interface NovelSourceModalProps {
  onClose: () => void
  /** 已交给 AI 后回调，用于让宿主刷新状态或切换到背后灵 */
  onSent?: (chapterCount: number) => void
}

/**
 * 从小说提取对局：导入 → 拆章 → 选段 → 交给背后灵编排
 *
 * 这一环是「原料 → 成品」的入口，所以做成弹窗挂在决斗档案面板上，
 * 而不是常驻侧栏：原料本身不是可浏览的资产，它的价值完全体现在
 * 能生成出多少场对局。生成结果统一存进 `projects/*.ygoduel`，
 * 与其他对局在同一个列表里，不另立门户。
 */
export const NovelSourceModal: React.FC<NovelSourceModalProps> = ({ onClose, onSent }) => {
  const { sendMessage, isGenerating } = useAgentStore()
  const { setSeries } = useDuelStore()

  const [novels, setNovels] = useState<NovelMeta[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 展开的章节列表：novelId -> 章节数组 */
  const [expanded, setExpanded] = useState<Record<string, NovelChapter[]>>({})

  const flash = useCallback((msg: string): void => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const fetchNovels = useCallback(async (): Promise<void> => {
    try {
      setNovels(await window.api.getNovelList())
    } catch (err) {
      console.error('[NovelSourceModal] 获取小说列表失败:', err)
      setError('读取小说列表失败')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api
      .getNovelList()
      .then((list) => {
        if (!cancelled) setNovels(list)
      })
      .catch((err) => {
        console.error('[NovelSourceModal] 初始获取小说列表失败:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleImport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.importNovelFile()
      if (res.success && res.novel) {
        await fetchNovels()
        flash(`已导入《${res.novel.title}》`)
      } else if (!res.success) {
        setError(res.error || '导入失败')
      }
    } catch (err) {
      console.error('[NovelSourceModal] 导入小说失败:', err)
      setError('导入失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, item: NovelMeta): Promise<void> => {
    e.stopPropagation()
    if (!confirm(`确认删除《${item.title}》？\n原文与拆分结果都会移除。`)) return
    const res = await window.api.deleteNovel(item.id)
    if (!res.success) {
      flash(res.error || '删除失败')
      return
    }
    setExpanded((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    await fetchNovels()
    flash('已删除')
  }

  const toggleChapters = async (item: NovelMeta): Promise<void> => {
    if (expanded[item.id]) {
      setExpanded((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      return
    }
    const chapters = await window.api.getNovelChapters(item.id)
    setExpanded((prev) => ({ ...prev, [item.id]: chapters }))
  }

  /**
   * 把选中章节正文发给背后灵。
   *
   * 正文只进模型输入（第三个参数），不进对话记录 —— 几十万字写进 messages
   * 会把上下文撑爆、也会让后续每轮都重复携带。
   */
  /**
   * 把小说名登记为作品分类，并设为当前局面的归属
   *
   * 这样背后灵编排完、用户存档时会自动落进这本小说的分类里，
   * 不必事后手动归类。分类重名时后端会报错，忽略即可。
   */
  const registerSeries = async (title: string): Promise<void> => {
    const name = title.trim()
    if (!name || !window.api.createProjectSeries) return
    try {
      await window.api.createProjectSeries(name)
    } catch (err) {
      console.warn('[NovelSourceModal] 登记作品分类失败:', err)
    }
    setSeries(name)
  }

  const handleSend = async (novel: NovelMeta, chapters: NovelChapter[]): Promise<void> => {
    const picked = chapters.filter((c) => c.content)
    if (picked.length === 0) {
      flash('所选章节没有正文内容')
      return
    }
    await registerSeries(novel.title)
    const total = picked.reduce((sum, c) => sum + (c.content?.length || 0), 0)
    const materials = picked.map((c) => `【${c.title}】\n${c.content}`).join('\n\n---\n\n')
    const injected = `以下是我从《${novel.title}》中挑选的章节原文，请据此编排一场《游戏王》决斗剧情。
要求：
- 先判断原文里哪几段适合改写成决斗，再只编排这些段落；
- 把角色与冲突改写为决斗双方的动作与台词，按回合与阶段拆分为可执行步骤；
- 保留原文关键设定与人物性格，不要照抄原文叙述句式；
- 同时给出开局盘面（双方 LP、场上卡片与表示形式、手牌），以便直接摆到决斗场上。

以下是所选章节原文：

${materials}`

    await sendMessage(
      `请根据《${novel.title}》的这几章内容，编排一场决斗剧情（共 ${picked.length} 章、约 ${total} 字）。`,
      undefined,
      injected
    )
    flash(`已把 ${picked.length} 章原文交给背后灵`)
    onSent?.(picked.length)
  }

  const filtered = novels.filter((n) =>
    search.trim() ? n.title.toLowerCase().includes(search.trim().toLowerCase()) : true
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col !p-0 !bg-card !text-card-foreground !max-w-2xl border border-border rounded-xl shadow-2xl w-full max-h-[80vh] overflow-hidden select-none"
      >
        <DialogHeader className="!flex !flex-row items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 space-y-0">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-bold text-sm">从小说提取对局</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              导入原文、挑选章节交给背后灵，编排完成并存入对局档案
            </DialogDescription>
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

        <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索已导入的小说"
              className="h-7 pl-2.5 text-[11px] bg-muted/40"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleImport()}
            disabled={busy}
            className="h-7 text-[11px] gap-1.5 shrink-0"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            <span>导入小说</span>
          </Button>
        </div>

        {error && (
          <div className="px-4 py-1.5 bg-destructive/10 border-b border-destructive/30 text-destructive text-[11px] shrink-0">
            {error}
          </div>
        )}
        {feedback && (
          <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-500 text-[11px] shrink-0">
            {feedback}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[11px] font-semibold text-foreground">
                  {search ? '没有匹配的小说' : '还没有导入小说'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed px-6">
                  {search
                    ? '换个关键词试试'
                    : '支持 txt / md / epub。导入后按章节拆分，勾选需要的章节交给背后灵改写成决斗。'}
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const chapters = expanded[item.id]
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border/70 bg-background/40 p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleChapters(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1">
                          {chapters ? (
                            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-4 text-[10px] text-muted-foreground">
                          <span className="font-mono">
                            {(item.wordCount || 0).toLocaleString()} 字
                          </span>
                          {item.chapterCount !== undefined && (
                            <span className="font-mono">{item.chapterCount} 章</span>
                          )}
                        </div>
                      </button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(e, item)}
                              className={cn(
                                'p-1 rounded transition-colors cursor-pointer shrink-0',
                                'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                              )}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          }
                        />
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </div>

                    {chapters && (
                      <ChapterPicker
                        chapters={chapters}
                        busy={isGenerating}
                        onSend={(picked) => void handleSend(item, picked)}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

interface ChapterPickerProps {
  chapters: NovelChapter[]
  busy: boolean
  onSend: (picked: NovelChapter[]) => void
}

/**
 * 章节勾选列表
 *
 * 默认全选：多数情况导入就是想整本编排，逐个勾反而是负担。
 * 切章节集时靠「渲染期比对 key 调整 state」重置选中，不用 useEffect 同步
 * setState —— 那会触发一次多余渲染，且 chapters 每次渲染都是新数组。
 */
function ChapterPicker({ chapters, busy, onSend }: ChapterPickerProps): React.JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(chapters.map((c) => c.id)))
  const chapterKey = chapters.map((c) => c.id).join(',')
  const [lastChapterKey, setLastChapterKey] = useState(chapterKey)
  if (chapterKey !== lastChapterKey) {
    setLastChapterKey(chapterKey)
    setPicked(new Set(chapters.map((c) => c.id)))
  }

  if (chapters.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground mt-2 pl-4">
        未能从该文件拆出章节，可能是格式不受支持。
      </p>
    )
  }

  const toggle = (id: string): void => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-2 pl-4">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <button
          type="button"
          onClick={() =>
            setPicked((prev) =>
              prev.size === chapters.length ? new Set() : new Set(chapters.map((c) => c.id))
            )
          }
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          {picked.size === chapters.length ? '全不选' : '全选'}
        </button>
        <span className="font-mono">
          已选 {picked.size}/{chapters.length}
        </span>
      </div>

      <ScrollArea className="max-h-52 mt-1">
        <div className="space-y-0.5 pr-1">
          {chapters.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
            >
              <Checkbox
                checked={picked.has(c.id)}
                onCheckedChange={() => toggle(c.id)}
                className="w-3 h-3 shrink-0"
              />
              <span className="truncate flex-1">{c.title}</span>
              <span className="font-mono opacity-70 shrink-0">
                {(c.wordCount || 0).toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>

      <Button
        size="xs"
        onClick={() => onSend(chapters.filter((c) => picked.has(c.id)))}
        disabled={picked.size === 0 || busy}
        className="w-full h-6 mt-1.5 text-[10px] gap-1"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        <span>{busy ? '编排中' : `把所选 ${picked.size} 章交给背后灵编排`}</span>
      </Button>
    </div>
  )
}
