import React from 'react'
import { Loader2 } from 'lucide-react'
import { useGameLaunchStore } from '../../../stores/useGameLaunchStore'

export const GameLaunchOverlay: React.FC = () => {
  const launching = useGameLaunchStore((s) => s.launching)

  if (!launching) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <div className="text-sm font-semibold">正在用游戏打开回放</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            正在启动游戏客户端，游戏窗口出现前请稍候。
          </div>
        </div>
      </div>
    </div>
  )
}
