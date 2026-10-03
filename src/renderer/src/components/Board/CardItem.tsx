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
  const { selectedCardId, setSelectedCardId, setHoveredCard } = useDuelStore()
  const { openMenu } = useContextMenuStore()

  const isSelected = selectedCardId === card.instanceId
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  const isHand = card.location === CardLocation.HAND
  const isDeckPile = card.location === CardLocation.DECK || card.location === CardLocation.EXTRA
  // 编排者全知视角：场上盖放渲染半透明卡面+盖放角标 (而非卡背)；仅卡组/额外保留卡背
  const showCardBack = isFacedown && isDeckPile
  const isSetOnField = isFacedown && !isDeckPile && !isHand
  // 手牌一律正常显示卡面；position FACEUP 表示公开手牌，用角标提示
  const isPublicHand = isHand && !isFacedown

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
        if (card.card) setHoveredCard(card.card)
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
        animate={{ rotate: isDefense ? 90 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`relative rounded overflow-hidden shadow-md transition-all ${
          // 正方形格: 卡面按卡牌比例 (59:86) 缩放为 71×104，横置时仅旋转 90° 不再缩放；
          // 竖长格 (手牌/牌堆): 卡面完整填充
          squareCell ? 'w-[68.6%] h-full' : isDefense ? 'w-[68.6%] h-[71%]' : 'w-full h-full'
        } ${
          isSelected
            ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background'
            : 'group-hover:ring-1 group-hover:ring-blue-400/50'
        }`}
      >
        {/* 卡面图 (卡组/额外显示卡背；场上盖放半透明显示卡面；手牌正常显示) */}
        <img
          src={showCardBack ? getCardBack(card.controller) : getCardImageUrl(card.code, true)}
          alt={card.card?.name || String(card.code)}
          className={`w-full h-full object-cover select-none pointer-events-none transition-all ${
            isSetOnField ? 'opacity-60' : ''
          }`}
          onError={(e) => {
            const target = e.currentTarget
            const cardBack = getCardBack(card.controller)
            if (target.src !== cardBack) {
              target.src = cardBack
            }
          }}
        />
      </motion.div>

      {/* 角标锚定在格子上，不随卡片旋转，始终正立可读 */}
      {(isSetOnField || isPublicHand) && (
        <div className="absolute top-1 left-1 bg-black/85 text-amber-300 font-sans text-[8px] font-bold px-1 py-0.5 rounded border border-amber-400/40 shadow backdrop-blur-xs">
          {isSetOnField ? '盖放' : '公开'}
        </div>
      )}

      {/* 额外卡组表侧表示角标 */}
      {card.location === CardLocation.EXTRA && !isFacedown && (
        <div className="absolute top-1 left-1 bg-cyan-600/90 text-white font-sans text-[8px] font-bold px-1 py-0.5 rounded border border-cyan-400/50 shadow backdrop-blur-xs">
          表侧
        </div>
      )}

      {/* 超量素材叠放标识 */}
      {card.overlayMaterials && card.overlayMaterials.length > 0 && (
        <div className="absolute bottom-1 right-1 bg-black/85 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/25 shadow">
          ORU × {card.overlayMaterials.length}
        </div>
      )}

      {/* 指示物标识 */}
      {card.counters && Object.values(card.counters).some((v) => v > 0) && (
        <div className="absolute top-1 right-1 bg-red-950/90 text-red-300 font-mono text-[9px] font-bold px-1 py-0.5 rounded border border-red-500/40">
          ●
        </div>
      )}
    </div>
  )
}
