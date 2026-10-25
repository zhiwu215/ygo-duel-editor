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
  const [choosing, setChoosing] = useState(data.forced)

  const pass = (): void => submitAnswer({ kind: 'chain', card: null })

  if (data.chains.length === 0) {
    return (
      <RequestModalShell
        title={request.title}
        width="max-w-sm"
        footer={
          <Button size="sm" disabled={loading} onClick={pass}>
            不连锁
          </Button>
        }
      >
        <p className="text-xs leading-relaxed text-foreground">没有可以连锁发动的卡片</p>
      </RequestModalShell>
    )
  }

  if (!choosing) {
    return (
      <RequestModalShell
        title={request.title}
        width="max-w-sm"
        footer={
          <>
            <Button size="sm" disabled={loading} onClick={() => setChoosing(true)}>
              是
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={pass}>
              否
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <p className="text-xs leading-relaxed text-foreground">是否进行连锁？</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            可连锁：{data.chains.map((card) => cardNameOf(meta, card.code)).join('、')}
          </p>
        </div>
      </RequestModalShell>
    )
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={data.forced ? '存在必须发动的效果' : undefined}
      width="max-w-sm"
      footer={
        <>
          {!data.forced && (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setSelected(null)
                setChoosing(false)
              }}
            >
              返回
            </Button>
          )}
          <Button
            size="sm"
            disabled={loading || selected === null}
            onClick={() =>
              selected !== null && submitAnswer({ kind: 'chain', card: data.chains[selected] })
            }
          >
            发动
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
      </div>
    </RequestModalShell>
  )
}
