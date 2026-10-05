import React, { useEffect } from 'react'
import { useStore } from 'zustand'
import { Layers } from 'lucide-react'
import appIcon from '../../assets/app-icon.png'
import { useDuelStore } from '../../stores/useDuelStore'
import { MASTER_RULES, MasterRule, isExportableMatch } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
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
    toggleTacticalView,
    openScreenplayWithStep,
    currentTurn,
    currentPhase,
    currentChain,
    nextPhase,
    resetChain
  } = useDuelStore()

  // 撤销/重做仍需保留全局快捷键 (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) 调用
  // 对应的工具栏按钮已移除 (与菜单重复)
  const { undo, redo } = useStore(useDuelStore.temporal)

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
      {/* ============ 第一行：菜单栏 (VSCode 风格标题栏 + 无边框窗口自绘控件) ============ */}
      {/* 整行设为 drag 区（可拖动窗口）；内部交互元素标no-drag。
          官方规则：no-drag 只对 drag 元素的后代生效，因此必须是嵌套关系，不能靠同级覆盖。 */}
      <div className="h-9 pl-3 pr-3 flex items-center justify-between border-b border-border/60 gap-2 [-webkit-app-region:drag]">
        {/* 左侧：Logo + 菜单栏（Logo 区域也可拖动窗口，故不设 no-drag；仅菜单按钮需no-drag） */}
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
              onImportLua={handleImportLua}
              onExportLua={handleExportLua}
              onExportScreenplay={handleExportScreenplay}
            />
          </div>
        </div>

        {/* 中间弹性空白：作为主要拖拽握把 */}
        <div className="flex-1 h-full" />

        {/* 右侧：工程信息 + 导出状态 + 自绘窗口控件 */}
        <div className="flex items-center gap-2 shrink-0 [-webkit-app-region:no-drag]">
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
              className="h-7 w-52 bg-transparent hover:bg-muted/40 focus:bg-background text-xs font-medium border-transparent focus:border-border transition-colors"
              title="对局标题 (点击编辑，保存时可添加详细备忘)"
            />
          </div>

          <Separator orientation="vertical" className="h-5" />

          <ExportStatusBadge />

          <Separator orientation="vertical" className="h-4" />

          {/* 自绘窗口控件：最小化 / 最大化 / 关闭 */}
          <WindowControls className="-mr-3 ml-1" />
        </div>
      </div>

      {/* ============ 第二行：决斗上下文工具栏 (规则、对阵、回合阶段) ============ */}
      <div className="h-9 px-3 bg-muted/30 flex items-center text-xs">
        <div className="flex items-center gap-3">
          {/* 主规则选择 */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <Select
              value={state.masterRule}
              onValueChange={(val) => {
                if (val !== null) setMasterRule(val as MasterRule)
              }}
            >
              <SelectTrigger size="sm" className="w-28 h-7 text-xs bg-background/60">
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
              className="h-7 px-1.5 text-[11px] font-extrabold bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
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
      </div>

      {/* 保存工程模态弹窗 */}
      {isSaveModalOpen && (
        <SaveProjectModal open={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} />
      )}
    </header>
  )
}
