import React from 'react'
import { motion } from 'framer-motion'
import { FieldCard, CardPosition, CardLocation } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'

interface CardItemProps {
  card: FieldCard
}

export const CardItem: React.FC<CardItemProps> = ({ card }) => {
  const { selectedCardId, setSelectedCardId, setHoveredCard } = useDuelStore()
  const { openMenu } = useContextMenuStore()

  const isSelected = selectedCardId === card.instanceId
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  const isHand = card.location === CardLocation.HAND
  // 手牌即使为里侧未公开，在编辑器中也半透展示卡面+里侧角标，方便作者构筑剧情
  const isHandFacedown = isHand && isFacedown
  // 仅场上覆盖才渲染纯卡背
  const showCardBack = isFacedown && !isHandFacedown

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
          isDefense ? 'w-[75%] h-[95%]' : 'w-full h-full'
        } ${
          isSelected
            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background'
            : 'group-hover:ring-1 group-hover:ring-primary/60'
        }`}
      >
        {/* 卡面图 (场上里侧显示卡背；手牌里侧半透显示卡面) */}
        <img
          src={showCardBack ? CARD_BACK_IMAGE : getCardImageUrl(card.code, true)}
          alt={card.card?.name || String(card.code)}
          className={`w-full h-full object-cover select-none pointer-events-none transition-all ${
            isHandFacedown ? 'brightness-75 saturate-75 contrast-110' : ''
          }`}
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== CARD_BACK_IMAGE) {
              target.src = CARD_BACK_IMAGE
            }
          }}
        />

        {/* 里侧 / 盖放角标标识 */}
        {isFacedown && (
          <div className="absolute top-1 left-1 bg-black/85 text-amber-300 font-sans text-[8px] font-bold px-1 py-0.5 rounded border border-amber-400/40 shadow backdrop-blur-xs">
            {isHand ? '里侧' : '盖'}
          </div>
        )}

        {/* 超量素材叠放标识 */}
        {card.overlayMaterials && card.overlayMaterials.length > 0 && (
          <div className="absolute bottom-1 right-1 bg-neutral-900/90 text-amber-300 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-400/40 shadow">
            ORU × {card.overlayMaterials.length}
          </div>
        )}

        {/* 指示物标识 */}
        {card.counters && Object.values(card.counters).some((v) => v > 0) && (
          <div className="absolute top-1 right-1 bg-red-950/90 text-red-300 font-mono text-[9px] font-bold px-1 py-0.2 rounded border border-red-500/40">
            ●
          </div>
        )}
      </motion.div>
    </div>
  )
}
