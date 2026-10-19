import React, { useEffect, useRef, useState } from 'react'
import { Check, ImageUp } from 'lucide-react'
import { CardImage } from '../ui/CardImage'
import { useCardNoteStore } from '../../stores/useCardNoteStore'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { resolveCardName } from '../../utils/cardNames'

export interface CardImageMenuState {
  cardCode: number
  cardName: string
  isCustom: boolean
  variantCodes: number[]
  x: number
  y: number
}

interface CardImageVariantMenuProps {
  menu: CardImageMenuState
  onClose: () => void
}

export const CardImageVariantMenu: React.FC<CardImageVariantMenuProps> = ({ menu, onClose }) => {
  const notify = useCardNoteStore((s) => s.notify)
  const panelRef = useRef<HTMLDivElement>(null)
  const [variants, setVariants] = useState<Array<{ code: number; name: string }>>([])
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  useDismissOnOutside(panelRef, true, onClose)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cfg = await window.api.getConfig()
        if (!cancelled) setOverrides(cfg.cardImageOverrides ?? {})
        if (menu.isCustom) return
        const codes = menu.variantCodes.length > 0 ? menu.variantCodes : [menu.cardCode]
        const map = await window.api.getCardsByIds(codes)
        if (!cancelled) {
          setVariants(
            codes
              .filter((c) => map[c])
              .map((c) => ({ code: c, name: map[c]?.name || resolveCardName(c) }))
          )
        }
      } catch (err) {
        console.error('[CardNoteApp] 读取卡图变体失败:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [menu])

  const handleSetOverride = async (cardCode: number, variantCode: number): Promise<void> => {
    await window.api.setCardImageOverride(cardCode, variantCode)
    onClose()
    notify('卡图已切换')
  }

  const handleApplyImage = async (id: number): Promise<void> => {
    const res = await window.api.applyCustomCardImage(id)
    if (!res.success && res.error) {
      notify(res.error)
      return
    }
    onClose()
    if (res.success) notify('卡图已更新')
  }

  return (
    <div
      ref={panelRef}
      style={{
        left: Math.min(menu.x, window.innerWidth - 240),
        top: Math.min(menu.y, window.innerHeight - 300)
      }}
      className="fixed z-[60] w-56 max-h-72 overflow-y-auto bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate">
        {menu.cardName}
      </div>
      {menu.isCustom ? (
        <button
          type="button"
          onClick={() => void handleApplyImage(menu.cardCode)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer text-left"
        >
          <ImageUp className="w-3.5 h-3.5 text-sky-500" />
          <span>上传新卡图</span>
        </button>
      ) : (
        <>
          <div className="px-2 py-0.5 text-[10px] text-muted-foreground/70">切换卡图</div>
          {variants.length === 0 && (
            <p className="px-2 py-2 text-[10px] text-muted-foreground/70">正在读取变体卡图…</p>
          )}
          {variants.map((v) => {
            const active = (overrides[String(menu.cardCode)] ?? menu.cardCode) === v.code
            return (
              <button
                key={v.code}
                type="button"
                onClick={() => void handleSetOverride(menu.cardCode, v.code)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/70 transition-colors cursor-pointer text-left"
              >
                <CardImage
                  code={v.code}
                  small
                  alt={v.name}
                  className="w-6 h-8 object-cover rounded-sm border border-border/60 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  {v.name}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/70 shrink-0">
                  {v.code}
                </span>
                {active && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
