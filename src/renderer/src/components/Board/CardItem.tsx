import React from 'react'
import { motion } from 'framer-motion'
import { FieldCard, CardPosition, CardLocation } from '@shared/index'
import { getCardImageUrl, getCardBack } from '../../utils/cardImage'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'

interface CardItemProps {
  card: FieldCard
  /** 宿主格子是否为正方形 (场上交互格)。正方形格中竖卡与横卡共用同一盒子尺寸 */
  squareCell?: boolean
}

export const CardItem: React.FC<CardItemProps> = ({ card, squareCell = false }) => {
  const { selectedCardId, setSelectedCardId, setHoveredCard, setHoveredInstanceId } = useDuelStore()
  const { openMenu } = useContextMenuStore()

  const isSelected = selectedCardId === card.instanceId
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  const isHand = card.location === CardLocation.HAND
  const isDeckPile = card.location === CardLocation.DECK || card.location === CardLocation.EXTRA
  // 编排者全知视角：场上盖放渲染清晰卡面+轻微光影+盖放角标 (而非卡背)；仅卡组/额外保留卡背
  const showCardBack = isFacedown && isDeckPile
  const isSetOnField = isFacedown && !isDeckPile && !isHand
  // 手牌一律正常显示卡面；position FACEUP 表示公开手牌，用角标提示
  const isPublicHand = isHand && !isFacedown

  // 外层格子尺寸 104x104 (正方形) 或 74x104 (竖长格)
  // 当正方形格横置 (isDefense) 时，卡片视觉为 104x71.3，纵向居中 (top 留白约 16.3px)
  // 当正方形格竖置 (!isDefense) 时，卡片视觉为 71.3x104，横向居中 (left 留白约 16.3px)
  // 角标统一在外层无旋转容器中定位，永不被卡牌自身的 overflow-hidden 裁切，文字永远水平正立
  const badgePos = squareCell
    ? isDefense
      ? { top: 18, left: 3 }
      : { top: 3, left: 18 }
    : { top: 3, left: 3 }

  const oruPos = squareCell
    ? isDefense
      ? { bottom: 18, right: 3 }
      : { bottom: 3, right: 18 }
    : { bottom: 3, right: 3 }

  const counterPos = squareCell
    ? isDefense
      ? { top: 18, right: 3 }
      : { top: 3, right: 18 }
    : { top: 3, right: 3 }

  return (
    <div
      draggable
      onDragStart={(e) => {
        if (card.card) {
          e.dataTransfer.setData('application/json', JSON.stringify(card.card))
          e.dataTransfer.setData('text/instanceId', card.instanceId)
          e.dataTransfer.effectAllowed = 'copyMove'
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        setSelectedCardId(card.instanceId)
        if (card.card) setHoveredCard(card.card)
      }}
      onMouseEnter={() => {
        setHoveredInstanceId(card.instanceId)
      }}
      onMouseLeave={() => {
        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
          setHoveredInstanceId(null)
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setSelectedCardId(card.instanceId)
        if (card.card) setHoveredCard(card.card)
        openMenu(card, e.clientX, e.clientY)
      }}
      className="w-full h-full relative flex items-center justify-center cursor-grab active:cursor-grabbing group select-none"
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDefense ? 90 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`relative rounded overflow-hidden shadow-md ${
          // 正方形格: 卡面按卡牌比例 (59:86) 缩放为 71×104，横置时仅旋转 90° 不再缩放；
          // 竖长格 (手牌/牌堆): 卡面完整填充
          squareCell ? 'w-[68.6%] h-full' : isDefense ? 'w-[68.6%] h-[71%]' : 'w-full h-full'
        } ${
          isSelected
            ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background'
            : 'group-hover:ring-1 group-hover:ring-blue-400/50'
        }`}
      >
        {/* 卡面图 (卡组/额外显示卡背；场上盖放清晰显示卡面；手牌正常显示) */}
        <img
          src={showCardBack ? getCardBack(card.controller) : getCardImageUrl(card.code, true)}
          alt={card.card?.name || String(card.code)}
          className="w-full h-full object-cover select-none pointer-events-none"
          onError={(e) => {
            const target = e.currentTarget
            const cardBack = getCardBack(card.controller)
            if (target.src !== cardBack) {
              target.src = cardBack
            }
          }}
        />

        {/* 里侧盖放指示边框与轻微阴影 (彻底移除模糊，保留原生高清卡面，适度调暗并带琥珀内边框) */}
        {isSetOnField && (
          <div className="absolute inset-0 bg-black/25 border border-amber-400/50 rounded pointer-events-none" />
        )}
      </motion.div>

      {/* 状态徽标 (盖放/公开) - 位于外层无旋转容器，平滑跟随卡牌旋转并保持水平正立，不被裁切 */}
      {(isSetOnField || isPublicHand) && (
        <motion.div
          initial={false}
          animate={{ top: badgePos.top, left: badgePos.left }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-black/90 text-amber-300 font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400/50 shadow-md flex items-center gap-1 select-none whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{isSetOnField ? '盖放' : '公开'}</span>
          </div>
        </motion.div>
      )}

      {/* 额外卡组表侧表示角标 */}
      {card.location === CardLocation.EXTRA && !isFacedown && (
        <motion.div
          initial={false}
          animate={{ top: badgePos.top, left: badgePos.left }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-cyan-600/90 text-white font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-cyan-400/50 shadow-md select-none">
            表侧
          </div>
        </motion.div>
      )}

      {/* 超量素材叠放标识 (外层无旋转容器，横置自适应右下角) */}
      {card.overlayMaterials && card.overlayMaterials.length > 0 && (
        <motion.div
          initial={false}
          animate={{ bottom: oruPos.bottom, right: oruPos.right }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-black/90 text-amber-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400/50 shadow-md flex items-center gap-0.5 select-none whitespace-nowrap">
            <span>●</span>
            <span>{card.overlayMaterials.length}</span>
          </div>
        </motion.div>
      )}

      {/* 指示物标识 (外层无旋转容器，横置自适应右上角) */}
      {card.counters && Object.values(card.counters).some((v) => v > 0) && (
        <motion.div
          initial={false}
          animate={{ top: counterPos.top, right: counterPos.right }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="bg-red-950/90 text-red-300 font-mono text-[9px] font-bold px-1 py-0.5 rounded border border-red-500/40 select-none whitespace-nowrap shadow-md">
            ●
          </div>
        </motion.div>
      )}
    </div>
  )
}
