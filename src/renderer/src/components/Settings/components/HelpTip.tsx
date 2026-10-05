import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'

const TOOLTIP_WIDTH = 224
const VIEWPORT_MARGIN = 8

/**
 * 参数说明的「?」气泡。
 *
 * 为什么不用 `title` 属性：原生 tooltip 在 Electron/Windows 上是系统级浮层，
 * 延迟长、样式不受控，截图里也看不到，用户会以为「点了没反应」。
 * 为什么用 portal + position:fixed：弹窗正文是 overflow-y-auto 的滚动容器，
 * 绝对定位的浮层会被裁掉；而弹窗本身带 enter 动画（transform 会形成包含块），
 * 直接 fixed 也会定位错。挂到 body 上这两个问题都没有。
 */
export function HelpTip({ text }: { text: string }): React.JSX.Element {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const show = (): void => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
    setPos({
      left: Math.min(Math.max(VIEWPORT_MARGIN, rect.left), Math.max(VIEWPORT_MARGIN, maxLeft)),
      top: rect.top - 6
    })
  }

  const hide = (): void => setPos(null)

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault()
          if (pos) hide()
          else show()
        }}
        className="inline-flex shrink-0 cursor-help text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <CircleHelp className="w-3 h-3" />
      </button>

      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              width: TOOLTIP_WIDTH,
              transform: 'translateY(-100%)'
            }}
            className="pointer-events-none z-[80] rounded-lg border border-border bg-popover px-2.5 py-2 text-[11px] leading-4 text-popover-foreground shadow-md"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
