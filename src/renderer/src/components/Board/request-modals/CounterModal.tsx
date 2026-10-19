import React, { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { COUNTER_DEFINITIONS } from '@shared/index'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'
import { cardNameOf, useCardMeta } from './useCardMeta'

export const CounterModal: React.FC<{ request: EngineRequest; data: DataOf<'counter'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
  const [counts, setCounts] = useState<number[]>(() => data.cards.map(() => 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const counterName =
    COUNTER_DEFINITIONS.find((entry) => entry.id === data.counterType)?.name ??
    `指示物 #${data.counterType}`

  const maxOf = (index: number): number => {
    const own = data.cards[index]?.counterCount
    return Math.max(0, Math.min(own ?? data.counterCount, data.counterCount))
  }

  const setCount = (index: number, value: number): void => {
    setCounts((prev) => {
      const others = prev.reduce((sum, count, i) => (i === index ? sum : sum + count), 0)
      const capacity = Math.max(0, data.counterCount - others)
      const next = [...prev]
      next[index] = Math.max(0, Math.min(Math.trunc(value) || 0, maxOf(index), capacity))
      return next
    })
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={`${counterName} · ${data.counterCount} 个`}
      width="max-w-xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已取除 {total} / {data.counterCount}
          </span>
          <Button
            disabled={loading || total !== data.counterCount}
            onClick={() =>
              submitAnswer({
                kind: 'counter',
                counters: data.cards
                  .map((card, index) => ({ card, count: counts[index] ?? 0 }))
                  .filter((entry) => entry.count > 0)
              })
            }
          >
            <Check />
            确认取除
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {data.cards.map((card, index) => {
          const max = maxOf(index)
          const count = counts[index] ?? 0
          return (
            <div
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-2"
            >
              <img
                src={getCardImageUrl(card.code, true)}
                alt={cardNameOf(meta, card.code)}
                className="h-[72px] w-[52px] shrink-0 rounded border border-border/60 object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{cardNameOf(meta, card.code)}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">可取除 {max} 个</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={loading || count <= 0}
                  onClick={() => setCount(index, count - 1)}
                  aria-label="减少"
                >
                  <Minus />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  value={count}
                  disabled={loading}
                  className="h-8 w-14 text-center text-xs"
                  onChange={(e) => setCount(index, Number(e.target.value))}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={loading || count >= max || total >= data.counterCount}
                  onClick={() => setCount(index, count + 1)}
                  aria-label="增加"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </RequestModalShell>
  )
}
