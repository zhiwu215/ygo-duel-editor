import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react'
import { DuelStep, NovelChapter, NovelMeta, ScreenplayMeta } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

type LibraryTab = 'screenplays' | 'novels'

/**
 * 创作资源库面板
 *
 * 与「决斗档案」的区别：档案管理的是**整局工程**（盘面 + 步骤，随工程文件走），
 * 资源库管的是**创作素材**：
 * - 台本：脱离工程的剧情编排，攒灵感用，可随时套到当前盘面上
 * - 小说资料：导入网文并按章节拆分，挑章节喂给背后灵编排决斗剧情
 */
export const LibraryPanel: React.FC = () => {
  const { addStep } = useDuelStore()
  const { sendMessage, isGenerating } = useAgentStore()

  const [tab, setTab] = useState<LibraryTab>('screenplays')
  const [screenplays, setScreenplays] = useState<ScreenplayMeta[]>([])
  const [novels, setNovels] = useState<NovelMeta[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  /** 展开的章节列表：novelId -> 章节数组 */
  const [expanded, setExpanded] = useState<Record<string, NovelChapter[]>>({})
  const [newTitle, setNewTitle] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  /** 新建台本输入区：用于判断点击是否落在外部 */
  const newInputWrapRef = useRef<HTMLDivElement>(null)

  const flash = useCallback((msg: string): void => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const fetchAll = useCallback(async (): Promise<void> => {
    try {
      const [s, n] = await Promise.all([
        window.api.getScreenplayList(),
        window.api.getNovelList()
      ])
      setScreenplays(s)
      setNovels(n)
    } catch (err) {
      console.error('[LibraryPanel] fetch failed:', err)
    }
  }, [])

  // 初始加载：与决斗档案面板一致，用 cancelled 标志避免面板卸载后仍写 state
  useEffect(() => {
    let cancelled = false
    Promise.all([window.api.getScreenplayList(), window.api.getNovelList()])
      .then(([s, n]) => {
        if (cancelled) return
        setScreenplays(s)
        setNovels(n)
      })
      .catch((err) => {
        console.error('[LibraryPanel] initial fetch failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 新建台本输入态：点击面板内空白处收起（与右键菜单同一套window 级 mousedown 模式）
  useEffect(() => {
    if (!showNewInput) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (newInputWrapRef.current?.contains(e.target as Node)) return
      setShowNewInput(false)
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [showNewInput])

  const filteredScreenplays = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return screenplays
    return screenplays.filter(
      (s) =>
        s.title.toLowerCase().includes(kw) ||
        s.synopsis?.toLowerCase().includes(kw) ||
        s.tags?.some((t) => t.toLowerCase().includes(kw))
    )
  }, [screenplays, search])

  const filteredNovels = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return novels
    return novels.filter(
      (n) => n.title.toLowerCase().includes(kw) || n.author?.toLowerCase().includes(kw)
    )
  }, [novels, search])

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim()
    if (!title) return
    setBusy(true)
    const res = await window.api.createScreenplay(title)
    setBusy(false)
    if (res.success) {
      setShowNewInput(false)
      setNewTitle('')
      await fetchAll()
      flash(`已创建台本《${title}》`)
    } else {
      flash(res.error || '创建失败')
    }
  }

  /** 把台本步骤套到当前盘面：追加到现有步骤之后，不清空已有编排 */
  const handleApply = async (item: ScreenplayMeta): Promise<void> => {
    const res = (await window.api.applyScreenplayToDuel(item.id)) as {
      success: boolean
      error?: string
      steps?: DuelStep[]
    }
    if (!res.success) {
      flash(res.error || '载入台本失败')
      return
    }
    if (!res.steps || res.steps.length === 0) {
      flash(`台本《${item.title}》还没有步骤`)
      return
    }
    // 台本存的是完整 DuelStep（自带 id），这里让 store 重新生成 id，避免主键冲突
    for (const step of res.steps) {
      addStep({ ...step, id: undefined } as Omit<DuelStep, 'id'>)
    }
    flash(`已把《${item.title}》的 ${res.steps.length} 个步骤追加到当前编排`)
  }

  const handleDuplicate = async (e: React.MouseEvent, item: ScreenplayMeta): Promise<void> => {
    e.stopPropagation()
    const res = await window.api.duplicateScreenplay(item.id)
    await fetchAll()
    flash(res.success ? '已创建副本' : res.error || '复制失败')
  }

  const handleDelete = async (e: React.MouseEvent, item: ScreenplayMeta): Promise<void> => {
    e.stopPropagation()
    if (!confirm(`确认删除台本《${item.title}》？\n此操作不可逆。`)) return
    const res = await window.api.deleteScreenplay(item.id)
    await fetchAll()
    flash(res.success ? '已删除' : res.error || '删除失败')
  }

  const handleImportNovel = async (): Promise<void> => {
    setBusy(true)
    const res = await window.api.importNovelFile()
    setBusy(false)
    if (res.success && res.novel) {
      await fetchAll()
      flash(`已导入《${res.novel.title}》，拆出 ${res.novel.chapterCount ?? 0} 章`)
    } else if (res.error) {
      flash(res.error)
    }
  }

  const handleDeleteNovel = async (e: React.MouseEvent, item: NovelMeta): Promise<void> => {
    e.stopPropagation()
    if (!confirm(`确认删除资料《${item.title}》？\n原文与拆分结果都会移除。`)) return
    const res = await window.api.deleteNovel(item.id)
    await fetchAll()
    setExpanded((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    flash(res.success ? '已删除' : res.error || '删除失败')
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

  /** 把选中章节正文发给背后灵，作为决斗剧情编排的素材 */
  const handleSendToAgent = async (
    novel: NovelMeta,
    chapters: NovelChapter[]
  ): Promise<void> => {
    const picked = chapters.filter((c) => c.content)
    if (picked.length === 0) {
      flash('所选章节没有正文内容')
      return
    }
    const total = picked.reduce((sum, c) => sum + (c.content?.length || 0), 0)
    // 拼进来的正文只进模型输入，不进对话记录（sendMessage 已支持双参数隔离）
    const materials = picked.map((c) => `【${c.title}】\n${c.content}`).join('\n\n---\n\n')
    const injected = `以下是我从《${novel.title}》中挑选的章节原文，请据此编排一场《游戏王》决斗剧情台本。
要求：把原文中的角色与冲突改写为决斗双方的动作与台词，按回合与阶段拆分为可执行的步骤；保留原文关键设定与人物性格；不要照抄原文叙述句式。

${materials}`
    await sendMessage(
      `请根据《${novel.title}》的这几章内容，编排一场决斗剧情台本（共 ${picked.length} 章、约 ${total} 字）。`,
      undefined,
      injected
    )
    flash(`已把 ${picked.length} 章正文交给背后灵`)
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background/40">
      <div className="h-9 px-3 flex items-center gap-0.5 border-b border-border shrink-0">
        <TabButton active={tab === 'screenplays'} onClick={() => setTab('screenplays')}>
          <span>台本</span>
        </TabButton>
        <TabButton active={tab === 'novels'} onClick={() => setTab('novels')}>
          <span>小说资料</span>
        </TabButton>
        {feedback && (
          <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[45%]">
            {feedback}
          </span>
        )}
      </div>

      <div className="px-3 py-2 border-b border-border/60 shrink-0">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'screenplays' ? '搜索台本标题或标签' : '搜索小说资料'}
            className="h-7 pl-7 text-[11px] bg-muted/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
        {tab === 'screenplays' ? (
          <>
            {/* 触发按钮与输入区同属一个 ref 容器：点按钮本身走 onClick 切换，
                点容器外空白才走 window 级 mousedown 收起，两者不会互相打架 */}
            <div ref={newInputWrapRef} className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewInput((v) => !v)}
                className="w-full h-7 text-[11px] gap-1.5 border-dashed"
              >
                <Plus className="w-3 h-3" />
                <span>新建台本</span>
              </Button>

              {showNewInput && (
                <div className="flex items-center gap-1.5 p-2 rounded-md border border-primary/40 bg-primary/5">
                  <Input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreate()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setShowNewInput(false)
                      }
                    }}
                    placeholder="台本标题，如「宿敌·觉醒」"
                    className="h-7 text-[11px]"
                  />
                  <Button size="xs" onClick={() => void handleCreate()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {filteredScreenplays.length === 0 ? (
              <EmptyHint
                text={search ? '没有匹配的台本' : '还没有台本'}
                sub={
                  search
                    ? '换个关键词试试'
                    : '把灵感攒成台本，之后再挑合适的卡组配盘面'
                }
              />
            ) : (
              filteredScreenplays.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-lg border border-border/70 bg-card/50 hover:border-primary/50 transition-colors p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </div>
                      {item.synopsis && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                          {item.synopsis}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-0.5 font-mono">
                          <FileText className="w-2.5 h-2.5" />
                          {item.stepCount} 步
                        </span>
                        {item.updatedAt > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(item.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                        {item.tags?.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-muted/70 px-1 py-px text-[9px] text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconAction title="创建副本" onClick={(e) => void handleDuplicate(e, item)}>
                        <Copy className="w-3 h-3" />
                      </IconAction>
                      <IconAction
                        title="删除台本"
                        danger
                        onClick={(e) => void handleDelete(e, item)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </IconAction>
                    </div>
                  </div>

                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void handleApply(item)}
                    disabled={item.stepCount === 0}
                    className="w-full h-6 mt-2 text-[10px] gap-1"
                    title={
                      item.stepCount === 0
                        ? '台本还没有步骤，先在决斗台本里编排并保存'
                        : '把台本步骤追加到当前决斗编排'
                    }
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>套用到当前编排</span>
                  </Button>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleImportNovel()}
              disabled={busy}
              className="w-full h-7 text-[11px] gap-1.5 border-dashed"
            >
              {busy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              <span>导入小说文件</span>
            </Button>

            {filteredNovels.length === 0 ? (
              <EmptyHint
                text={search ? '没有匹配的资料' : '还没有小说资料'}
                sub={search ? '换个关键词试试' : '导入 txt / md / epub，按章节拆分后挑给 AI 编排'}
              />
            ) : (
              filteredNovels.map((item) => {
                const chapters = expanded[item.id]
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border/70 bg-card/50 p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleChapters(item)}
                        className="min-w-0 flex-1 text-left group/title"
                      >
                        <div className="flex items-center gap-1">
                          {chapters ? (
                            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground truncate group-hover/title:text-primary transition-colors">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-4 text-[10px] text-muted-foreground">
                          <span className="font-mono">{(item.wordCount || 0).toLocaleString()} 字</span>
                          {item.chapterCount !== undefined && (
                            <span className="font-mono">{item.chapterCount} 章</span>
                          )}
                          <span className="rounded bg-emerald-500/15 px-1 py-px text-[9px] text-emerald-600 dark:text-emerald-400">
                            已拆分
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <IconAction
                          title="删除资料"
                          danger
                          onClick={(e) => void handleDeleteNovel(e, item)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </IconAction>
                      </div>
                    </div>

                    {chapters && (
                      <ChapterList
                        chapters={chapters}
                        onSend={(picked) => void handleSendToAgent(item, picked)}
                        busy={isGenerating}
                      />
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground font-bold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

interface IconActionProps {
  title: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  children: React.ReactNode
}

function IconAction({ title, onClick, danger, children }: IconActionProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1 rounded transition-colors cursor-pointer',
        danger
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  )
}

function EmptyHint({ text, sub }: { text: string; sub: string }): React.JSX.Element {
  return (
    <div className="py-10 text-center select-none">
      <p className="text-[11px] font-semibold text-foreground">{text}</p>
      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed px-4">{sub}</p>
    </div>
  )
}

interface ChapterListProps {
  chapters: NovelChapter[]
  onSend: (picked: NovelChapter[]) => void
  busy: boolean
}

/**
 * 章节列表（可勾选后整批交给 AI）
 *
 * 默认全选：多数情况用户导入就是想整本编排，逐个勾反而是负担。
 */
function ChapterList({ chapters, onSend, busy }: ChapterListProps): React.JSX.Element {
  // 选中集用 novelId 无关的「章节 id 集合」表达；切小说时靠 key 重挂载重置，
  // 不用 useEffect 同步 setState（那会触发级联渲染，且 chapters 每次渲染都是新数组）
  const [picked, setPicked] = useState<Set<string>>(() => new Set(chapters.map((c) => c.id)))
  const chapterKey = chapters.map((c) => c.id).join(',')
  /** 记录上次渲染的章节集合，变化时同步重置选中（渲染期调整 state 的官方推荐写法） */
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
    <div className="mt-2 pl-4 space-y-1">
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
        <span className="font-mono">已选 {picked.size}/{chapters.length}</span>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
        {chapters.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
          >
            <input
              type="checkbox"
              checked={picked.has(c.id)}
              onChange={() => toggle(c.id)}
              className="w-3 h-3 accent-primary shrink-0"
            />
            <span className="truncate flex-1">{c.title}</span>
            <span className="font-mono opacity-70 shrink-0">{(c.wordCount || 0).toLocaleString()}</span>
          </label>
        ))}
      </div>

      <Button
        size="xs"
        onClick={() => onSend(chapters.filter((c) => picked.has(c.id)))}
        disabled={picked.size === 0 || busy}
        className="w-full h-6 text-[10px] gap-1"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        <span>{busy ? '编排中' : `把所选 ${picked.size} 章交给 AI 编排`}</span>
      </Button>
    </div>
  )
}
