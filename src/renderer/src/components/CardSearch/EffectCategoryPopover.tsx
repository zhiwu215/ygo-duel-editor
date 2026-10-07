import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

interface EffectCategoryPopoverProps {
  categories: Array<{ mask: number; label: string }>
  value: number
  onConfirm: (mask: number) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const COLUMNS = 4

export const EffectCategoryPopover: React.FC<EffectCategoryPopoverProps> = ({
  categories,
  value,
  onConfirm,
  onClose,
  anchorRef
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [checked, setChecked] = useState<boolean[]>(() =>
    categories.map((c) => (value & c.mask) !== 0)
  )

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchorRef])

  const confirm = (): void => {
    let mask = 0
    for (let i = 0; i < categories.length; i += 1) {
      if (checked[i]) mask |= categories[i].mask
    }
    onConfirm(mask >>> 0)
  }

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-full z-50 mt-1 w-max max-w-[calc(100vw-24px)] rounded-md border border-border/70 bg-popover p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100"
    >
      {categories.length > 0 ? (
        <>
          <div
            className="grid gap-x-3 gap-y-1"
            style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
          >
            {categories.map((category, index) => (
              <button
                key={category.mask}
                type="button"
                role="checkbox"
                aria-checked={checked[index]}
                onClick={() => setChecked((prev) => prev.map((c, i) => (i === index ? !c : c)))}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] text-foreground/85 transition-colors hover:bg-neutral-500/15"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
                    checked[index] ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                >
                  {checked[index] && (
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-primary-foreground">
                      <path
                        d="M1.5 5.2 L4 7.6 L8.5 2.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="truncate">{category.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-2 flex justify-center border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={confirm}
              className="h-7 w-24 rounded-md bg-neutral-500/15 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-500/30"
            >
              确定
            </button>
          </div>
        </>
      ) : (
        <p className="max-w-72 text-[10px] leading-relaxed text-muted-foreground">
          当前卡库未提供分类名称。将游戏目录中的 strings.conf 放在 cards.cdb 同目录或 expansions
          子目录后重载卡库。
        </p>
      )}
    </div>
  )
}
