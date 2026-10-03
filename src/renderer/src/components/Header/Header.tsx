import React from 'react'
import { Undo2, Redo2, Download, Upload, Database, RotateCcw, Swords, Heart } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { MASTER_RULES, MasterRule } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface PlayerLpInputProps {
  label: string
  player: 0 | 1
  lp: number
  colorClass: string
  onLpChange: (player: 0 | 1, lp: number) => void
}

const PlayerLpInput: React.FC<PlayerLpInputProps> = ({
  label,
  player,
  lp,
  colorClass,
  onLpChange
}) => (
  <div className="flex items-center gap-1.5">
    <span className="text-muted-foreground font-semibold">{label}:</span>
    <div className="flex items-center gap-1 bg-background px-1.5 py-0.5 rounded border border-border">
      <Heart className={`w-3.5 h-3.5 ${colorClass}`} />
      <Input
        type="number"
        value={lp}
        onChange={(e) => onLpChange(player, parseInt(e.target.value, 10) || 0)}
        className="w-16 h-6 border-0 bg-transparent text-right font-mono font-bold p-0 focus-visible:ring-0"
        step={500}
      />
    </div>
  </div>
)

export const Header: React.FC = () => {
  const { state, setMasterRule, setTitle, setPlayerLp, setTurnPlayer, loadState, resetDuel } =
    useDuelStore()

  // zundo temporal 历史撤销与重做
  const { undo, redo, pastStates, futureStates } = useDuelStore.temporal.getState()
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const { config, selectCdbFile } = useConfigStore()

  // 快捷键监听 (Ctrl+Z, Ctrl+Y)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // 导出 Lua
  const handleExportLua = async (): Promise<void> => {
    const res = await window.api.exportLuaFile(state)
    if (res.success) {
      alert(`残局 Lua 脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  // 导入 Lua
  const handleImportLua = async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      loadState(res.state)
    } else if (res.error) {
      alert(`导入失败: ${res.error}`)
    }
  }

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none">
      {/* 左侧：Logo 与残局标题 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-base tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          <Swords className="w-5 h-5 text-amber-400" />
          <span>YGO Duel Editor</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        <Input
          type="text"
          value={state.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未命名残局"
          className="h-8 w-44 bg-transparent hover:bg-muted/40 focus:bg-muted/60 text-sm font-medium border-transparent focus:border-border transition-all"
        />

        {/* 规则版本切换器 */}
        <Select
          value={state.masterRule}
          onValueChange={(val) => {
            if (val !== null) setMasterRule(val as MasterRule)
          }}
        >
          <SelectTrigger size="sm" className="w-28 text-xs font-medium">
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

      {/* 中间：双方生命值与先攻设置 */}
      <div className="flex items-center gap-4 bg-muted/40 px-3 py-1 rounded-lg border border-border/50 text-xs">
        <PlayerLpInput
          label="对方"
          player={1}
          lp={state.players[1].lp}
          colorClass="text-red-500 fill-red-500/20"
          onLpChange={setPlayerLp}
        />

        <Separator orientation="vertical" className="h-3" />

        <PlayerLpInput
          label="我方"
          player={0}
          lp={state.players[0].lp}
          colorClass="text-blue-500 fill-blue-500/20"
          onLpChange={setPlayerLp}
        />

        <Separator orientation="vertical" className="h-3" />

        {/* 先攻玩家 */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">先攻:</span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setTurnPlayer(state.turnPlayer === 0 ? 1 : 0)}
            className={`font-semibold transition-colors ${
              state.turnPlayer === 0
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30 hover:text-blue-300'
                : 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30 hover:text-red-300'
            }`}
          >
            {state.turnPlayer === 0 ? '我方' : '对方'}
          </Button>
        </div>
      </div>

      {/* 右侧：撤销/重做与文件操作 */}
      <div className="flex items-center gap-2">
        {/* 撤销 / 重做 */}
        <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-md border border-border/50">
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
          onClick={resetDuel}
          title="清空重置棋盘"
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* 选择 CDB 库 */}
        <Button
          variant="secondary"
          size="sm"
          onClick={selectCdbFile}
          title={config.cdbPath ? `当前卡库: ${config.cdbPath}` : '选择游戏王 cards.cdb 卡片数据库'}
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>{config.cdbPath ? '更换卡库' : '加载卡库'}</span>
        </Button>

        {/* 导入 Lua */}
        <Button variant="secondary" size="sm" onClick={handleImportLua} title="导入已有 Lua 残局">
          <Upload className="w-3.5 h-3.5 text-sky-400" />
          <span>导入</span>
        </Button>

        {/* 导出 Lua */}
        <Button
          size="sm"
          onClick={handleExportLua}
          title="导出符合 ocgcore 标准的 Lua 残局文件"
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出 Lua</span>
        </Button>
      </div>
    </header>
  )
}
