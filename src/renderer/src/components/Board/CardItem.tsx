import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { FieldCard, CardPosition, CardLocation, CardUtils } from '@shared/index'
import { getCardImageUrl, getCardBack } from '../../utils/cardImage'
import { getLegalTargetIds } from '../../utils/duelActionTargets'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { CardHudOverlay } from './components/CardHudOverlay'
import { cn } from '../../lib/utils'

export const HAND_REORDER_DRAG_TYPE = 'application/x-ygo-hand-reorder'

interface CardItemProps {
  card: FieldCard
  /** 宿主格子是否为正方形 (场上交互格)。正方形格中竖卡与横卡共用同一盒子尺寸 */
  squareCell?: boolean
}

export const CardItem: React.FC<CardItemProps> = ({ card, squareCell = false }) => {
  const {
    selectedCardId,
    activeStatPopoverCardId,
    statPopoverPosition,
    setSelectedCardId,
    openStatPopover,
    closeStatPopover,
    setHoveredCard,
    setHoveredInstanceId
  } = useDuelStore()
  const tacticalView = useDuelStore((s) => s.tacticalView)
  const toggleActionTarget = useDuelStore((s) => s.toggleActionTarget)
  const pendingRole = useDuelStore((s): 'none' | 'source' | 'chosen' | 'legal' | 'dim' => {
    const p = s.pendingAction
    if (!p) return 'none'
    if (p.sourceId === card.instanceId) return 'source'
    if (p.targetIds.includes(card.instanceId)) return 'chosen'
    if (getLegalTargetIds(s.state.cards, p).includes(card.instanceId)) return 'legal'
    return 'dim'
  })
  const { openMenu } = useContextMenuStore()
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const openPile = usePileListStore((s) => s.openPile)

  const isSelected = selectedCardId === card.instanceId
  const isDefense =
    card.position === CardPosition.FACEUP_DEFENSE || card.position === CardPosition.FACEDOWN_DEFENSE
  const isFacedown =
    card.position === CardPosition.FACEDOWN || card.position === CardPosition.FACEDOWN_DEFENSE

  // 检查是否为超量怪兽与素材数量
  const isXyzMonster = card.card ? CardUtils.isXyz(card.card.type) : false
  const materialCount = card.overlayMaterials?.length || 0
  const isMonsterZone = card.location === CardLocation.MZONE
  // 超量怪兽在怪兽区哪怕素材为 0 也显示徽标；非超量怪兽若叠放了素材也显示
  const showOverlayBadge = isMonsterZone && (isXyzMonster || materialCount > 0)

  // 是否为怪兽卡
  const isMonster = card.card
    ? CardUtils.isMonster(card.card.type)
    : card.location === CardLocation.MZONE

  // 是否挂载了指示物
  const hasCounters = !!(card.counters && Object.values(card.counters).some((v) => v > 0))

  // 场上交互区域判定 (怪兽区、魔陷区、场地、灵摆区)
  const isFieldZone =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE

  // 战术全息透视浮层 (Tab 键激活)：
  // 1. 场上所有怪兽卡默认全部展示实战数据 (卡名、攻守、星阶/种族/属性、指示物)
  // 2. 魔法陷阱卡平时不展示，仅当真正挂载了指示物时才亮起展示指示物数据
  const showHud = tacticalView && isFieldZone && (isMonster || hasCounters)

  // 若卡片缺少 CDB 详情数据，自动补全缓存以准确识别超量类型
  useEffect(() => {
    if (!card.card && card.code) {
      window.api
        .getCardsByIds([card.code])
        .then((map) => {
          const cardData = map[card.code]
          if (cardData) {
            useDuelStore.getState().setCardData(card.instanceId, cardData)
          }
        })
        .catch((err) => {
          void err
        })
    }
  }, [card.instanceId, card.code, card.card])

  const isHand = card.location === CardLocation.HAND
  const isPileZone =
    card.location === CardLocation.DECK ||
    card.location === CardLocation.EXTRA ||
    card.location === CardLocation.GRAVE ||
    card.location === CardLocation.REMOVED
  const isDeckPile = card.location === CardLocation.DECK || card.location === CardLocation.EXTRA
  // 编排者全知视角：里侧卡片一律渲染清晰卡面 + 暗化蒙版 (而非模糊或纯卡背)，
  // 编排时需要直接看清卡图，卡背会挡住信息。
  // - 主卡组 / 额外卡组：同属「里侧备着」语义，都用与盖放一致的暗化卡面；
  // - 但都**不打「盖放」角标** —— 那是场上盖放的专属标记，卡组打上会被读成一张被盖放的卡。
  //   （卡组被效果翻成表侧时 position 变表侧，暗化自然消失，角标语义不会被占用）
  const isPileFacedown = isFacedown && isDeckPile
  const isSetOnField = isFacedown && !isDeckPile && !isHand
  /** 暗化蒙版：场上盖放 + 主卡组/额外卡组里侧 */
  const showFacedownVeil = isSetOnField || isPileFacedown
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

  return (
    <div
      draggable
      onDragStart={(e) => {
        if (card.location === CardLocation.HAND) {
          e.dataTransfer.setData(HAND_REORDER_DRAG_TYPE, card.instanceId)
          const rect = e.currentTarget.getBoundingClientRect()
          e.dataTransfer.setDragImage(
            e.currentTarget,
            e.clientX - rect.left,
            e.clientY - rect.top
          )
        }
        e.dataTransfer.setData('text/instanceId', card.instanceId)
        if (card.card) {
          e.dataTransfer.setData('application/json', JSON.stringify(card.card))
        }
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (pendingRole === 'source') {
          useDuelStore.getState().cancelPendingAction()
          return
        }
        if (pendingRole === 'legal' || pendingRole === 'chosen') {
          toggleActionTarget(card.instanceId)
          return
        }
        if (pendingRole === 'dim') return
        setSelectedCardId(card.instanceId)
        if (card.card) setHoveredCard(card.card)
        if (e.shiftKey) {
          // Shift + 鼠标左键点击：切换打开/关闭独立操作面板
          if (activeStatPopoverCardId === card.instanceId) {
            closeStatPopover()
          } else {
            const rect = e.currentTarget.getBoundingClientRect()
            const isRight = rect.right > window.innerWidth - 270
            const defaultX = isRight ? Math.max(16, rect.left - 248 - 12) : rect.right + 12
            const defaultY = Math.max(16, Math.min(rect.top - 20, window.innerHeight - 380))
            openStatPopover(card.instanceId, statPopoverPosition || { x: defaultX, y: defaultY })
          }
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (showOverlayBadge) {
          openOverlayList(card.instanceId)
        } else if (isPileZone) {
          openPile(card.controller, card.location)
        }
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
      title={
        showOverlayBadge
          ? `双击查看超量素材列表 (当前 ${materialCount} 张)`
          : isPileZone
            ? '双击查看卡片列表'
            : undefined
      }
      className={cn(
        'w-full h-full relative flex items-center justify-center cursor-grab active:cursor-grabbing group select-none',
        pendingRole === 'dim' && 'opacity-25',
        pendingRole === 'legal' && 'cursor-crosshair'
      )}
    >
      <div
        className={`relative ${
          // 正方形格: 卡面按卡牌比例 (59:86) 缩放为 71×104，横置时仅旋转 90° 不再缩放；
          // 竖长格 (手牌/牌堆): 卡面完整填充
          squareCell ? 'w-[68.6%] h-full' : isDefense ? 'w-[68.6%] h-[71%]' : 'w-full h-full'
        }`}
      >
        {/* 超量素材叠放层 (超量素材不具有表示形式，始终保持纵向正立，不随怪兽守备表示横置而旋转！) */}
        {card.location === CardLocation.MZONE &&
          card.overlayMaterials &&
          card.overlayMaterials.length > 0 &&
          card.overlayMaterials.map((matCode, idx) => {
            const count = card.overlayMaterials.length
            // 距离顶层怪兽最近的素材 (idx = count - 1) 偏移 1 个 step，更底层的依次向左多偏移 1 个 step
            const depth = count - 1 - idx
            // 阶梯式向左错位露出卡边与边角，每层错开 4.5px (超出 3 层时微调步长避免溢出格子)
            const step = count > 3 ? 14 / count : 4.5
            const xOffset = -((depth + 1) * step)

            return (
              <div
                key={`oru_${matCode}_${idx}`}
                className="absolute inset-0 rounded overflow-hidden shadow-sm border border-neutral-900/60 pointer-events-none select-none bg-black/40"
                style={{
                  transform: `translateX(${xOffset}px)`,
                  zIndex: idx + 1
                }}
              >
                <img
                  src={getCardImageUrl(matCode, true)}
                  alt={`ORU-${matCode}`}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  onError={(e) => {
                    const target = e.currentTarget
                    const cardBack = getCardBack(card.controller)
                    if (target.src !== cardBack) {
                      target.src = cardBack
                    }
                  }}
                />
                {/* 底部素材微弱暗色，烘托立体叠放层次 */}
                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              </div>
            )
          })}

        {/* 顶层主怪兽卡片 (仅主怪兽随守备表示旋转 90 度，底层素材保持正立) */}
        <motion.div
          initial={false}
          animate={{ rotate: isDefense ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`relative w-full h-full rounded overflow-hidden shadow-md ${
            pendingRole === 'source'
              ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background'
              : pendingRole === 'chosen'
                ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-background'
                : pendingRole === 'legal'
                  ? 'ring-2 ring-emerald-400/80 ring-offset-1 ring-offset-background'
                  : isSelected
                    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background'
                    : 'group-hover:ring-1 group-hover:ring-blue-400/50'
          }`}
          style={{ zIndex: (card.overlayMaterials?.length || 0) + 2 }}
        >
          {/* 卡面图 (卡组/额外卡组里侧显示暗化卡面；场上盖放显示暗化卡面；手牌正常显示) */}
          <img
            src={getCardImageUrl(card.code, true)}
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

          {/* 里侧指示边框与暗化蒙版 (彻底移除模糊，保留原生高清卡面，适度调暗并带琥珀内边框) */}
          {showFacedownVeil && (
            <div className="absolute inset-0 bg-black/25 border border-amber-400/50 rounded pointer-events-none" />
          )}
        </motion.div>
      </div>

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

      {/* 超量素材叠放标识 (外层无旋转容器，横置自适应右下角，超量怪兽即使 0 素材也显示 0) */}
      {showOverlayBadge && (
        <motion.div
          initial={false}
          animate={{ bottom: oruPos.bottom, right: oruPos.right }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-20 pointer-events-auto cursor-pointer group/oru"
          onClick={(e) => {
            e.stopPropagation()
            openOverlayList(card.instanceId)
          }}
          title={`点击查看超量素材列表 (当前 ${materialCount} 张)`}
        >
          <div
            className={cn(
              'font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-md flex items-center gap-1 select-none whitespace-nowrap transition-transform group-hover/oru:scale-110 active:scale-95',
              materialCount > 0
                ? 'bg-black/90 group-hover/oru:bg-black text-amber-400 border-amber-400/50 group-hover/oru:border-amber-300'
                : 'bg-black/85 group-hover/oru:bg-black text-amber-400/80 border-amber-400/40 group-hover/oru:border-amber-300/80'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full bg-amber-400 inline-block',
                materialCount > 0 ? 'animate-pulse' : 'opacity-70'
              )}
            />
            <span>{materialCount}</span>
          </div>
        </motion.div>
      )}

      {/* 战术全息状态 HUD (Tab 战术透视或鼠标悬停有状态卡片时显示) */}
      {showHud && <CardHudOverlay card={card} />}
    </div>
  )
}
