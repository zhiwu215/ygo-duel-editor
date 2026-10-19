import React, { useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'
import { cardNameOf, useCardMeta } from './useCardMeta'

export const SortModal: React.FC<{ request: EngineRequest; data: DataOf<'sort'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
  const [order, setOrder] = useState<number[]>(() => data.cards.map((_, index) => index))

  const move = (position: number, delta: number): void => {
    const target = position + delta
    if (target < 0 || target >= order.length) return
    setOrder((current) => {
      const next = [...current]
      const [item] = next.splice(position, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? '从上到下为返回顺序'}
      width="max-w-lg"
      footer={
        <>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => submitAnswer({ kind: 'sort', cards: null })}
          >
            不排序
          </Button>
          <Button
            disabled={loading}
            onClick={() =>
              submitAnswer({
                kind: 'sort',
                cards: order.map((index) => data.cards[index])
              })
            }
          >
            <Check />
            确认顺序
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        {order.map((cardIndex, position) => {
          const card = data.cards[cardIndex]
          return (
            <div
              key={`${cardIndex}-${card.code}-${card.controller}-${card.location}-${card.sequence}`}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/60 p-1.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                {position + 1}
              </span>
              <img
                src={getCardImageUrl(card.code, true)}
                alt={cardNameOf(meta, card.code)}
                className="h-11 w-8 shrink-0 rounded border border-border/60 object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {cardNameOf(meta, card.code)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={loading || position === 0}
                  onClick={() => move(position, -1)}
                  aria-label="上移"
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={loading || position === order.length - 1}
                  onClick={() => move(position, 1)}
                  aria-label="下移"
                >
                  <ChevronDown />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </RequestModalShell>
  )
}
