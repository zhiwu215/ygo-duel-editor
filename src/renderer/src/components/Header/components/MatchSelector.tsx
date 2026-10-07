import React, { useState } from 'react'
import { Users, X } from 'lucide-react'
import { useDuelStore } from '../../../stores/useDuelStore'
import { MatchConfig } from '@shared/index'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Button } from '../../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog'

export const MatchSelector: React.FC = () => {
  const { state, switchMatchConfig } = useDuelStore()
  const matchConfig = state.matchConfig || {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1,
    sharedLp: false
  }

  const [showCustomModal, setShowCustomModal] = useState(false)
  const [team0Input, setTeam0Input] = useState(matchConfig.team0Count || 1)
  const [team1Input, setTeam1Input] = useState(matchConfig.team1Count || 1)

  // 计算下拉菜单当前显示文案
  const getDisplayLabel = (): string => {
    if (matchConfig.mode === '1v1') return '1 v 1'
    if (matchConfig.mode === 'tag') return '2 v 2 双打'
    return `自定义 (${matchConfig.team0Count} v ${matchConfig.team1Count})`
  }

  const handleSelectChange = (val: string | null): void => {
    if (!val) return
    if (val === '1v1') {
      switchMatchConfig({
        mode: '1v1',
        team0Count: 1,
        team1Count: 1,
        sharedLp: false
      })
    } else if (val === 'tag') {
      switchMatchConfig({
        mode: 'tag',
        team0Count: 2,
        team1Count: 2,
        sharedLp: false
      })
    } else if (val === 'custom') {
      setTeam0Input(matchConfig.team0Count || 1)
      setTeam1Input(matchConfig.team1Count || 1)
      setShowCustomModal(true)
    }
  }

  const handleConfirmCustom = (): void => {
    const t0 = Math.min(6, Math.max(1, Number(team0Input) || 1))
    const t1 = Math.min(6, Math.max(1, Number(team1Input) || 1))

    let mode: MatchConfig['mode'] = 'custom'
    if (t0 === 1 && t1 === 1) mode = '1v1'
    else if (t0 === 2 && t1 === 2) mode = 'tag'

    switchMatchConfig({
      mode,
      team0Count: t0,
      team1Count: t1,
      sharedLp: false
    })
    setShowCustomModal(false)
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <Select value={matchConfig.mode} onValueChange={handleSelectChange}>
          <SelectTrigger size="sm" className="h-6 text-xs bg-background/60 min-w-[105px]">
            <SelectValue>{getDisplayLabel()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1v1">1 v 1</SelectItem>
            <SelectItem value="tag">2 v 2 双打</SelectItem>
            <SelectItem value="custom">自定义人数…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 自定义人数对话框 (双独立数字输入框，上限 6 人) */}
      <Dialog open={showCustomModal} onOpenChange={(open) => !open && setShowCustomModal(false)}>
        <DialogContent showCloseButton={false} className="max-w-sm gap-4 p-4">
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">自定义对阵人数</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowCustomModal(false)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            请分别指定我方与对方的决斗者人数。不同人数配置将作为独立的决斗场景保留，互不相干。
          </DialogDescription>

          <div className="grid grid-cols-2 gap-3 py-1">
            {/* 我方人数 */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded border border-blue-500/20 bg-blue-500/5">
              <label className="text-xs font-semibold text-blue-500 dark:text-blue-400">
                我方人数 (1 ~ 6)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={team0Input}
                  onChange={(e) => setTeam0Input(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-sm font-semibold focus:outline-none focus:border-blue-500 text-center"
                />
                <span className="text-xs text-muted-foreground">人</span>
              </div>
            </div>

            {/* 对方人数 */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded border border-red-500/20 bg-red-500/5">
              <label className="text-xs font-semibold text-red-500 dark:text-red-400">
                对方人数 (1 ~ 6)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={team1Input}
                  onChange={(e) => setTeam1Input(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-sm font-semibold focus:outline-none focus:border-red-500 text-center"
                />
                <span className="text-xs text-muted-foreground">人</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-border pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomModal(false)}
              className="text-xs h-7"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCustom}
              className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              确定切换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
