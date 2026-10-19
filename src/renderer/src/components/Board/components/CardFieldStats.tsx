import React from 'react'
import { FieldCard, CardPosition, CardUtils } from '@shared/index'
import { getEffectiveStats } from '../../../utils/cardStats'
import { cn } from '../../../lib/utils'

interface CardFieldStatsProps {
  card: FieldCard
}

export const CardFieldStats: React.FC<CardFieldStatsProps> = ({ card }) => {
  const cdb = card.card
  const stats = getEffectiveStats(card)
  const isAtkInf = stats.isAtkInf
  const isDefInf = stats.isDefInf

  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const atkText = isAtkInf ? '∞' : stats.atk === -2 ? '?' : String(stats.atk)
  const defText = isLink ? '' : isDefInf ? '∞' : stats.def === -2 ? '?' : String(stats.def)

  const valueClass = (diff: number): string =>
    diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-rose-300' : 'text-white'

  return (
    <div
      className="absolute bottom-0.5 left-0 right-0 z-30 flex items-baseline justify-center gap-1 font-mono font-black tabular-nums leading-none tracking-tight pointer-events-none select-none"
      style={{
        textShadow: '0 1px 2px #000, 0 0 6px rgba(0,0,0,0.9)',
        WebkitTextStroke: '0.6px rgba(0,0,0,0.6)'
      }}
    >
      <span className={cn(isDefense ? 'text-[11px]' : 'text-[13px]', valueClass(stats.atkDiff))}>
        {atkText}
      </span>
      {!isLink && (
        <>
          <span className={cn(isDefense ? 'text-[13px]' : 'text-[11px]', 'text-white/50')}>/</span>
          <span
            className={cn(isDefense ? 'text-[13px]' : 'text-[11px]', valueClass(stats.defDiff))}
          >
            {defText}
          </span>
        </>
      )}
    </div>
  )
}
