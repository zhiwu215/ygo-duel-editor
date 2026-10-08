import React, { useEffect, useState } from 'react'
import { CdbCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { enginePromptUsesModal } from '../../utils/ruleCheck'
import { Button } from '../ui/button'
import { Check, X, Sparkles, Crosshair } from 'lucide-react'
import { cn } from '../../lib/utils'

export const EngineSelectModal: React.FC = () => {
  const pendingEngineSelect = useDuelStore((s) => s.pendingEngineSelect)
  const commitEngineSelectIndex = useDuelStore((s) => s.commitEngineSelectIndex)
  const confirmEngineSelect = useDuelStore((s) => s.confirmEngineSelect)
  const cancelEngineSelect = useDuelStore((s) => s.cancelEngineSelect)

  const prompt = pendingEngineSelect?.prompt
  const modal = prompt ? enginePromptUsesModal(prompt) : false
  const [cdb, setCdb] = useState<Record<number, CdbCard>>({})

  const promptKey = prompt ? `${pendingEngineSelect?.sessionId}_${prompt.kind}` : ''

  useEffect(() => {
    if (!prompt || !modal) return
    const codes = [...new Set(prompt.candidates.map((c) => c.code))]
    let canceled = false
    window.api
      .getCardsByIds(codes)
      .then((map) => {
        if (!canceled) setCdb(map)
      })
      .catch(() => {})
    return () => {
      canceled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptKey])

  if (!pendingEngineSelect || !prompt || !modal) return null

  const isChain = prompt.kind === 'CHAIN'
  const isPosition = prompt.kind === 'POSITION'
  const title = isPosition
    ? '请选择表示形式'
    : isChain
      ? '要发动这张卡的效果吗？'
      : prompt.kind === 'TRIBUTE'
        ? '请选择祭品'
        : '请选择卡'
  const countHint =
    prompt.min === prompt.max ? `${prompt.min} 张` : `${prompt.min}~${prompt.max} 张`
  const ready = pendingEngineSelect.chosen.length >= prompt.min

  if (isPosition) {
    const candidate = prompt.candidates[0]
    const info = candidate ? cdb[candidate.code] : undefined
    const mask = prompt.positions ?? 0
    const options = [
      { bit: 0x1, label: '表侧攻击' },
      { bit: 0x4, label: '表侧守备' },
      { bit: 0x8, label: '里侧守备' },
      { bit: 0x2, label: '里侧攻击' }
    ].filter((o) => (mask & o.bit) !== 0)
    return (
      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Crosshair className="w-4 h-4 shrink-0 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-4 p-4">
            {candidate && (
              <div className="relative w-24 h-[141px] rounded overflow-hidden shadow border border-border/60 bg-black/30 shrink-0">
                <img
                  src={getCardImageUrl(candidate.code, true)}
                  alt={info?.name || String(candidate.code)}
                  className="w-full h-full object-cover pointer-events-none"
                  onError={(e) => {
                    const targetEl = e.currentTarget
                    if (targetEl.src !== UNKNOWN_CARD_IMAGE) {
                      targetEl.src = UNKNOWN_CARD_IMAGE
                    }
                  }}
                />
              </div>
            )}
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-xs text-muted-foreground truncate">
                {info?.name || (candidate ? `#${candidate.code}` : '')}
              </span>
              {options.map((o) => (
                <Button
                  key={o.bit}
                  size="sm"
                  className="h-7 px-3 text-xs justify-start"
                  onClick={() => useDuelStore.getState().chooseEnginePosition(o.bit)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={() => {
        if (prompt.canCancel) cancelEngineSelect()
      }}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isChain ? (
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <Crosshair className="w-4 h-4 shrink-0 text-emerald-500" />
            )}
            <h2 className="font-bold text-sm tracking-tight truncate">{title}</h2>
            <span className="text-xs text-muted-foreground shrink-0">
              {isChain ? '点击卡片发动' : `${countHint}（点击卡片选择）`}
            </span>
          </div>
          {prompt.canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={cancelEngineSelect}
            >
              <X className="w-3.5 h-3.5" />
              {isChain ? '不发动' : '取消'}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 p-4 max-h-[52vh] overflow-y-auto bg-muted/10">
          {prompt.candidates.map((candidate, index) => {
            const chosen = pendingEngineSelect.chosen.includes(index)
            const info = cdb[candidate.code]
            return (
              <button
                key={`${candidate.code}_${candidate.location}_${candidate.sequence}_${index}`}
                type="button"
                onClick={() => commitEngineSelectIndex(index)}
                className={cn(
                  'group flex flex-col items-center w-28 shrink-0 rounded-md border p-1.5 bg-card transition-all cursor-pointer',
                  chosen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/60 shadow-md'
                    : 'border-border/80 hover:border-emerald-500/70 hover:shadow-md'
                )}
              >
                <div className="relative w-24 h-[141px] rounded overflow-hidden shadow border border-border/60 bg-black/30">
                  <img
                    src={getCardImageUrl(candidate.code, true)}
                    alt={info?.name || String(candidate.code)}
                    className="w-full h-full object-cover pointer-events-none"
                    onError={(e) => {
                      const targetEl = e.currentTarget
                      if (targetEl.src !== UNKNOWN_CARD_IMAGE) {
                        targetEl.src = UNKNOWN_CARD_IMAGE
                      }
                    }}
                  />
                  {chosen && (
                    <div className="absolute inset-0 bg-emerald-500/25 flex items-center justify-center">
                      <Check className="w-7 h-7 text-emerald-300 drop-shadow" />
                    </div>
                  )}
                </div>
                <span className="w-full mt-1 text-[10px] leading-tight text-center truncate text-muted-foreground">
                  {info?.name || `#${candidate.code}`}
                </span>
              </button>
            )
          })}
        </div>

        {prompt.max > prompt.min && (
          <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
            <Button
              size="sm"
              disabled={!ready}
              onClick={confirmEngineSelect}
              className="px-5 h-7 text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              确认（{pendingEngineSelect.chosen.length}）
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
