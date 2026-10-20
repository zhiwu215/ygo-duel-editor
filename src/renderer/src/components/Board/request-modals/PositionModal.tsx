import React from 'react'
import { CardPosition } from '@shared/index'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { getCardBack, getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { cn } from '../../../lib/utils'
import { RequestModalShell } from './RequestModalShell'
import type { DataOf } from './engine'
import { submitAnswer } from './engine'

const POSITION_LABELS: Record<number, string> = {
  [CardPosition.FACEUP_ATTACK]: '表侧攻击',
  [CardPosition.FACEUP_DEFENSE]: '表侧守备',
  [CardPosition.FACEDOWN_DEFENSE]: '里侧守备',
  [CardPosition.FACEDOWN_ATTACK]: '里侧攻击'
}

const POSITION_DEFENSE = new Set<number>([
  CardPosition.FACEUP_DEFENSE,
  CardPosition.FACEDOWN_DEFENSE
])

const POSITION_FACEDOWN = new Set<number>([
  CardPosition.FACEDOWN_ATTACK,
  CardPosition.FACEDOWN_DEFENSE
])

export const PositionModal: React.FC<{ data: DataOf<'position'> }> = ({ data }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const faceImage = data.code && data.code > 0 ? getCardImageUrl(data.code) : UNKNOWN_CARD_IMAGE
  return (
    <RequestModalShell title="请选择表示形式" width="max-w-2xl">
      <div className="flex flex-wrap items-center justify-center gap-3 py-1">
        {data.positions.map((position) => {
          const label = POSITION_LABELS[position] ?? `表示形式 #${position}`
          return (
            <button
              key={position}
              type="button"
              disabled={loading}
              aria-label={label}
              title={label}
              onClick={() => submitAnswer({ kind: 'position', position })}
              className="flex h-[176px] w-[176px] items-center justify-center rounded-md border border-border/70 bg-background/60 transition-colors hover:border-foreground/40 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
            >
              <img
                src={POSITION_FACEDOWN.has(position) ? getCardBack() : faceImage}
                alt={label}
                draggable={false}
                className={cn(
                  'w-[104px] rounded border border-border/60 pointer-events-none',
                  POSITION_DEFENSE.has(position) && 'rotate-90'
                )}
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
            </button>
          )
        })}
      </div>
    </RequestModalShell>
  )
}
