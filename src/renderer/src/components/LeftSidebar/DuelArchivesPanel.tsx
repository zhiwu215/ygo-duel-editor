import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  Layers,
  Copy,
  Trash2,
  ExternalLink,
  Clock,
  Check,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  Library,
  Pencil,
  FolderInput
} from 'lucide-react'
import { DuelProjectMeta, DuelType } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { Input } from '../ui/input'
import { TextSourceModal } from './TextSourceModal'
import { SeriesPicker } from './SeriesPicker'
import { SeriesNameDialog } from './SeriesNameDialog'
import { confirmDialog, alertDialog } from '../../stores/useDialogStore'
import { cn } from '../../lib/utils'

type FilterType = 'all' | DuelType

const FILTER_TABS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'full', label: '整局' },
  { value: 'puzzle', label: '残局' },
  { value: 'combo', label: 'Combo' }
]

/** 未归类分组的 key，用空字符串表示 */
const UNFILED_KEY = ''

interface SeriesGroup {
  key: string
  label: string
  items: DuelProjectMeta[]
}

export const DuelArchivesPanel: React.FC = () => {
  const { loadProjectAndStart, setCurrentProjectPath, state: currentState } = useDuelStore()
  const { config, loadConfig } = useConfigStore()

  const [projects, setProjects] = useState<DuelProjectMeta[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [lastLoadedPath, setLastLoadedPath] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [showTextModal, setShowTextModal] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [pickerTarget, setPickerTarget] = useState<{ filePath: string; rect: DOMRect } | null>(null)
  const [nameDialog, setNameDialog] = useState<
    { mode: 'create' } | { mode: 'rename'; oldName: string } | null
  >(null)

  const flash = useCallback((msg: string): void => {
    setFeedbackMessage(msg)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const fetchProjects = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getProjectList()
      setProjects(list)
    } catch (err) {
      console.error('[DuelArchives] Fetch projects failed:', err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api
      .getProjectList()
      .then((list) => {
        if (!cancelled) {
          setProjects(list)
        }
      })
      .catch((err) => {
        console.error('[DuelArchives] Initial fetch failed:', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleLoadProject = async (item: DuelProjectMeta): Promise<void> => {
    try {
      const res = await window.api.loadProjectByPath(item.filePath)
      if (res.success && res.state) {
        loadProjectAndStart(res.state)
        setCurrentProjectPath(item.filePath)
        setLastLoadedPath(item.filePath)
        flash(`已载入《${item.title}》，已就绪于第 1 回合`)
      } else if (res.error) {
        void alertDialog(`载入失败: ${res.error}`)
      }
    } catch (err) {
      console.error('[DuelArchives] Load project failed:', err)
      void alertDialog('载入工程档案失败')
    }
  }

  const handleDuplicate = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    const res = await window.api.duplicateProjectFile(item.filePath)
    if (res.success) {
      void fetchProjects()
    } else if (res.error) {
      void alertDialog(`创建副本失败: ${res.error}`)
    }
  }

  const handleReveal = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    await window.api.revealFileInFolder(item.filePath)
  }

  const handleDelete = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    const ok = await confirmDialog({
      title: `删除对局档案《${item.title}》`,
      description: '此操作将从磁盘彻底移除该文件。',
      confirmText: '删除'
    })
    if (ok) {
      const res = await window.api.deleteProjectFile(item.filePath)
      if (res.success) {
        if (lastLoadedPath === item.filePath) {
          setLastLoadedPath(null)
        }
        void fetchProjects()
      } else if (res.error) {
        void alertDialog(`删除失败: ${res.error}`)
      }
    }
  }

  const handleCreateSeries = async (name: string): Promise<string | null> => {
    const res = await window.api.createProjectSeries(name)
    if (!res.success) return res.error || '新建分类失败'
    await loadConfig()
    flash(`已新建作品分类「${name.trim()}」`)
    return null
  }

  const handleRenameSeries = async (oldName: string, name: string): Promise<string | null> => {
    const res = await window.api.renameProjectSeries(oldName, name)
    if (!res.success) return res.error || '重命名失败'
    await loadConfig()
    await fetchProjects()
    flash(`已重命名为「${name.trim()}」`)
    return null
  }

  const handleDeleteSeries = async (group: SeriesGroup): Promise<void> => {
    const ok = await confirmDialog({
      title: `删除分类「${group.label}」`,
      description:
        group.items.length > 0
          ? `该分类下的 ${group.items.length} 场对局会退回「未归类」，文件不会被删除。`
          : '该分类下没有对局，可以安全删除。',
      confirmText: '删除'
    })
    if (!ok) return
    const res = await window.api.deleteProjectSeries(group.key)
    if (!res.success) {
      void alertDialog(`删除分类失败: ${res.error || '未知错误'}`)
      return
    }
    await loadConfig()
    await fetchProjects()
    flash(`已删除分类「${group.label}」`)
  }

  const handlePickSeries = async (filePath: string, series: string | null): Promise<void> => {
    setPickerTarget(null)
    const res = await window.api.setProjectSeries(filePath, series)
    if (!res.success) {
      void alertDialog(`归类失败: ${res.error || '未知错误'}`)
      return
    }
    await loadConfig()
    await fetchProjects()
    flash(series ? `已归入「${series}」` : '已移出分类')
  }

  /** 配置里登记过的分类 ∪ 档案实际用到的分类，避免孤儿分类消失 */
  const seriesNames = useMemo(() => {
    const names = new Set<string>()
    for (const name of config.projectSeries || []) {
      if (name && name.trim()) names.add(name.trim())
    }
    for (const p of projects) {
      if (p.series && p.series.trim()) names.add(p.series.trim())
    }
    return Array.from(names)
  }, [config.projectSeries, projects])

  const groups = useMemo<SeriesGroup[]>(() => {
    const query = searchQuery.trim().toLowerCase()
    const matched = projects.filter((p) => {
      if (activeFilter !== 'all' && p.duelType !== activeFilter) return false
      if (!query) return true
      return (
        (p.title || '').toLowerCase().includes(query) ||
        (p.hint || '').toLowerCase().includes(query) ||
        (p.series || '').toLowerCase().includes(query)
      )
    })

    const bySeries = new Map<string, DuelProjectMeta[]>()
    for (const p of matched) {
      const key = (p.series || '').trim()
      const bucket = bySeries.get(key)
      if (bucket) bucket.push(p)
      else bySeries.set(key, [p])
    }

    const result: SeriesGroup[] = []
    for (const name of seriesNames) {
      const items = bySeries.get(name)
      // 搜索状态下隐藏没命中的分类，避免空分组刷屏
      if (!items && query) continue
      result.push({ key: name, label: name, items: items || [] })
    }

    const unfiled = bySeries.get(UNFILED_KEY)
    if (unfiled || !query) {
      result.push({ key: UNFILED_KEY, label: '未归类', items: unfiled || [] })
    }
    return result
  }, [projects, seriesNames, activeFilter, searchQuery])

  const toggleGroup = (key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatDate = (ts: number): string => {
    if (!ts) return ''
    const d = new Date(ts)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  }

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div className="h-full flex flex-col bg-background/50 select-none overflow-hidden">
      <div className="h-10 px-3 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/20">
        <span className="text-xs font-semibold text-foreground tracking-wide">决斗档案</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setShowTextModal(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>提取对局</span>
              </button>
            }
          />
          <TooltipContent>从文本（txt / md / epub）提取对局</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setNameDialog({ mode: 'create' })}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>分类</span>
              </button>
            }
          />
          <TooltipContent>新建分类</TooltipContent>
        </Tooltip>
      </div>

      <div className="p-2 border-b border-border/60 flex flex-col gap-2 shrink-0 bg-card/30">
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-muted/60 rounded-md border border-border/60">
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  'py-1 rounded text-[11px] font-medium transition-colors text-center',
                  isSelected
                    ? 'bg-background text-foreground shadow-xs font-semibold border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索名称、注释或作品分类"
            className="h-7 pl-7 pr-2 text-xs bg-background/60"
          />
        </div>
      </div>

      {feedbackMessage && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{feedbackMessage}</span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-1.5">
          {totalCount === 0 && groups.every((g) => g.items.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <Layers className="w-8 h-8 stroke-1 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium">暂无匹配的对局档案</p>
            </div>
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsed.has(group.key)
              const isUnfiled = group.key === UNFILED_KEY
              return (
                <div key={group.key} className="flex flex-col">
                  <div
                    onClick={() => toggleGroup(group.key)}
                    className="group/series flex items-center gap-1.5 px-1.5 py-1.5 rounded-md cursor-pointer hover:bg-muted/60 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    {isUnfiled ? (
                      <Inbox className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                    ) : (
                      <Library className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                    )}
                    <span
                      className={cn(
                        'text-[11px] font-semibold truncate flex-1',
                        isUnfiled ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {group.label}
                    </span>

                    {!isUnfiled && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/series:opacity-100 transition-opacity shrink-0">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setNameDialog({ mode: 'rename', oldName: group.key })
                                }}
                                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            }
                          />
                          <TooltipContent>重命名分类</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleDeleteSeries(group)
                                }}
                                className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            }
                          />
                          <TooltipContent>删除分类</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-1 pl-2 ml-2 border-l border-border/60">
                      {group.items.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/70 py-1 pl-1">
                          该分类下还没有对局
                        </p>
                      ) : (
                        group.items.map((item) => {
                          const isCurrentlyLoaded =
                            lastLoadedPath === item.filePath || currentState.title === item.title
                          return (
                            <div
                              key={item.filePath}
                              onClick={() => handleLoadProject(item)}
                              className={cn(
                                'group relative flex flex-col p-2.5 rounded-lg border transition-all cursor-pointer text-left',
                                isCurrentlyLoaded
                                  ? 'bg-accent/40 border-primary/40 shadow-xs'
                                  : 'bg-card/60 hover:bg-muted/50 border-border/70 hover:border-border'
                              )}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-wider shrink-0 border select-none',
                                      item.duelType === 'combo'
                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                        : item.duelType === 'puzzle'
                                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                          : 'bg-muted text-muted-foreground border-border/80'
                                    )}
                                  >
                                    {item.duelType === 'combo'
                                      ? 'COMBO'
                                      : item.duelType === 'puzzle'
                                        ? '残局'
                                        : '整局'}
                                  </span>
                                  <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {item.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={(e) => handleReveal(e, item)}
                                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                                    <TooltipContent>在文件资源管理器中定位</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setPickerTarget({
                                              filePath: item.filePath,
                                              rect: e.currentTarget.getBoundingClientRect()
                                            })
                                          }}

                                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                          <FolderInput className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                                    <TooltipContent>归入作品分类</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={(e) => handleDuplicate(e, item)}
                                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                                    <TooltipContent>创建档案副本</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={(e) => handleDelete(e, item)}
                                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      }
                                    />
                                    <TooltipContent>删除此档案</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>

                              {item.hint && item.hint.trim() && (
                                <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-relaxed mt-1.5 font-normal">
                                  {item.hint.trim()}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground/75 mt-2 pt-1.5 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">MR{item.masterRule}</span>
                                  {item.stepCount && item.stepCount > 0 ? (
                                    <span>{item.stepCount} 步</span>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-1 font-mono text-[9.5px]">
                                  <Clock className="w-2.5 h-2.5 opacity-70" />
                                  <span>{formatDate(item.updatedAt)}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {pickerTarget && (
        <SeriesPicker
          anchor={pickerTarget.rect}
          seriesList={seriesNames}
          current={projects.find((p) => p.filePath === pickerTarget.filePath)?.series || ''}
          onPick={(series) => void handlePickSeries(pickerTarget.filePath, series)}
          onCreate={handleCreateSeries}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {nameDialog?.mode === 'create' && (
        <SeriesNameDialog
          title="新建分类"
          confirmLabel="创建"
          onConfirm={handleCreateSeries}
          onClose={() => setNameDialog(null)}
        />
      )}

      {nameDialog?.mode === 'rename' && (
        <SeriesNameDialog
          title="重命名作品分类"
          placeholder={nameDialog.oldName}
          confirmLabel="重命名"
          initialValue={nameDialog.oldName}
          onConfirm={(name) => handleRenameSeries(nameDialog.oldName, name)}
          onClose={() => setNameDialog(null)}
        />
      )}

      {showTextModal && (
        <TextSourceModal onClose={() => setShowTextModal(false)} onSent={() => {}} />
      )}

    </div>
  )
}
