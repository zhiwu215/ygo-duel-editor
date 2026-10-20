import React from 'react'
import { FieldCard } from '@shared/index'
import { Button } from '../../ui/button'
import { CardImage } from '../../ui/CardImage'
import { cn } from '../../../lib/utils'
import { RequestModalShell } from './RequestModalShell'
import {
  cancelSelection,
  requestCardKey,
  submitSelection,
  requestCardName,
  type DerivedSelection
} from '../../../utils/duelSelection'

export const UnselectCardModal: React.FC<{
  derived: DerivedSelection
  loading: boolean
  cards: FieldCard[]
}> = ({ derived, loading, cards }) => (
  <RequestModalShell
    title="请选择"
    subtitle={derived.canFinish ? '逐张点击选择，完成后点「完成」' : '请选择一张卡'}
    width="max-w-sm"
    footer={
      <>
        {derived.canCancel && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => cancelSelection(derived)}
          >
            取消
          </Button>
        )}
        {derived.canFinish && (
          <Button size="sm" disabled={loading} onClick={() => submitSelection(derived, [])}>
            完成
          </Button>
        )}
      </>
    }
  >
    <div className="flex flex-col">
      {derived.candidates.map((card, index) => (
        <button
          key={`sel-${index}-${requestCardKey(card)}`}
          type="button"
          disabled={loading}
          onClick={() => submitSelection(derived, [card])}
          className="flex cursor-pointer items-center gap-2.5 border-b border-border/50 p-1.5 text-left transition-colors last:border-b-0 hover:bg-muted/60"
        >
          <CardImage
            code={card.code}
            small
            alt={requestCardName(cards, card)}
            className="h-11 w-8 shrink-0 rounded-sm border border-border/60 object-cover"
          />
          <span className="truncate text-xs text-foreground">{requestCardName(cards, card)}</span>
        </button>
      ))}

      {derived.selected.length > 0 && (
        <>
          <div className="mt-2 px-1.5 text-[10px] font-medium text-muted-foreground">
            已选（点击可取消选择）
          </div>
          {derived.selected.map((card, index) => (
            <button
              key={`unsel-${index}-${requestCardKey(card)}`}
              type="button"
              disabled={loading}
              onClick={() => submitSelection(derived, [card])}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 border-b border-border/50 p-1.5 text-left transition-colors last:border-b-0',
                'bg-foreground/[0.06]'
              )}
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
  </RequestModalShell>
)
