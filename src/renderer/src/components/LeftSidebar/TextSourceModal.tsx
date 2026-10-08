import React, { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { TextChapter, TextMeta } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { LibraryGrid } from '../TextLibrary/LibraryGrid'

interface TextSourceModalProps {
  onClose: () => void
  /** 已交给 AI 后回调，用于让宿主刷新状态或切换到背后灵 */
  onSent?: (chapterCount: number) => void
}

export const TextSourceModal: React.FC<TextSourceModalProps> = ({ onClose, onSent }) => {
  const { sendMessage, isGenerating } = useAgentStore()
  const { setSeries } = useDuelStore()

  const [texts, setTexts] = useState<TextMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<TextMeta | null>(null)
  const [chapters, setChapters] = useState<TextChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const flash = useCallback((msg: string): void => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const fetchTexts = useCallback(async (): Promise<void> => {
    try {
      setTexts(await window.api.getTextList())
    } catch (err) {
      console.error('[TextSourceModal] 获取小说列表失败:', err)
      setError('读取小说列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api
      .getTextList()
      .then((list) => {
        if (!cancelled) setTexts(list)
      })
      .catch((err) => {
        console.error('[TextSourceModal] 初始获取小说列表失败:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleImport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.importTextFile()
      if (res.canceled) return
      if (res.success && res.text) {
        await fetchTexts()
        flash(`已导入《${res.text.title}》`)
      } else {
        setError(res.error || '导入失败')
      }
    } catch (err) {
      console.error('[TextSourceModal] 导入文本失败:', err)
      setError('导入失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (item: TextMeta): Promise<void> => {
    const ok = await confirmDialog({
      title: `删除《${item.title}》`,
      description: '原文与拆分结果都会移除。',
      confirmText: '删除'
    })
    if (!ok) return
    const res = await window.api.deleteText(item.id)
    if (!res.success) {
      flash(res.error || '删除失败')
      return
    }
    if (selectedText?.id === item.id) setSelectedText(null)
    await fetchTexts()
    flash('已删除')
  }

  const handleResplit = async (text: TextMeta): Promise<void> => {
    const res = await window.api.resplitText(text.id)
    if (!res.success) {
      flash(res.error || '重新拆分失败')
      return
    }
    await fetchTexts()
    if (selectedText?.id === text.id) {
      setSelectedText(res.text ?? null)
      setChapters([])
    }
    flash(`《${text.title}》已重新拆分为 ${res.text?.chapterCount ?? 0} 章`)
  }

  const handleOpenText = async (text: TextMeta): Promise<void> => {
    setSelectedText(text)
    setChapters([])
    setChaptersLoading(true)
    try {
      setChapters(await window.api.getTextChapters(text.id))
    } catch (err) {
      console.error('[TextSourceModal] 章节读取失败:', err)
      flash('章节读取失败')
    } finally {
      setChaptersLoading(false)
    }
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
      console.warn('[TextSourceModal] 登记作品分类失败:', err)
    }
    setSeries(name)
  }

  const handleSend = async (text: TextMeta, pickedChapters: TextChapter[]): Promise<void> => {
    const picked = pickedChapters.filter((c) => c.content)
    if (picked.length === 0) {
      flash('所选章节没有正文内容')
      return
    }
    await registerSeries(text.title)
    const total = picked.reduce((sum, c) => sum + (c.content?.length || 0), 0)
    const materials = picked.map((c) => `【${c.title}】\n${c.content}`).join('\n\n---\n\n')
    const injected = `以下是我从《${text.title}》中挑选的章节原文，请据此编排一场《游戏王》决斗剧情。
要求：
- 先判断原文里哪几段适合改写成决斗，再只编排这些段落；
- 把角色与冲突改写为决斗双方的动作与台词，按回合与阶段拆分为可执行步骤；
- 保留原文关键设定与人物性格，不要照抄原文叙述句式；
- 同时给出开局盘面（双方 LP、场上卡片与表示形式、手牌），以便直接摆到决斗场上。

以下是所选章节原文：

${materials}`

    await sendMessage(
      `请根据《${text.title}》的这几章内容，编排一场决斗剧情（共 ${picked.length} 章、约 ${total} 字）。`,
      undefined,
      injected,
      undefined,
      {
        textId: text.id,
        title: text.title,
        wordCount: total,
        chapterIds: picked.map((c) => c.id)
      }
    )
    flash(`已把 ${picked.length} 章原文交给背后灵`)
    onSent?.(picked.length)
  }

  const filtered = texts.filter((n) =>
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
            <DialogTitle className="font-bold text-sm">
              {selectedText ? `挑选章节 · ${selectedText.title}` : '从文本提取对局'}
            </DialogTitle>
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
          {selectedText ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedText(null)}
              className="h-7 gap-1 text-[11px] shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>返回列表</span>
            </Button>
          ) : (
            <>
              <div className="relative flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索已导入的文本"
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
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span>导入文本</span>
              </Button>
            </>
          )}
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

        {selectedText ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
              {chaptersLoading ? (
                <div className="py-12 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : chapters.length === 0 ? (
                <p className="py-8 text-center text-[11px] text-muted-foreground">
                  未能从该文件拆出章节，可能是格式不受支持；可在素材库中重新拆分。
                </p>
              ) : (
                <ChapterPicker
                  chapters={chapters}
                  busy={isGenerating}
                  onSend={(picked) => void handleSend(selectedText, picked)}
                />
              )}
            </div>
          </ScrollArea>
        ) : (
          <LibraryGrid
            texts={filtered}
            loading={loading}
            search={search}
            onOpen={(text) => void handleOpenText(text)}
            onDelete={(text) => void handleDelete(text)}
            onResplit={(text) => void handleResplit(text)}
            onImport={() => void handleImport()}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ChapterPickerProps {
  chapters: TextChapter[]
  busy: boolean
  onSend: (picked: TextChapter[]) => void
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
