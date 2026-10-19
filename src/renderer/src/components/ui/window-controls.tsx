import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type WindowAction = 'minimize' | 'maximize' | 'close'

export const WindowControls: React.FC<{
  className?: string
  size?: 'default' | 'sm'
  actions?: WindowAction[]
}> = ({ className, size = 'default', actions = ['minimize', 'maximize', 'close'] }) => {
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
