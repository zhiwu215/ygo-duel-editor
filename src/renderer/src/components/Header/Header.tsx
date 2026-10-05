import React, { useEffect } from 'react'
import { useStore } from 'zustand'
import {
  Undo2,
  Redo2,
  Download,
  Upload,
  Database,
  RotateCcw,
  Swords,
  Sun,
  Moon,
  Save,
  ArrowLeftRight,
  Layers,
  Eye,
  EyeOff,
  BookOpen,
  SquareStack
} from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { MASTER_RULES, MasterRule, isExportableMatch } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { MenuBar } from './MenuBar'
import { MatchSelector } from './components/MatchSelector'
import { ExportStatusBadge } from './components/ExportStatusBadge'
import { SaveProjectModal } from './components/SaveProjectModal'
import { cn } from '../../lib/utils'

export const Header: React.FC = () => {
  const {
    state,
    setMasterRule,
    setTitle,
    loadState,
    resetDuel,
    swapSides,
    tacticalView,
    toggleTacticalView,
    openScreenplayWithStep,
    currentTurn,
    currentPhase,
    currentChain,
    nextPhase,
    resetChain
  } = useDuelStore()

  // temporal 经 useStore 包装成响应式订阅，按钮可用状态随历史变化实时更新
  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const { config, dbReady, selectYgoDir, toggleTheme } = useConfigStore()
  const isDark = config.theme !== 'light'
  const dbConnected = dbReady === true || (dbReady === null && Boolean(config.cdbPath))

  // 保存工程对话框控制
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false)

  // ---------- 文件命令 (MenuBar 与工具栏共用，单处实现) ----------
  const handleNew = React.useCallback((): void => {
    if (confirm('确认清空当前局面并新建对局？')) {
      resetDuel()
    }
  }, [resetDuel])

  const handleSaveProject = React.useCallback((): void => {
    setIsSaveModalOpen(true)
  }, [])

  const handleOpenProject = React.useCallback(async (): Promise<void> => {
    const res = await window.api.loadProjectFile()
    if (res.success && res.state) {
      loadState(res.state)
    }
  }, [loadState])

  const handleExportLua = React.useCallback(async (): Promise<void> => {
    if (!isExportableMatch(state.matchConfig)) {
      const t0 = state.matchConfig?.team0Count ?? 1
      const t1 = state.matchConfig?.team1Count ?? 1
      alert(
        `当前对阵 (${t0}v${t1}) 仅用于剧情编排，暂无法导出 Lua。\n\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。请在对阵选择器中切换至 1v1 或 2v2 后再进行导出。`
      )
      return
    }
    const res = await window.api.exportLuaFile(state)
    if (res.success && res.filePath) {
      alert(`Lua 决斗脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }, [state])

  const handleImportLua = React.useCallback(async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      loadState(res.state)
    } else if (res.error) {
      alert(`导入失败: ${res.error}`)
    }
  }, [loadState])

  const handleExportScreenplay = React.useCallback(async (): Promise<void> => {
    if (!window.api?.exportScreenplayFile) return
    const res = await window.api.exportScreenplayFile(state)
    if (res.success && res.filePath) {
      alert(`同人决斗剧本台本已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }, [state])

  // ---------- 全局快捷键 (与菜单提示保持一致：N/O/S/I/E + Z/Y) ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const mod = e.ctrlKey || e.metaKey

      // Tab 键切换全场战术透视 (非输入框聚焦时有效)
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
          if (e.shiftKey) redo()
          else undo()
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        if (!isInput) {
          e.preventDefault()
          redo()
        }
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
    handleOpenProject,
    handleExportLua,
    handleImportLua,
    toggleTacticalView,
    openScreenplayWithStep
  ])

  return (
    <header className="border-b border-border bg-card select-none flex flex-col shrink-0">
      {/* ============ 第一行：菜单栏 ============ */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 mr-2">
            <Swords className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span className="text-[13px] font-semibold tracking-wide">YGO Duel Editor</span>
          </div>

          <MenuBar
            onNew={handleNew}
            onOpenProject={handleOpenProject}
            onSaveProject={handleSaveProject}
            onImportLua={handleImportLua}
            onExportLua={handleExportLua}
            onExportScreenplay={handleExportScreenplay}
          />

          <Separator orientation="vertical" className="h-3.5 mx-2" />

          {/* 工程分类与标题 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(true)}
              title="点击配置工程分类与备忘注释"
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider transition-colors select-none',
                'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80'
              )}
            >
              {state.duelType === 'combo' ? 'COMBO' : state.duelType === 'puzzle' ? '残局' : '整局'}
            </button>

            <Input
              type="text"
              value={state.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="未命名对局"
              className="h-6 w-52 bg-transparent hover:bg-muted/40 focus:bg-background text-xs font-medium border-transparent focus:border-border transition-colors"
              title="对局标题 (点击编辑，保存时可添加详细备忘)"
            />
          </div>
        </div>

        {/* 右侧：导出状态徽标 + 卡库连接状态 + 主题切换 */}
        <div className="flex items-center gap-1.5">
          <ExportStatusBadge />

          <Separator orientation="vertical" className="h-3.5" />

          <button
            type="button"
            onClick={selectYgoDir}
            title={
              config.gameDirectory
                ? `YGO 主目录: ${config.gameDirectory} (点击更换)`
                : '未设置 YGO 路径，点击选择游戏主目录'
            }
            className={cn(
              'flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] transition-colors',
              dbConnected
                ? 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                dbConnected ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <Database className="w-3 h-3" />
            <span>{dbConnected ? '卡库已连接' : '未加载卡库'}</span>
          </button>

          <Separator orientation="vertical" className="h-3.5" />

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleTheme}
            title={isDark ? '切换至浅色模式' : '切换至深色模式'}
            className="text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ============ 第二行：决斗工作台工具栏 ============ */}
      <div className="h-10 px-3 bg-muted/30 flex items-center justify-between gap-3 text-xs">
        {/* 左侧：规则与对局参数 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <Select
              value={state.masterRule}
              onValueChange={(val) => {
                if (val !== null) setMasterRule(val as MasterRule)
              }}
            >
              <SelectTrigger size="sm" className="w-28 h-6 text-xs bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(MASTER_RULES).map((info) => (
                  <SelectItem key={info.rule} value={info.rule}>
                    {info.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* 对阵人数选择器 (1v1 / 2v2双打 / 自定义人数) */}
          <MatchSelector />

          <Separator orientation="vertical" className="h-4" />

          {/* 回合与阶段快捷推进 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground">第{currentTurn}回合</span>
            <Button
              variant="outline"
              size="xs"
              onClick={nextPhase}
              title="点击推进至下一阶段 (DP → SP → M1 → BP → M2 → EP)"
              className="h-6 px-1.5 text-[11px] font-extrabold bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
            >
              {currentPhase}
            </Button>
            {currentChain > 0 && (
              <span
                onClick={resetChain}
                title="当前处于连锁中，点击结算重置"
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 cursor-pointer animate-pulse"
              >
                C{currentChain} 结算
              </span>
            )}
          </div>
        </div>

        {/* 右侧：历史 / 场面操作 / 文件 */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-background/60 border border-border rounded-md p-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => undo()}
              disabled={!canUndo}
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => redo()}
              disabled={!canRedo}
              title="重做 (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={swapSides}
            title="翻转对阵：交换双方全部场上卡片、手牌及生命值"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </Button>

          {/* 战术透视开关 */}
          <Button
            variant={tacticalView ? 'secondary' : 'ghost'}
            size="xs"
            onClick={toggleTacticalView}
            title="战术透视 (Tab)：全局显示/隐藏所有卡片的指示物与攻守状态浮层"
            className={cn(
              'h-6 px-2 gap-1 text-[11px] font-medium transition-colors',
              tacticalView
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tacticalView ? (
              <Eye className="w-3.5 h-3.5 text-primary" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>透视</span>
          </Button>

          {/* 决斗台本与剧本工作台 */}
          <Button
            variant="outline"
            size="xs"
            onClick={() => openScreenplayWithStep()}
            title="决斗台本与剧本工作台 (Ctrl+Shift+S)：大屏沉浸式撰写剧情、角色台词与心理戏"
            className="h-6 px-2 gap-1 text-[11px] font-semibold border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>台本</span>
          </Button>

          {/* 卡组编辑器独立窗口 */}
          <Button
            variant="outline"
            size="xs"
            onClick={() => window.api.openDeckEditor()}
            title="打开卡组编辑器 (独立窗口)"
            className="h-6 px-2 gap-1 text-[11px] font-semibold border-border/80 text-foreground hover:bg-muted"
          >
            <SquareStack className="w-3.5 h-3.5 text-muted-foreground" />
            <span>卡组</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              if (confirm('确认清空当前对局场面？')) {
                resetDuel()
              }
            }}
            title="清空重置局面"
            className="text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Button
            variant="outline"
            size="xs"
            onClick={handleSaveProject}
            title="保存工程文件 (Ctrl+S)"
            className="h-6 bg-background/60"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>保存</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={handleImportLua}
            title="导入 ocgcore Lua 脚本 (Ctrl+I)"
            className="h-6 bg-background/60"
          >
            <Upload className="w-3.5 h-3.5 text-muted-foreground" />
            <span>导入</span>
          </Button>

          {/* 核心动作导出：若人数不支持 ocgcore 导出则置灰禁用 */}
          {(() => {
            const canExport = isExportableMatch(state.matchConfig)
            return (
              <Button
                size="xs"
                onClick={handleExportLua}
                disabled={!canExport}
                title={
                  canExport
                    ? '导出符合 ocgcore 标准的 Lua 决斗脚本 (Ctrl+E)'
                    : '当前人数配置仅用于剧情编排，ocgcore 仅支持 1v1 与 2v2 双打导出'
                }
                className={cn(
                  'h-6 px-2.5 font-semibold transition-colors',
                  canExport
                    ? 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                )}
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出 Lua</span>
              </Button>
            )
          })()}
        </div>
      </div>

      {/* 保存工程模态弹窗 */}
      {isSaveModalOpen && (
        <SaveProjectModal open={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} />
      )}
    </header>
  )
}
