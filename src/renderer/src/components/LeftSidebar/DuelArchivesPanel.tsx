import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Layers, Copy, Trash2, ExternalLink, Clock, Check } from 'lucide-react'
import { DuelProjectMeta, DuelType } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

type FilterType = 'all' | DuelType

const FILTER_TABS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'full', label: '整局' },
  { value: 'puzzle', label: '残局' },
  { value: 'combo', label: 'Combo' }
]

export const DuelArchivesPanel: React.FC = () => {
  const { loadProjectAndStart, state: currentState } = useDuelStore()
  const { config, selectProjectsDir } = useConfigStore()

  const [projects, setProjects] = useState<DuelProjectMeta[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [lastLoadedPath, setLastLoadedPath] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // 获取档案列表 (用于刷新按钮)
  const fetchProjects = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getProjectList()
      setProjects(list)
    } catch (err) {
      console.error('[DuelArchives] Fetch projects failed:', err)
    }
  }, [])

  // 初始加载档案
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

  // 打开工程存储文件夹
  const handleOpenFolder = async (): Promise<void> => {
    await window.api.openProjectsDirectory()
  }

  // 更换工程存储目录
  const handleSelectDir = async (): Promise<void> => {
    const dir = await selectProjectsDir()
    if (dir) {
      await fetchProjects()
      setFeedbackMessage(`已切换存储目录: ${dir}`)
      setTimeout(() => setFeedbackMessage(null), 3000)
    }
  }

  // 点击载入对局，自动布置到场上并从第 1 回合开始
  const handleLoadProject = async (item: DuelProjectMeta): Promise<void> => {
    try {
      const res = await window.api.loadProjectByPath(item.filePath)
      if (res.success && res.state) {
        loadProjectAndStart(res.state)
        setLastLoadedPath(item.filePath)
        setFeedbackMessage(`已载入《${item.title}》，已就绪于第 1 回合`)
        setTimeout(() => setFeedbackMessage(null), 3500)
      } else if (res.error) {
        alert(`载入失败: ${res.error}`)
      }
    } catch (err) {
      console.error('[DuelArchives] Load project failed:', err)
      alert('载入工程档案失败')
    }
  }

  // 复制副本
  const handleDuplicate = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    const res = await window.api.duplicateProjectFile(item.filePath)
    if (res.success) {
      void fetchProjects()
    } else if (res.error) {
      alert(`创建副本失败: ${res.error}`)
    }
  }

  // 在系统资源管理器中高亮
  const handleReveal = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    await window.api.revealFileInFolder(item.filePath)
  }

  // 删除档案
  const handleDelete = async (e: React.MouseEvent, item: DuelProjectMeta): Promise<void> => {
    e.stopPropagation()
    if (confirm(`确认删除对局档案《${item.title}》？\n此操作将从磁盘彻底移除该文件。`)) {
      const res = await window.api.deleteProjectFile(item.filePath)
      if (res.success) {
        if (lastLoadedPath === item.filePath) {
          setLastLoadedPath(null)
        }
        void fetchProjects()
      } else if (res.error) {
        alert(`删除失败: ${res.error}`)
      }
    }
  }

  // 格式化时间戳
  const formatDate = (ts: number): string => {
    if (!ts) return ''
    const d = new Date(ts)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  }

  // 过滤后的工程列表
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. 类型过滤
      if (activeFilter !== 'all' && p.duelType !== activeFilter) {
        return false
      }
      // 2. 关键词过滤 (标题与注释)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchTitle = (p.title || '').toLowerCase().includes(query)
        const matchHint = (p.hint || '').toLowerCase().includes(query)
        if (!matchTitle && !matchHint) return false
      }
      return true
    })
  }, [projects, activeFilter, searchQuery])

  return (
    <div className="h-full flex flex-col bg-background/50 select-none overflow-hidden">
      {/* 顶部标题栏与快捷动作 */}
      <div className="h-10 px-3 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground tracking-wide">决斗档案</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
            {projects.length}
          </span>
        </div>
      </div>

      {/* 筛选切换 (全部 / 整局 / 残局 / Combo) */}
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

        {/* 搜索框 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="支持搜索名称或注释"
            className="h-7 pl-7 pr-2 text-xs bg-background/60"
          />
        </div>
      </div>

      {/* 载入成功动态浮层提示 */}
      {feedbackMessage && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{feedbackMessage}</span>
        </div>
      )}

      {/* 对局档案列表区域 */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {filteredProjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            <Layers className="w-8 h-8 stroke-1 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">暂无匹配的对局档案</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[200px] leading-relaxed">
              在右侧决斗盘摆好卡片后，按 Ctrl+S 保存即可在此处集中查看与复现
            </p>
          </div>
        ) : (
          filteredProjects.map((item) => {
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
                {/* 顶部：分类 Badge + 标题 */}
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

                  {/* 悬停快捷动作按钮组 */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleReveal(e, item)}
                      title="在文件资源管理器中定位"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(e, item)}
                      title="创建档案副本"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item)}
                      title="删除此档案"
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 战术要点 / 剧情注释摘要 (hint) */}
                {item.hint && item.hint.trim() && (
                  <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-relaxed mt-1.5 font-normal">
                    {item.hint.trim()}
                  </p>
                )}

                {/* 底部元数据栏 */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/75 mt-2 pt-1.5 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">MR{item.masterRule}</span>
                    {item.stepCount && item.stepCount > 0 ? <span>{item.stepCount} 步</span> : null}
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

      {/* 底部存储目录显示与更换 */}
      <div className="p-2 border-t border-border/60 bg-muted/20 shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
          <span
            className="truncate max-w-[190px]"
            title={
              config.projectsDirectory
                ? `当前存储目录: ${config.projectsDirectory}`
                : '默认保存在系统 AppData 目录'
            }
          >
            目录: {config.projectsDirectory || '默认 (AppData)'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSelectDir}
              className="text-primary hover:underline font-medium cursor-pointer"
              title="更换保存目录"
            >
              更换目录
            </button>
            <span className="text-muted-foreground/40">|</span>
            <button
              type="button"
              onClick={handleOpenFolder}
              className="text-muted-foreground hover:text-foreground underline cursor-pointer"
              title="在系统资源管理器中打开此文件夹"
            >
              打开
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
