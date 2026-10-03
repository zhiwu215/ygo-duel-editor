import React from 'react'
import {
  FieldCard,
  CardUtils,
  getCounterName,
  RACE_NAMES,
  ATTRIBUTE_NAMES,
  isInfiniteVal
} from '@shared/index'

interface CardHudOverlayProps {
  card: FieldCard
}

/**
 * YGOPro 风格的半透明战场全息 HUD 浮层
 * 展示卡名、攻守数值（支持变动差值高亮与无限 ∞ 展示）、星阶/种族/属性以及全称指示物列表
 */
export const CardHudOverlay: React.FC<CardHudOverlayProps> = ({ card }) => {
  const cdb = card.card
  const isMonster = cdb ? CardUtils.isMonster(cdb.type) : card.location === 4 // MZONE
  const cardName = cdb?.name || (card.code ? String(card.code) : '未知卡片')

  // 攻守与变动
  const origAtk = cdb?.atk ?? 0
  const origDef = cdb?.def ?? 0
  const isAtkInf = isInfiniteVal(card.customAtk)
  const isDefInf = isInfiniteVal(card.customDef)
  const effectiveAtk = card.customAtk !== undefined ? card.customAtk : origAtk
  const effectiveDef = card.customDef !== undefined ? card.customDef : origDef
  const atkDiff =
    card.customAtk !== undefined ? (isAtkInf ? Infinity : card.customAtk - origAtk) : 0
  const defDiff =
    card.customDef !== undefined ? (isDefInf ? Infinity : card.customDef - origDef) : 0

  // 星级/种族/属性
  const star = cdb ? CardUtils.getStarLevel(cdb.level, cdb.type) : 0
  const isXyz = cdb ? CardUtils.isXyz(cdb.type) : false
  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const race = cdb ? RACE_NAMES[cdb.race] || '' : ''
  const attr = cdb ? ATTRIBUTE_NAMES[cdb.attribute] || '' : ''

  // 指示物列表
  const counterEntries = Object.entries(card.counters || {})
    .filter(([, count]) => count > 0)
    .map(([typeId, count]) => ({
      id: Number(typeId),
      name: getCounterName(Number(typeId)),
      count
    }))

  return (
    <div className="absolute z-40 pointer-events-none select-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] min-w-[110px] max-w-[124px] bg-black/85 backdrop-blur-xs border border-white/20 rounded shadow-2xl p-1.5 flex flex-col gap-0.5 text-[10px] leading-tight text-white font-sans animate-in fade-in zoom-in-95 duration-100">
      {/* 卡名 */}
      <div className="font-bold text-center truncate text-[11px] text-white/95" title={cardName}>
        {cardName}
      </div>

      {/* 攻守数值行 (仅怪兽，支持无限 ∞ 与变动高亮) */}
      {isMonster && (
        <div className="font-mono text-center font-bold flex items-center justify-center gap-1">
          <span
            className={
              isAtkInf
                ? 'text-amber-300 font-extrabold'
                : atkDiff > 0
                  ? 'text-emerald-400 font-extrabold'
                  : atkDiff < 0
                    ? 'text-rose-400 font-extrabold'
                    : 'text-white'
            }
          >
            {isAtkInf ? '∞' : origAtk === -2 ? '?' : effectiveAtk}
            {card.customAtk !== undefined && atkDiff !== 0 && (
              <span className="text-[8px] ml-0.5 opacity-90">
                ({isAtkInf ? '+∞' : atkDiff > 0 ? `+${atkDiff}` : atkDiff})
              </span>
            )}
          </span>
          <span className="text-white/60">/</span>
          <span
            className={
              isLink
                ? 'text-white/50'
                : isDefInf
                  ? 'text-amber-300 font-extrabold'
                  : defDiff > 0
                    ? 'text-emerald-400 font-extrabold'
                    : defDiff < 0
                      ? 'text-rose-400 font-extrabold'
                      : 'text-white'
            }
          >
            {isLink ? '-' : isDefInf ? '∞' : origDef === -2 ? '?' : effectiveDef}
            {!isLink && card.customDef !== undefined && defDiff !== 0 && (
              <span className="text-[8px] ml-0.5 opacity-90">
                ({isDefInf ? '+∞' : defDiff > 0 ? `+${defDiff}` : defDiff})
              </span>
            )}
          </span>
        </div>
      )}

      {/* 星阶/种族/属性行 (仅怪兽) */}
      {isMonster && cdb && (
        <div className="text-[9px] text-center text-white/80 truncate">
          {isLink ? `LINK-${star}` : isXyz ? `★${star}` : `★${star}`} {race}/{attr}
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
        <div
          key={c.id}
          className="text-[9.5px] font-semibold text-center text-amber-300 truncate"
          title={`[${c.name}]: ${c.count}`}
        >
          [{c.name}]: {c.count}
        </div>
      ))}
    </div>
  )
}
