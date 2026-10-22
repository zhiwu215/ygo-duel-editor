import React, { useRef, useState } from 'react'
import { EffectCategoryGrid } from '../common/EffectCategoryGrid'
import { usePopoverDismiss } from './usePopoverDismiss'

interface EffectCategoryPopoverProps {
  categories: Array<{ mask: number; label: string }>
  value: number
  onConfirm: (mask: number) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export const EffectCategoryPopover: React.FC<EffectCategoryPopoverProps> = ({
  categories,
  value,
  onConfirm,
  onClose,
  anchorRef
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [mask, setMask] = useState<number>(value)

  usePopoverDismiss(rootRef, anchorRef, onClose)

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-full z-50 mt-1 w-max max-w-[calc(100vw-24px)] rounded-md border border-border/70 bg-popover p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100"
    >
      {categories.length > 0 ? (
        <>
          <EffectCategoryGrid
            categories={categories}
            value={mask}
            onToggle={(bit) => setMask((previous) => previous ^ bit)}
          />
          <div className="mt-2 flex justify-center border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={() => onConfirm(mask >>> 0)}
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
