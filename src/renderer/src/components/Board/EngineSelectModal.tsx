import React, { useEffect, useState } from 'react'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { enginePromptUsesModal } from '../../utils/ruleCheck'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { Button } from '../ui/button'
import { Check, X, Sparkles, Crosshair } from 'lucide-react'
import { cn } from '../../lib/utils'

export const EngineSelectModal: React.FC = () => {
  const pendingAction = useDuelEngineStore((s) => s.pendingAction)
  const submitAction = useDuelEngineStore((s) => s.submitAction)
  const modal = pendingAction ? enginePromptUsesModal(pendingAction) : false
  const [cdb, setCdb] = useState<Record<number, CdbCard>>({})
  const [selectedState, setSelectedState] = useState<{ key: string; ids: string[] }>({
    key: '',
    ids: []
  })
  const actionKey = pendingAction
    ? `${pendingAction.kind}_${pendingAction.title}_${pendingAction.options[0]?.id ?? ''}`
    : ''
  const chosenIds = selectedState.key === actionKey ? selectedState.ids : []

  useEffect(() => {
    if (!pendingAction || !modal) return
    const cardCodes = pendingAction.options
      .map((o) => o.cardCode)
      .filter((code): code is number => typeof code === 'number' && code > 0)
    if (cardCodes.length === 0) return
    const codes = [...new Set(cardCodes)]
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
  }, [pendingAction, modal])

  if (!pendingAction || !modal) return null

  if (pendingAction.kind === 'SELECT_YESNO' || pendingAction.kind === 'SELECT_EFFECTYN') {
    const yesOpt = pendingAction.options.find((o) => o.type === 'YES')
    const noOpt = pendingAction.options.find((o) => o.type === 'NO')
    return (
      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{pendingAction.title}</h2>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
              {pendingAction.subtitle || '是否发动/执行该效果？'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              {noOpt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-4 text-xs"
                  onClick={() => void submitAction(noOpt.id)}
                >
                  否
                </Button>
              )}
              {yesOpt && (
                <Button
                  size="sm"
                  className="h-8 px-4 text-xs"
                  onClick={() => void submitAction(yesOpt.id)}
                >
                  是
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (pendingAction.kind === 'SELECT_OPTION') {
    return (
      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{pendingAction.title}</h2>
          </div>
          <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {pendingAction.options.map((opt, idx) => (
              <Button
                key={opt.id}
                variant="outline"
                size="sm"
                className="w-full h-auto py-2.5 px-3 text-xs justify-start text-left whitespace-normal leading-relaxed hover:border-emerald-500/70 hover:bg-emerald-500/10"
                onClick={() => void submitAction(opt.id)}
              >
                <span className="font-bold mr-2 text-muted-foreground">{idx + 1}.</span>
                <span>{opt.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (pendingAction.kind === 'SELECT_POSITION') {
    return (
      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Crosshair className="w-4 h-4 shrink-0 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{pendingAction.title}</h2>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {pendingAction.options.map((opt) => (
              <Button
                key={opt.id}
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs justify-start"
                onClick={() => void submitAction(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (pendingAction.kind === 'ANNOUNCE') {
    return (
      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{pendingAction.title}</h2>
          </div>
          <div className="p-3 grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
            {pendingAction.options.map((opt) => (
              <Button
                key={opt.id}
                variant="outline"
                size="sm"
                className="h-8 text-xs truncate"
                onClick={() => void submitAction(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const cancelOpt = pendingAction.options.find(
    (o) => o.type === 'PASS' || o.id === 'select-card-cancel'
  )
  const cardOptions = pendingAction.options.filter(
    (o) => o.type !== 'PASS' && o.id !== 'select-card-cancel'
  )
  const min = pendingAction.min ?? 1
  const max = pendingAction.max ?? 1
  const isMulti = max > 1 || min !== max
  const ready = chosenIds.length >= min

  const handleCardClick = (optId: string): void => {
    if (!isMulti) {
      void submitAction(optId)
      return
    }
    const next = chosenIds.includes(optId)
      ? chosenIds.filter((id) => id !== optId)
      : chosenIds.length < max
        ? [...chosenIds, optId]
        : chosenIds
    setSelectedState({ key: actionKey, ids: next })
  }

  const handleConfirmMulti = (): void => {
    if (!ready || chosenIds.length === 0) return
    const indices = chosenIds
      .map((id) => pendingAction.options.find((o) => o.id === id)?.rawPayload?.index)
      .filter((idx) => typeof idx === 'number')
    void submitAction(chosenIds[0], { indices })
  }

  return (
    <div
      className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={() => {
        if (cancelOpt) void submitAction(cancelOpt.id)
      }}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="w-4 h-4 shrink-0 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight truncate">{pendingAction.title}</h2>
            <span className="text-xs text-muted-foreground shrink-0">
              {pendingAction.subtitle || (min === max ? `${min} 张` : `${min}~${max} 张`)}
            </span>
          </div>
          {cancelOpt && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void submitAction(cancelOpt.id)}
            >
              <X className="w-3.5 h-3.5" />
              取消
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 p-4 max-h-[52vh] overflow-y-auto bg-muted/10">
          {cardOptions.map((opt) => {
            const chosen = chosenIds.includes(opt.id)
            const cardCode = opt.cardCode || 0
            const info = cdb[cardCode]
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleCardClick(opt.id)}
                className={cn(
                  'group flex flex-col items-center w-28 shrink-0 rounded-md border p-1.5 bg-card transition-all cursor-pointer',
                  chosen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/60 shadow-md'
                    : 'border-border/80 hover:border-emerald-500/70 hover:shadow-md'
                )}
              >
                <div className="relative w-24 h-[141px] rounded overflow-hidden shadow border border-border/60 bg-black/30">
                  <img
                    src={getCardImageUrl(cardCode, true)}
                    alt={info?.name || String(cardCode)}
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
                  {info?.name || opt.label || `#${cardCode}`}
                </span>
              </button>
            )
          })}
        </div>

        {isMulti && (
          <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
            <Button
              size="sm"
              disabled={!ready}
              onClick={handleConfirmMulti}
              className="px-5 h-7 text-xs"
            >
              <Check className="w-3.5 h-3.5" />
              确认（{chosenIds.length}）
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
