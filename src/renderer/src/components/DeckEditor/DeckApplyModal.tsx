import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Swords, Check, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeckApplyModalProps {
  deckName: string
  mainCount: number
  extraCount: number
  onConfirm: (player: 0 | 1, drawCount: number) => Promise<boolean>
  onClose: () => void
}

export const DeckApplyModal: React.FC<DeckApplyModalProps> = ({
  deckName,
  mainCount,
  extraCount,
  onConfirm,
  onClose
}) => {
  const [player, setPlayer] = useState<0 | 1>(0)
  const [drawMode, setDrawMode] = useState<0 | 5>(5) // 0: 全留卡组, 5: 起手抽5张
  const [isApplying, setIsApplying] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const handleApply = async (): Promise<void> => {
    setIsApplying(true)
    const ok = await onConfirm(player, drawMode)
    setIsApplying(false)
    if (ok) {
      setIsDone(true)
      setTimeout(() => {
        onClose()
      }, 1200)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-[420px] w-full animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-sm">将卡组载入决斗盘</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {isDone ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-emerald-500">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <Check className="w-6 h-6 text-emerald-500" />
            </div>
            <span className="font-bold text-sm">已成功载入至主决斗盘！</span>
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>卡组名称:</span>
                <span className="font-bold text-foreground truncate max-w-[240px]">{deckName}</span>
              </div>
              <div className="flex justify-between">
                <span>卡片构成:</span>
                <span className="font-mono text-foreground">
                  主卡组 {mainCount} 张 / 额外 {extraCount} 张
                </span>
              </div>
            </div>

            {/* 选择目标玩家 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground">目标控制者：</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPlayer(0)}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                    player === 0
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>我方 (Player 0)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlayer(1)}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors',
                    player === 1
                      ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>对方 (Player 1)</span>
                </button>
              </div>
            </div>

            {/* 初始手牌配置 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground">初始手牌：</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDrawMode(5)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-colors',
                    drawMode === 5
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  )}
                >
                  模拟起手抽 5 张
                </button>

                <button
                  type="button"
                  onClick={() => setDrawMode(0)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-colors',
                    drawMode === 0
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  )}
                >
                  全留卡组 (0张手牌)
                </button>
              </div>
            </div>

            {/* 底部确认按钮 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isApplying}>
                取消
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApply}
                disabled={isApplying || mainCount === 0}
                className="gap-1 font-bold"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>{isApplying ? '正在载入...' : '确认载入'}</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
