import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React from 'react'
import appIcon from '../../assets/app-icon.png'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { MASTER_RULES, MasterRule, SELECTABLE_MASTER_RULES } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { ShieldCheck, Square, Play } from 'lucide-react'
import { MenuBar } from './MenuBar'
import { MatchSelector } from './components/MatchSelector'
import { TurnPhaseIndicator } from './components/TurnPhaseIndicator'
import { ExportStatusBadge } from './components/ExportStatusBadge'
import { SaveProjectModal } from './components/SaveProjectModal'
import { useProjectCommands } from '../../hooks/useProjectCommands'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'

export const Header: React.FC = () => {
  const engineMode = useDuelEngineStore((s) => s.engineMode)
  const isEngineLoading = useDuelEngineStore((s) => s.loading)
  const startEngine = useDuelEngineStore((s) => s.startEngine)
  const stopEngine = useDuelEngineStore((s) => s.stopEngine)
  const { state, setMasterRule, setTitle } = useDuelStore()

  const {
    isSaveModalOpen,
    closeSaveModal,
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    handleExportYrp,
    handleExportScreenplay,
    handleExportSession,
    handleImportSession
  } = useProjectCommands()

  useGlobalShortcuts({
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua
  })

  return (
    <header className="border-b border-border bg-card select-none flex flex-col shrink-0">
      <div className="h-9 pl-3 pr-3 flex items-center justify-between border-b border-border/60 gap-2 [-webkit-app-region:drag]">
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex items-center gap-1.5 mr-2 shrink-0">
            <img
              src={appIcon}
              alt=""
              className="w-4 h-4 rounded-[3px] object-cover"
              draggable={false}
            />
            <span className="text-[13px] font-semibold tracking-wide">YGO Duel Editor</span>
          </div>

          <div className="[-webkit-app-region:no-drag]">
            <MenuBar
              onNew={handleNew}
              onOpenProject={handleOpenProject}
              onSaveProject={handleSaveProject}
              onSaveProjectAs={handleSaveProjectAs}
              onTestInYgo={handleTestInYgo}
              onImportLua={handleImportLua}
              onExportLua={handleExportLua}
              onExportYrp={handleExportYrp}
              onExportScreenplay={handleExportScreenplay}
              onExportSession={handleExportSession}
              onImportSession={handleImportSession}
            />
          </div>
        </div>

        <div className="flex-1 h-full" />

        <div className="flex items-center gap-2 shrink-0 [-webkit-app-region:no-drag]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Input
                  type="text"
                  value={state.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="未命名对局"
                  className="h-7 w-52 bg-transparent hover:bg-muted/40 focus:bg-background text-xs font-medium border-transparent focus:border-border transition-colors"
                />
              }
            />
            <TooltipContent>对局标题（保存时可配置工程分类和注释）</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <ExportStatusBadge />

          <Separator orientation="vertical" className="h-4" />

          <WindowControls className="-mr-3 ml-1" />
        </div>
      </div>

      <div className="h-9 px-3 bg-muted/30 flex items-center text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Select
              value={state.masterRule}
              onValueChange={(val) => {
                if (val !== null) setMasterRule(val as MasterRule)
              }}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SelectTrigger size="sm" className="w-40 h-7 text-xs bg-background/60">
                      <SelectValue>
                        {MASTER_RULES[state.masterRule]?.name ?? '大师规则（2020）'}
                      </SelectValue>
                    </SelectTrigger>
                  }
                />
                <TooltipContent>选择大师规则</TooltipContent>
              </Tooltip>
              <SelectContent>
                {SELECTABLE_MASTER_RULES.map((rule) => {
                  const info = MASTER_RULES[rule]
                  return (
                    <SelectItem key={info.rule} value={info.rule}>
                      {info.name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-4" />

          <MatchSelector />

          <Separator orientation="vertical" className="h-4" />

          <TurnPhaseIndicator />

          <Separator orientation="vertical" className="h-4" />

          {engineMode === 'running' ? (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-0.5" />
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>规则校验中</span>
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => stopEngine()}
                      className="h-7 px-2 text-[11px] font-bold gap-1 bg-background/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive border-border"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>退出引擎</span>
                    </Button>
                  }
                />
                <TooltipContent>退出 ocgcore 规则校验模式，恢复自由编排</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void startEngine()}
                    disabled={isEngineLoading}
                    className="h-7 px-2 text-[11px] font-bold gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isEngineLoading ? '正在启动...' : '启动规则校验'}</span>
                  </Button>
                }
              />
              <TooltipContent>
                使用 ocgcore 原生内核校验决斗规则，锁定场面进入实战推演
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {isSaveModalOpen && <SaveProjectModal open={isSaveModalOpen} onClose={closeSaveModal} />}
    </header>
  )
}
