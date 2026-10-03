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
  EyeOff
} from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { MASTER_RULES, MasterRule } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { MenuBar } from './MenuBar'
import { LpInput } from './components/LpInput'
import { cn } from '../../lib/utils'

export const Header: React.FC = () => {
  const {
    state,
    setMasterRule,
    setTitle,
    setPlayerLp,
    setTurnPlayer,
    loadState,
    resetDuel,
    swapSides,
    tacticalView,
    toggleTacticalView
  } = useDuelStore()

  // temporal 经 useStore 包装成响应式订阅，按钮可用状态随历史变化实时更新
  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const { config, selectCdbFile, toggleTheme } = useConfigStore()
  const isDark = config.theme !== 'light'

  // ---------- 文件命令 (MenuBar 与工具栏共用，单处实现) ----------
  const handleNew = React.useCallback((): void => {
    if (confirm('确认清空当前局面并新建对局？')) {
      resetDuel()
    }
  }, [resetDuel])

  const handleSaveProject = React.useCallback(async (): Promise<void> => {
    const res = await window.api.saveProjectFile(state)
    if (res.success && res.filePath) {
      alert(`工程已成功保存：\n${res.filePath}`)
    }
  }, [state])

  const handleOpenProject = React.useCallback(async (): Promise<void> => {
    const res = await window.api.loadProjectFile()
    if (res.success && res.state) {
      loadState(res.state)
    }
  }, [loadState])

  const handleExportLua = React.useCallback(async (): Promise<void> => {
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
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProject()
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
    toggleTacticalView
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
          />

          <Separator orientation="vertical" className="h-3.5 mx-2" />

          <Input
            type="text"
            value={state.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="未命名对局"
            className="h-6 w-56 bg-transparent hover:bg-muted/40 focus:bg-background text-xs font-medium border-transparent focus:border-border transition-colors"
            title="对局标题"
          />
        </div>

        {/* 右侧：卡库连接状态 + 主题切换 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={selectCdbFile}
            title={
              config.cdbPath
                ? `已连接卡库: ${config.cdbPath} (点击更换)`
                : '未检测到 cards.cdb，点击加载卡片数据库'
            }
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                config.cdbPath ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <Database className="w-3 h-3" />
            <span>{config.cdbPath ? '卡库已连接' : '未加载卡库'}</span>
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

          <LpInput
            label="对方"
            player={1}
            lp={state.players[1].lp}
            dotClass="bg-red-500"
            onLpChange={setPlayerLp}
          />

          <LpInput
            label="我方"
            player={0}
            lp={state.players[0].lp}
            dotClass="bg-blue-500"
            onLpChange={setPlayerLp}
          />

          <Separator orientation="vertical" className="h-4" />

          {/* 先攻方 (语义色仅用于文字) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">先攻</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setTurnPlayer(state.turnPlayer === 0 ? 1 : 0)}
              title="点击切换先攻方"
              className={cn(
                'h-6 px-2 text-[11px] font-semibold bg-background/60',
                state.turnPlayer === 0
                  ? 'text-blue-600 dark:text-blue-400 border-blue-500/40'
                  : 'text-red-600 dark:text-red-400 border-red-500/40'
              )}
            >
              {state.turnPlayer === 0 ? '我方' : '对方'}
            </Button>
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

          {/* 唯一实心强调色按钮：核心动作导出 */}
          <Button
            size="xs"
            onClick={handleExportLua}
            title="导出符合 ocgcore 标准的 Lua 决斗脚本 (Ctrl+E)"
            className="h-6 px-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 text-white font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 Lua</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
