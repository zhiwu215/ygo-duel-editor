import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useEffect } from 'react'
import { useStore } from 'zustand'
import appIcon from '../../assets/app-icon.png'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { alertDialog, confirmDialog } from '../../stores/useDialogStore'
import { MASTER_RULES, MasterRule, SELECTABLE_MASTER_RULES, isExportableMatch } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { ShieldCheck, Square, Play } from 'lucide-react'
import { MenuBar } from './MenuBar'
import { MatchSelector } from './components/MatchSelector'
import { ExportStatusBadge } from './components/ExportStatusBadge'
import { SaveProjectModal } from './components/SaveProjectModal'

export const Header: React.FC = () => {
  const engineMode = useDuelEngineStore((s) => s.engineMode)
  const isEngineLoading = useDuelEngineStore((s) => s.loading)
  const startEngine = useDuelEngineStore((s) => s.startEngine)
  const stopEngine = useDuelEngineStore((s) => s.stopEngine)
  const {
    state,
    setMasterRule,
    setTitle,
    loadState,
    resetDuel,
    toggleTacticalView,
    openScreenplayWithStep,
    currentTurn,
    currentPhase,
    currentChain,
    nextPhase,
    resetChain,
    currentProjectPath,
    setCurrentProjectPath
  } = useDuelStore()

  const { undo, redo } = useStore(useDuelStore.temporal)

  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false)

  const handleNew = React.useCallback((): void => {
    void confirmDialog({
      title: '新建对局',
      description: '确认清空当前局面并新建对局？'
    }).then((ok) => {
      if (ok) resetDuel()
    })
  }, [resetDuel])

  /**
   * Ctrl+S 智能保存：
   *  - 当前有项目路径 → 静默覆盖原文件
   *  - 没有路径（新建/导入 Lua 后的未保存状态）→ 弹模态走完整流程
   * 路径无效（被外部移走）回退到弹模态
   */
  const handleSaveProject = React.useCallback(async (): Promise<void> => {
    if (!currentProjectPath) {
      setIsSaveModalOpen(true)
      return
    }
    const res = await window.api.saveProjectToPath(currentProjectPath, state)
    if (res.success) return
    if (res.error) {
      void alertDialog(`保存失败：${res.error}\n将打开另存为对话框。`)
    }
    setIsSaveModalOpen(true)
  }, [currentProjectPath, state])

  /** 另存为（Ctrl+Alt+S）—— 始终弹模态，可改文件名/位置/分类/series/注释 */
  const handleSaveProjectAs = React.useCallback((): void => {
    setIsSaveModalOpen(true)
  }, [])

  const handleOpenProject = React.useCallback(async (): Promise<void> => {
    const res = await window.api.loadProjectFile()
    if (res.success && res.state) {
      loadState(res.state)
      if (res.filePath) setCurrentProjectPath(res.filePath)
    }
  }, [loadState, setCurrentProjectPath])

  const handleExportLua = React.useCallback(async (): Promise<void> => {
    if (!isExportableMatch(state.matchConfig)) {
      const t0 = state.matchConfig?.team0Count ?? 1
      const t1 = state.matchConfig?.team1Count ?? 1
      void alertDialog(
        `无法导出 Lua\n\n当前对阵 (${t0}v${t1}) 仅用于剧情编排，暂无法导出 Lua。\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。请在对阵选择器中切换至 1v1 或 2v2 后再进行导出。`
      )
      return
    }
    const res = await window.api.exportLuaFile(state)
    if (res.success && res.filePath) {
      void alertDialog(`Lua 决斗脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state])

  const handleTestInYgo = React.useCallback(async (): Promise<void> => {
    if (!isExportableMatch(state.matchConfig)) {
      const t0 = state.matchConfig?.team0Count ?? 1
      const t1 = state.matchConfig?.team1Count ?? 1
      void alertDialog(
        `无法测试对局\n\n当前对阵 (${t0}v${t1}) 仅用于剧情编排，暂无法生成 Lua。\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。请在对阵选择器中切换至 1v1 或 2v2 后再进行测试。`
      )
      return
    }
    const res = await window.api.testInYgo(state)
    if (res.success) return
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置 ygo 游戏目录',
        description:
          '使用 ygo 测试对局前，需要先在 设置 → 路径 中选择 ygopro.exe 所在的游戏根目录。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
    } else if (res.errorCode === 'ygopro-not-found') {
      void alertDialog(
        `未在游戏目录中找到 ygopro.exe\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
    } else if (res.error) {
      void alertDialog(`启动 ygo 测试失败: ${res.error}`)
    }
  }, [state])

  const handleImportLua = React.useCallback(async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      loadState(res.state)
    } else if (res.error) {
      void alertDialog(`导入失败: ${res.error}`)
    }
  }, [loadState])

  const handleExportYrp = React.useCallback(async (): Promise<void> => {
    const isEngine = useDuelEngineStore.getState().isInitialized
    const timeline = useDuelEngineStore.getState().timeline
    if (!isEngine || timeline.length === 0) {
      void alertDialog(
        '无法导出录像\n\n还没有经过游戏引擎的操作记录。请先在对局中通过引擎召唤、发动、盖放卡片，再导出 YRP 录像。'
      )
      return
    }
    const currentPuzzleState = useDuelStore.getState().state
    if (!isExportableMatch(currentPuzzleState.matchConfig)) {
      const t0 = currentPuzzleState.matchConfig?.team0Count ?? 1
      const t1 = currentPuzzleState.matchConfig?.team1Count ?? 1
      void alertDialog(
        `无法导出录像\n\n当前对阵 (${t0}v${t1}) 仅用于剧情编排，暂无法导出 YRP。\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。`
      )
      return
    }
    const res = await window.api.duelExportReplay({
      state: currentPuzzleState,
      launch: true
    })
    if (res.success) {
      void alertDialog(
        `YRP 录像导出成功${res.launched ? '，已在 ygopro 中打开回放' : ''}\n\n录像: ${res.yrpPath}\n残局脚本: ${res.luaPath}\n\n之后在 ygopro 的「录像回放」中也可以随时观看（需保留 single 目录下的同名 lua）。`
      )
      return
    }
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置 ygo 游戏目录',
        description: '导出 YRP 录像前，需要先在 设置 → 路径 中选择 ygopro.exe 所在的游戏根目录。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
    } else if (res.errorCode === 'ygopro-not-found') {
      void alertDialog(
        `未在游戏目录中找到 ygopro.exe\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
    } else if (res.error) {
      void alertDialog(`导出 YRP 录像失败\n\n${res.error}`)
    }
  }, [])

  const handleExportScreenplay = React.useCallback(async (): Promise<void> => {
    if (!window.api?.exportScreenplayFile) return
    const res = await window.api.exportScreenplayFile(state)
    if (res.success && res.filePath) {
      void alertDialog(`同人决斗剧本台本已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const mod = e.ctrlKey || e.metaKey

      if (e.key === 'Tab') {
        if (!isInput) {
          e.preventDefault()
          toggleTacticalView()
        }
      }

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNew()
      } else if (mod && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault()
          if (useDuelEngineStore.getState().isInitialized) {
            void (e.shiftKey
              ? useDuelEngineStore.getState().redo()
              : useDuelEngineStore.getState().undo())
          } else {
            if (e.shiftKey) redo()
            else undo()
          }
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        if (!isInput) {
          e.preventDefault()
          if (useDuelEngineStore.getState().isInitialized) {
            void useDuelEngineStore.getState().redo()
          } else {
            redo()
          }
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProjectAs()
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProject()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        openScreenplayWithStep()
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        handleOpenProject()
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportLua()
      } else if (mod && e.key.toLowerCase() === 't') {
        e.preventDefault()
        handleTestInYgo()
      } else if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        handleImportLua()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    undo,
    redo,
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    toggleTacticalView,
    openScreenplayWithStep
  ])

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

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground">第{currentTurn}回合</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={nextPhase}
                    className="h-7 px-1.5 text-[11px] font-extrabold bg-muted border-border text-foreground hover:bg-muted/80"
                  >
                    {currentPhase}
                  </Button>
                }
              />
              <TooltipContent>点击推进至下一阶段 (DP → SP → M1 → BP → M2 → EP)</TooltipContent>
            </Tooltip>
            {currentChain > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      onClick={resetChain}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 cursor-pointer animate-pulse"
                    >
                      C{currentChain} 结算
                    </span>
                  }
                />
                <TooltipContent>当前处于连锁中，点击结算重置</TooltipContent>
              </Tooltip>
            )}
          </div>

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
                      onClick={() => stopEngine(false)}
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

      {isSaveModalOpen && (
        <SaveProjectModal open={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} />
      )}
    </header>
  )
}
