import React from 'react'
import {
  FieldCard,
  CardLocation,
  CardPosition,
  CardUtils,
  resolveCounterName,
  RACE_NAMES,
  ATTRIBUTE_NAMES,
  isInfiniteVal
} from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { resolveCardName } from '../../../utils/cardNames'
import { cn } from '../../../lib/utils'

interface CardHudOverlayProps {
  card: FieldCard
}

interface StatLineProps {
  label: string
  value: number
  diff: number
  infinite: boolean
  emphasized: boolean
  dashed?: boolean
}

const StatLine: React.FC<StatLineProps> = ({
  label,
  value,
  diff,
  infinite,
  emphasized,
  dashed
}) => (
  <div className="flex items-baseline justify-between gap-1 leading-none">
    <span className="font-sans text-[8px] font-bold tracking-wider text-white/50">{label}</span>
    <span className="flex flex-wrap items-baseline justify-end gap-x-1 gap-y-0.5 font-mono tabular-nums">
      <span
        className={cn(
          'font-bold',
          emphasized ? 'text-[12px]' : 'text-[10px]',
          dashed || infinite || diff === 0
            ? 'text-white/95'
            : diff > 0
              ? 'text-emerald-300'
              : 'text-rose-300'
        )}
      >
        {dashed ? '—' : infinite ? '无限' : value}
      </span>
      {!dashed && diff !== 0 && (
        <span
          className={cn(
            'rounded px-1 text-[8px] font-bold',
            diff > 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
          )}
        >
          {infinite ? '+无限' : diff > 0 ? `+${diff}` : diff}
        </span>
      )}
    </span>
  </div>
)

export const CardHudOverlay: React.FC<CardHudOverlayProps> = ({ card }) => {
  const customCounters = useDuelStore((s) => s.state.customCounters)
  const cdb = card.card
  const isMonster = cdb ? CardUtils.isMonster(cdb.type) : card.location === CardLocation.MZONE
  const cardName = resolveCardName(card.code)

  const origAtk = cdb?.atk ?? 0
  const origDef = cdb?.def ?? 0
  const customAtk = card.customAtk
  const customDef = card.customDef
  const hasCustomAtk = customAtk !== undefined
  const hasCustomDef = customDef !== undefined
  const isAtkInf = isInfiniteVal(customAtk)
  const isDefInf = isInfiniteVal(customDef)
  const effectiveAtk = customAtk ?? origAtk
  const effectiveDef = customDef ?? origDef
  const atkDiff = hasCustomAtk && origAtk >= 0 ? (isAtkInf ? Infinity : customAtk - origAtk) : 0
  const defDiff = hasCustomDef && origDef >= 0 ? (isDefInf ? Infinity : customDef - origDef) : 0

  const star = cdb ? CardUtils.getStarLevel(cdb.level, cdb.type) : 0
  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const race = cdb ? RACE_NAMES[cdb.race] || '' : ''
  const attr = cdb ? ATTRIBUTE_NAMES[cdb.attribute] || '' : ''

  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  const counterEntries = Object.entries(card.counters || {})
    .filter(([, count]) => count > 0)
    .map(([typeId, count]) => ({
      id: Number(typeId),
      name: resolveCounterName(Number(typeId), customCounters),
      count
    }))

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-max min-w-[92px] max-w-[104px] bg-black/85 backdrop-blur-xs border border-white/20 rounded-md shadow-2xl px-1 py-1.5 flex flex-col gap-1 text-[10px] leading-tight text-white font-sans pointer-events-none select-none animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-start gap-1 min-w-0">
        {isMonster && (
          <span
            className={cn(
              'shrink-0 rounded px-1 text-[8.5px] font-bold leading-none py-0.5',
              isFacedown
                ? 'bg-amber-400/20 text-amber-300'
                : isDefense
                  ? 'bg-sky-400/20 text-sky-300'
                  : 'bg-rose-400/20 text-rose-300'
            )}
          >
            {isFacedown ? '盖' : isDefense ? '守' : '攻'}
          </span>
        )}
        <div className="font-bold text-left text-[10.5px] text-white/95 min-w-0 line-clamp-2 break-words">
          {cardName}
        </div>
      </div>

      {isMonster && (
        <div className="flex flex-col gap-1 rounded bg-white/5 px-1 py-1">
          <StatLine
            label="ATK"
            value={effectiveAtk}
            diff={atkDiff}
            infinite={isAtkInf}
            emphasized={!isDefense}
          />
          {!isLink && (
            <StatLine
              label="DEF"
              value={effectiveDef}
              diff={defDiff}
              infinite={isDefInf}
              emphasized={isDefense}
            />
          )}
        </div>
      )}

      {isMonster && cdb && (
        <div className="text-[9px] text-center text-white/80 truncate">
          {isLink ? `LINK-${star}` : `★${star}`} {race}/{attr}
        </div>
      )}

      {!isMonster && cdb && (
        <div className="text-[9px] text-center text-cyan-300/90 truncate">
          {CardUtils.isSpell(cdb.type) ? '魔法卡' : CardUtils.isTrap(cdb.type) ? '陷阱卡' : ''}
        </div>
      )}

      {counterEntries.map((c) => (
        <div key={c.id} className="text-[9.5px] font-semibold text-center text-amber-300 truncate">
          [{c.name}]: {c.count}
        </div>
      ))}
    </div>
  )
}
