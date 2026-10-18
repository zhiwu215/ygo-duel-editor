import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
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

/**
 * 单行攻守数值：左侧标签，右侧大号数值 + 变动量徽标
 */
const StatLine: React.FC<StatLineProps> = ({
  label,
  value,
  diff,
  infinite,
  emphasized,
  dashed
}) => (
  <div className="flex items-baseline justify-between gap-1.5 leading-none">
    <span className="font-sans text-[8.5px] font-bold tracking-wider text-white/50">{label}</span>
    <span className="flex items-baseline gap-1 font-mono tabular-nums">
      <span
        className={cn(
          'font-bold',
          emphasized ? 'text-[13px]' : 'text-[11px]',
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
            'rounded px-1 text-[8.5px] font-bold',
            diff > 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
          )}
        >
          {infinite ? '+无限' : diff > 0 ? `+${diff}` : diff}
        </span>
      )}
    </span>
  </div>
)

/**
 * YGOPro 风格的半透明战场全息 HUD 浮层
 * 展示卡名、表示形式、攻守数值（含变动徽标）、星阶/种族/属性以及全称指示物列表
 */
export const CardHudOverlay: React.FC<CardHudOverlayProps> = ({ card }) => {
  const customCounters = useDuelStore((s) => s.state.customCounters)
  const cdb = card.card
  const isMonster = cdb ? CardUtils.isMonster(cdb.type) : card.location === CardLocation.MZONE
  const cardName = cdb?.name || (card.code ? String(card.code) : '未知卡片')

  // 攻守与变动
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

  // 星级/种族/属性
  const star = cdb ? CardUtils.getStarLevel(cdb.level, cdb.type) : 0
  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const race = cdb ? RACE_NAMES[cdb.race] || '' : ''
  const attr = cdb ? ATTRIBUTE_NAMES[cdb.attribute] || '' : ''

  // 表示形式 (攻/守/盖)
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  // 指示物列表
  const counterEntries = Object.entries(card.counters || {})
    .filter(([, count]) => count > 0)
    .map(([typeId, count]) => ({
      id: Number(typeId),
      name: resolveCounterName(Number(typeId), customCounters),
      count
    }))

  return (
    <div className="absolute z-40 pointer-events-none select-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-max min-w-[112px] max-w-[136px] bg-black/85 backdrop-blur-xs border border-white/20 rounded-md shadow-2xl px-2 py-1.5 flex flex-col gap-1 text-[10px] leading-tight text-white font-sans animate-in fade-in zoom-in-95 duration-100">
      {/* 表示形式角标 + 卡名 */}
      <div className="flex items-center gap-1 min-w-0">
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
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="font-bold text-left truncate text-[11px] text-white/95 min-w-0">
                {cardName}
              </div>
            }
          />
          <TooltipContent>{cardName}</TooltipContent>
        </Tooltip>
      </div>

      {/* 攻守数值 (仅怪兽；支持无限、? 与变动徽标) */}
      {isMonster && (
        <div className="flex flex-col gap-1 rounded bg-white/5 px-1.5 py-1">
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

      {/* 星阶/种族/属性行 (仅怪兽) */}
      {isMonster && cdb && (
        <div className="text-[9px] text-center text-white/80 truncate">
          {isLink ? `LINK-${star}` : `★${star}`} {race}/{attr}
        </div>
      )}

      {/* 魔法/陷阱类别行 (仅非怪兽) */}
      {!isMonster && cdb && (
        <div className="text-[9px] text-center text-cyan-300/90 truncate">
          {CardUtils.isSpell(cdb.type) ? '魔法卡' : CardUtils.isTrap(cdb.type) ? '陷阱卡' : ''}
        </div>
      )}

      {/* 指示物全称列表行 */}
      {counterEntries.map((c) => (
        <Tooltip key={c.id}>
          <TooltipTrigger
            render={
              <div className="text-[9.5px] font-semibold text-center text-amber-300 truncate">
                [{c.name}]: {c.count}
              </div>
            }
          />
          <TooltipContent>{`[${c.name}]: ${c.count}`}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
