import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type WindowAction = 'minimize' | 'maximize' | 'close'

/**
 * 无边框窗口的自绘窗口控件（最小化 / 最大化 / 关闭）
 *
 * 主进程的 `window:*` handler 统一用 `BrowserWindow.fromWebContents(event.sender)`
 * 定位发起窗口，因此本组件可直接用于任意 `frame: false` 窗口（主窗口、卡组编辑器窗口）。
 *
 * 用法约定：放在该窗口自绘标题栏的最右侧，调用方用 `-mr-*` 抵消标题栏的右内边距，
 * 让按钮贴齐窗口右缘；标题栏容器设 `[-webkit-app-region:drag]`，其中其它可交互元素
 * 设 `[-webkit-app-region:no-drag]`（no-drag 只对 drag 元素的后代生效，必须嵌套）。
 *
 * `actions` 用于裁剪按钮：卡组编辑器已有「退出编辑」承担返回职责，只保留最大化。
 */
export const WindowControls: React.FC<{
  className?: string
  size?: 'default' | 'sm'
  actions?: WindowAction[]
}> = ({ className, size = 'default', actions = ['minimize', 'maximize', 'close'] }) => {
  // 跟踪最大化状态：双击拖拽区 / 系统快捷键改变状态时，主进程会广播回来切换图标
  const [isMaximized, setIsMaximized] = useState<boolean>(false)
  const btnSize = size === 'sm' ? 'h-6 w-6' : 'h-9 w-9'
  const has = (action: WindowAction): boolean => actions.includes(action)

  useEffect(() => {
    void window.api.windowIsMaximized().then(setIsMaximized)
    return window.api.onWindowMaximizedChange(setIsMaximized)
  }, [])

  return (
    <div className={cn('flex items-center [-webkit-app-region:no-drag]', className)}>
      {has('minimize') && (
        <button
          type="button"
          onClick={() => void window.api.windowMinimize()}
          title="最小化"
          className={cn(
            btnSize,
            'flex items-center justify-center text-muted-foreground/80 hover:bg-muted hover:text-foreground transition-colors [-webkit-app-region:no-drag]'
          )}
        >
          <Minus className="w-3 h-3" />
        </button>
      )}

      {has('maximize') && (
        <button
          type="button"
          onClick={() => void window.api.windowToggleMaximize()}
          title={isMaximized ? '向下还原' : '最大化'}
          className={cn(
            btnSize,
            'flex items-center justify-center rounded-md text-muted-foreground/80 hover:bg-muted hover:text-foreground transition-colors [-webkit-app-region:no-drag]'
          )}
        >
          {size === 'sm' ? (
            isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )
          ) : isMaximized ? (
            <Copy className="w-2.5 h-2.5 -scale-x-100" />
          ) : (
            <Square className="w-2.5 h-2.5" />
          )}
        </button>
      )}

      {has('close') && (
        <button
          type="button"
          onClick={() => void window.api.windowClose()}
          title="关闭"
          className={cn(
            btnSize,
            'rounded-md flex items-center justify-center text-muted-foreground/80 hover:bg-destructive/10 hover:text-destructive transition-colors [-webkit-app-region:no-drag]'
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
