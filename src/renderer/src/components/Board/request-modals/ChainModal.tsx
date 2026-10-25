import React, { useState } from 'react'
import { LOCATION_NAMES } from '@shared/index'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
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
      subtitle={data.forced ? '存在必须发动的效果' : undefined}
      width="max-w-sm"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || data.forced}
            onClick={() => submitAnswer({ kind: 'chain', card: null })}
          >
            放弃连锁
          </Button>
          <Button
            size="sm"
            disabled={loading || selected === null}
            onClick={() =>
              selected !== null && submitAnswer({ kind: 'chain', card: data.chains[selected] })
            }
          >
            发动连锁
          </Button>
        </>
      }
    >
      <div className="flex flex-col">
        {data.chains.map((card, index) => {
          const active = selected === index
          return (
            <button
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
              type="button"
              disabled={loading}
              onClick={() => setSelected(index)}
              className={cn(
                'flex items-center gap-2 border-b border-border/50 px-1.5 py-[7px] text-left text-xs leading-snug transition-colors last:border-b-0',
                active ? 'bg-foreground/[0.06]' : 'hover:bg-muted/60'
              )}
            >
              <span
                className={cn(
                  'h-3.5 w-0.5 shrink-0 rounded-full',
                  active ? 'bg-foreground' : 'bg-transparent'
                )}
              />
              <span className={cn('min-w-0 flex-1 truncate', active && 'font-semibold')}>
                {cardNameOf(meta, card.code)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {LOCATION_NAMES[card.location] ?? '未知区域'}
              </span>
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
