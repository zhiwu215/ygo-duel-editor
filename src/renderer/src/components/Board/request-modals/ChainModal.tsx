import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { LOCATION_NAMES } from '@shared/index'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'
import { cardNameOf, useCardMeta } from './useCardMeta'

export const ChainModal: React.FC<{ request: EngineRequest; data: DataOf<'chain'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.chains)
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? (data.forced ? '存在必须发动的效果' : '选择要连锁发动的卡')}
      width="max-w-lg"
      footer={
        <>
          <Button
            variant="destructive"
            disabled={loading || data.forced}
            title={data.forced ? '存在强制发动的效果，不能放弃连锁' : undefined}
            onClick={() => submitAnswer({ kind: 'chain', card: null })}
          >
            放弃连锁
          </Button>
          <Button
            disabled={loading || selected === null}
            onClick={() =>
              selected !== null && submitAnswer({ kind: 'chain', card: data.chains[selected] })
            }
          >
            <Check />
            发动连锁
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        {data.chains.map((card, index) => {
          const active = selected === index
          return (
            <button
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${card.desc ?? '0'}-${index}`}
              type="button"
              disabled={loading}
              onClick={() => setSelected(index)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-background/60 hover:border-primary/60 hover:bg-muted/40'
              )}
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">
                  {cardNameOf(meta, card.code)}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {LOCATION_NAMES[card.location] ?? '未知区域'}
                </span>
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
        {data.chains.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">没有可以连锁发动的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}
