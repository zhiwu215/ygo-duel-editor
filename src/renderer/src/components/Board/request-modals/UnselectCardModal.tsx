import React from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { FieldCard } from '@shared/index'
import { Button } from '../../ui/button'
import { CardImage } from '../../ui/CardImage'
import { Check, X } from 'lucide-react'
import {
  cancelSelection,
  requestCardKey,
  submitSelection,
  requestCardName,
  type DerivedSelection
} from '../../../utils/duelSelection'

export const UnselectCardModal: React.FC<{
  request: EngineRequest
  derived: DerivedSelection
  loading: boolean
  cards: FieldCard[]
}> = ({ request, derived, loading, cards }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
    <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">{request.title}</h2>
        <span className="text-[11px] text-muted-foreground">
          {derived.canFinish ? '逐张点击选择，完成后点「完成」' : '请选择一张卡'}
        </span>
      </div>

      <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto p-3">
        {derived.candidates.map((card, index) => (
          <button
            key={`sel-${index}-${requestCardKey(card)}`}
            type="button"
            disabled={loading}
            onClick={() => submitSelection(derived, [card])}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-background/60 p-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
          >
            <CardImage
              code={card.code}
              small
              alt={requestCardName(cards, card)}
              className="h-11 w-8 shrink-0 rounded-sm border border-border/60 object-cover"
            />
            <span className="truncate text-xs font-semibold text-foreground">
              {requestCardName(cards, card)}
            </span>
          </button>
        ))}

        {derived.selected.length > 0 && (
          <>
            <div className="mt-1.5 text-[10px] font-bold text-muted-foreground/80">
              已选（点击可取消选择）
            </div>
            {derived.selected.map((card, index) => (
              <button
                key={`unsel-${index}-${requestCardKey(card)}`}
                type="button"
                disabled={loading}
                onClick={() => submitSelection(derived, [card])}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 p-1.5 text-left transition-colors hover:bg-primary/15"
              >
                <CardImage
                  code={card.code}
                  small
                  alt={requestCardName(cards, card)}
                  className="h-11 w-8 shrink-0 rounded-sm border border-border/60 object-cover"
                />
                <span className="truncate text-xs font-semibold text-foreground">
                  {requestCardName(cards, card)}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-3 py-2">
        {derived.canCancel && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => cancelSelection(derived)}
          >
            <X />
            取消
          </Button>
        )}
        {derived.canFinish && (
          <Button size="sm" disabled={loading} onClick={() => submitSelection(derived, [])}>
            <Check />
            完成
          </Button>
        )}
      </div>
    </div>
  </div>
)
