import React, { useMemo, useState } from 'react'
import { BookOpen, Check, FolderPlus, Search } from 'lucide-react'
import { DuelSourceRef } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { Input } from '../ui/input'
import { useDuelArchives } from '../../hooks/useDuelArchives'
import {
  buildArchiveGroups,
  buildSeriesNames,
  type ArchiveFilter
} from '../../utils/archiveGrouping'
import { TextSourceModal } from './TextSourceModal'
import { DuelSourceReaderDialog } from './DuelSourceReaderDialog'
import { SeriesPicker } from './SeriesPicker'
import { SeriesNameDialog } from './SeriesNameDialog'
import { cn } from '../../lib/utils'
import { DuelArchiveGroupList } from './DuelArchiveGroupList'

const FILTER_TABS: Array<{ value: ArchiveFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'full', label: '整局' },
  { value: 'puzzle', label: '残局' },
  { value: 'combo', label: 'Combo' }
]

export const DuelArchivesPanel: React.FC = () => {
  const {
    projects,
    lastLoadedPath,
    feedback,
    loadProject,
    duplicateProject,
    revealProject,
    deleteProject,
    createSeries,
    renameSeries,
    deleteSeries,
    pickSeries
  } = useDuelArchives()
  const currentState = useDuelStore((s) => s.state)
  const config = useConfigStore((s) => s.config)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<ArchiveFilter>('all')
  const [showTextModal, setShowTextModal] = useState(false)
  const [sourceViewer, setSourceViewer] = useState<DuelSourceRef | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [pickerTarget, setPickerTarget] = useState<{ filePath: string; rect: DOMRect } | null>(null)
  const [nameDialog, setNameDialog] = useState<
    { mode: 'create' } | { mode: 'rename'; oldName: string } | null
  >(null)

  const seriesNames = useMemo(
    () => buildSeriesNames(config.projectSeries, projects),
    [config.projectSeries, projects]
  )

  const groups = useMemo(
    () => buildArchiveGroups(projects, seriesNames, activeFilter, searchQuery),
    [projects, seriesNames, activeFilter, searchQuery]
  )

  const toggleGroup = (key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-background/50 select-none overflow-hidden">
      <div className="h-10 px-3 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/20">
        <span className="text-xs font-semibold text-foreground tracking-wide">决斗档案</span>
        <button
          type="button"
          onClick={() => setShowTextModal(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>提取对局</span>
        </button>
        <button
          type="button"
          onClick={() => setNameDialog({ mode: 'create' })}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>分类</span>
        </button>
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

      {feedback && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{feedback}</span>
        </div>
      )}

      <DuelArchiveGroupList
        groups={groups}
        collapsed={collapsed}
        onToggleGroup={toggleGroup}
        lastLoadedPath={lastLoadedPath}
        currentTitle={currentState.title}
        onLoadProject={(item) => void loadProject(item)}
        onDuplicate={(e, item) => void duplicateProject(e, item)}
        onReveal={(e, item) => void revealProject(e, item)}
        onDelete={(e, item) => void deleteProject(e, item)}
        onDeleteSeries={(group) => void deleteSeries(group)}
        onRenameSeries={(oldName) => setNameDialog({ mode: 'rename', oldName })}
        onPickSeries={(filePath, rect) => setPickerTarget({ filePath, rect })}
        onOpenSource={setSourceViewer}
      />

      {pickerTarget && (
        <SeriesPicker
          anchor={pickerTarget.rect}
          seriesList={seriesNames}
          current={projects.find((p) => p.filePath === pickerTarget.filePath)?.series || ''}
          onPick={(series) => {
            setPickerTarget(null)
            void pickSeries(pickerTarget.filePath, series)
          }}
          onCreate={createSeries}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {nameDialog?.mode === 'create' && (
        <SeriesNameDialog
          title="新建分类"
          confirmLabel="创建"
          onConfirm={createSeries}
          onClose={() => setNameDialog(null)}
        />
      )}

      {nameDialog?.mode === 'rename' && (
        <SeriesNameDialog
          title="重命名作品分类"
          placeholder={nameDialog.oldName}
          confirmLabel="重命名"
          initialValue={nameDialog.oldName}
          onConfirm={(name) => renameSeries(nameDialog.oldName, name)}
          onClose={() => setNameDialog(null)}
        />
      )}

      {showTextModal && (
        <TextSourceModal onClose={() => setShowTextModal(false)} onSent={() => {}} />
      )}

      {sourceViewer && (
        <DuelSourceReaderDialog sourceRef={sourceViewer} onClose={() => setSourceViewer(null)} />
      )}
    </div>
  )
}
