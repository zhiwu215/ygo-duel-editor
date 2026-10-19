import React from 'react'
import {
  Layers,
  Copy,
  Trash2,
  ExternalLink,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Inbox,
  Library,
  Pencil,
  FolderInput
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import { DuelProjectMeta, DuelSourceRef } from '@shared/index'
import { cn } from '../../lib/utils'
import { formatArchiveDate, UNFILED_KEY, type SeriesGroup } from '../../utils/archiveGrouping'

interface DuelArchiveGroupListProps {
  groups: SeriesGroup[]
  collapsed: Set<string>
  onToggleGroup: (key: string) => void
  lastLoadedPath: string | null
  currentTitle: string
  onLoadProject: (item: DuelProjectMeta) => void
  onDuplicate: (e: React.MouseEvent, item: DuelProjectMeta) => void
  onReveal: (e: React.MouseEvent, item: DuelProjectMeta) => void
  onDelete: (e: React.MouseEvent, item: DuelProjectMeta) => void
  onDeleteSeries: (group: SeriesGroup) => void
  onRenameSeries: (oldName: string) => void
  onPickSeries: (filePath: string, rect: DOMRect) => void
  onOpenSource: (sourceRef: DuelSourceRef | null) => void
}

export const DuelArchiveGroupList: React.FC<DuelArchiveGroupListProps> = ({
  groups,
  collapsed,
  onToggleGroup,
  lastLoadedPath,
  currentTitle,
  onLoadProject,
  onDuplicate,
  onReveal,
  onDelete,
  onDeleteSeries,
  onRenameSeries,
  onPickSeries,
  onOpenSource
}) => {
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
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
                  onClick={() => onToggleGroup(group.key)}
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
                                onRenameSeries(group.key)
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
                                void onDeleteSeries(group)
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
                          lastLoadedPath === item.filePath || currentTitle === item.title
                        return (
                          <div
                            key={item.filePath}
                            onClick={() => onLoadProject(item)}
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
                                        onClick={(e) => onReveal(e, item)}
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
                                          onPickSeries(
                                            item.filePath,
                                            e.currentTarget.getBoundingClientRect()
                                          )
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
                                        onClick={(e) => onDuplicate(e, item)}
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
                                        onClick={(e) => onDelete(e, item)}
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

                            {item.sourceRef && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpenSource(item.sourceRef ?? null)
                                }}
                                className={cn(
                                  'mt-1.5 w-full flex items-center gap-1.5 text-left px-1.5 py-1 rounded border transition-colors',
                                  'bg-violet-500/8 border-violet-500/25 hover:border-violet-500/50 hover:bg-violet-500/10'
                                )}
                              >
                                <BookOpen className="w-3 h-3 text-violet-500 shrink-0" />
                                <span className="text-[10px] text-violet-600 dark:text-violet-300 truncate flex-1">
                                  《{item.sourceRef.textTitle || '未命名文本'}》
                                </span>
                                <span className="text-[9px] font-mono text-violet-500/70 shrink-0">
                                  {item.sourceRef.chapterIds.length} 章
                                </span>
                              </button>
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
                                <span>{formatArchiveDate(item.updatedAt)}</span>
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
  )
}
