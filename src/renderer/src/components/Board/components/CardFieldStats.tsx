import React from 'react'
import {
  FieldCard,
  CardPosition,
  CardUtils,
  isInfiniteVal
} from '@shared/index'
import { cn } from '../../../lib/utils'

interface CardFieldStatsProps {
  card: FieldCard
}

/**
 * 场上卡面攻守数字（neos 风格）：贴在卡格底部，大号描边字，不占额外面板。
 * 当前战斗位置对应的数值更大；被效果修正时按增减着色。
 */
export const CardFieldStats: React.FC<CardFieldStatsProps> = ({ card }) => {
  const cdb = card.card
  const origAtk = cdb?.atk ?? 0
  const origDef = cdb?.def ?? 0
  const customAtk = card.customAtk
  const customDef = card.customDef
  const isAtkInf = isInfiniteVal(customAtk)
  const isDefInf = isInfiniteVal(customDef)
  const effectiveAtk = customAtk ?? origAtk
  const effectiveDef = customDef ?? origDef
  const atkDiff = customAtk !== undefined && origAtk >= 0 ? (isAtkInf ? 1 : customAtk - origAtk) : 0
  const defDiff = customDef !== undefined && origDef >= 0 ? (isDefInf ? 1 : customDef - origDef) : 0

  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const atkText = isAtkInf ? '∞' : effectiveAtk === -2 ? '?' : String(effectiveAtk)
  const defText = isLink ? '' : isDefInf ? '∞' : effectiveDef === -2 ? '?' : String(effectiveDef)

  const valueClass = (diff: number): string =>
    diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-rose-300' : 'text-white'

  return (
    <div
      className="absolute bottom-0.5 left-0 right-0 z-30 flex items-baseline justify-center gap-1 font-mono font-black tabular-nums leading-none tracking-tight pointer-events-none select-none"
      style={{ textShadow: '0 1px 2px #000, 0 0 6px rgba(0,0,0,0.9)', WebkitTextStroke: '0.6px rgba(0,0,0,0.6)' }}
    >
      <span className={cn(isDefense ? 'text-[11px]' : 'text-[13px]', valueClass(atkDiff))}>
        {atkText}
      </span>
      {!isLink && (
        <>
          <span className={cn(isDefense ? 'text-[13px]' : 'text-[11px]', 'text-white/50')}>/</span>
          <span className={cn(isDefense ? 'text-[13px]' : 'text-[11px]', valueClass(defDiff))}>
            {defText}
          </span>
        </>
      )}
    </div>
  )
}
