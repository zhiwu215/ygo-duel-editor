import React, { useState, useRef, useEffect } from 'react'
import { FieldCard, CdbCard, CardLocation, CardPosition, CardUtils } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDropHintStore } from '../../stores/useDropHintStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { CardItem } from './CardItem'
import { getDropPosOverride } from '../../utils/zoneDrop'
import { Swords, Sparkles, Hexagon, Globe, Ghost, Layers, ShieldAlert, Ban } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ZoneColorVariant =
  | 'monster'
  | 'spell'
  | 'emz'
  | 'field'
  | 'grave'
  | 'deck'
  | 'extra'
  | 'removed'
  | 'special'
  | 'pendulum-blue'
  | 'pendulum-red'

interface ZoneSlotProps {
  label: string
  controller: 0 | 1
  location: number
  sequence: number
  card?: FieldCard
  count?: number // 堆叠张数 (如卡组/墓地/额外卡组)
  isPendulum?: boolean // 是否为灵摆标记位 (MR4/5 的 0/4 号魔陷位，或 MR3 的独立灵摆区)
  pendulumDirection?: 'left' | 'right' // 灵摆箭头指向 (左向 ◀ 或右向 ▶)
  colorVariant?: ZoneColorVariant
  className?: string
  duelistId?: string // 归属决斗者 ID (手牌格强绑定)
}

interface VariantConfig {
  border: string
  bg: string
  shadow: string
  text: string
  icon: React.ComponentType<{ className?: string }>
}

// 中性统一基调：槽位本体具备清晰的桌垫槽位质感，区域类型靠图标+标签区分；
// 语义例外仅有 EMZ（虚线蓝调 + 微弱氛围光）与灵摆刻度角标（pmark 着色）
const NEUTRAL_BASE = {
  border: 'border-neutral-300/90 dark:border-neutral-700/80 hover:border-blue-400/80',
  bg: 'bg-neutral-100/75 dark:bg-white/[0.05]',
  shadow: 'shadow-2xs',
  text: 'text-muted-foreground/90'
}

const EMZ_BASE = {
  border: 'border-blue-500/50 border-dashed hover:border-blue-500/90',
  bg: 'bg-blue-500/[0.08] dark:bg-cyan-400/[0.08]',
  // 特殊区域常驻微弱氛围光
  shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.12)]',
  text: 'text-blue-600 dark:text-cyan-200'
}

const VARIANT_CONFIGS: Record<ZoneColorVariant, VariantConfig> = {
  monster: { ...NEUTRAL_BASE, icon: Swords },
  spell: { ...NEUTRAL_BASE, icon: Sparkles },
  emz: { ...EMZ_BASE, icon: Hexagon },
  field: { ...NEUTRAL_BASE, icon: Globe },
  grave: { ...NEUTRAL_BASE, icon: Ghost },
  deck: { ...NEUTRAL_BASE, icon: Layers },
  extra: { ...NEUTRAL_BASE, icon: Layers },
  removed: { ...NEUTRAL_BASE, icon: Ban },
  special: { ...NEUTRAL_BASE, icon: ShieldAlert },
  'pendulum-blue': { ...NEUTRAL_BASE, icon: ShieldAlert },
  'pendulum-red': { ...NEUTRAL_BASE, icon: ShieldAlert }
}

/* ---------- 落子后浮出的轻量表示切换条 (非阻塞，替代弹窗询问) ---------- */

const POSITION_OPTIONS: Record<string, { pos: number; label: string }[]> = {
  szone: [
    { pos: CardPosition.FACEDOWN, label: '盖放' },
    { pos: CardPosition.FACEUP, label: '发动' }
  ],
  mzone: [
    { pos: CardPosition.FACEUP_ATTACK, label: '表攻' },
    { pos: CardPosition.FACEUP_DEFENSE, label: '表守' },
    { pos: CardPosition.FACEDOWN_DEFENSE, label: '盖守' }
  ],
  extra: [
    { pos: CardPosition.FACEDOWN, label: '里侧' },
    { pos: CardPosition.FACEUP, label: '表侧' }
  ]
}

interface DropHintPopoverProps {
  card: FieldCard
  location: number
  controller: 0 | 1
}

const DropHintPopover: React.FC<DropHintPopoverProps> = ({ card, location, controller }) => {
  const closeHint = useDropHintStore((s) => s.close)
  const updateCardPosition = useDuelStore((s) => s.updateCardPosition)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 点击外部 / Esc 关闭（由持有浮条的格子自行监听，同时最多只有一份）
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeHint()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeHint()
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeHint])

  const options =
    location === CardLocation.SZONE
      ? POSITION_OPTIONS.szone
      : location === CardLocation.EXTRA
        ? POSITION_OPTIONS.extra
        : POSITION_OPTIONS.mzone

  return (
    <div
      ref={popoverRef}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 whitespace-nowrap bg-popover border border-border rounded-md shadow-lg p-0.5 animate-in fade-in',
        // 对方行向下浮出、我方行向上浮出，都指向场中央
        controller === 1 ? 'top-full mt-1' : 'bottom-full mb-1'
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.pos}
          type="button"
          onClick={() => {
            updateCardPosition(card.instanceId, opt.pos)
            closeHint()
          }}
          className={cn(
            'px-1.5 py-0.5 rounded border text-[10px] transition-colors',
            card.position === opt.pos
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export const ZoneSlot: React.FC<ZoneSlotProps> = ({
  label,
  controller,
  location,
  sequence,
  card,
  count,
  isPendulum,
  pendulumDirection,
  colorVariant = 'monster',
  className = '',
  duelistId
}) => {
  const {
    addCardToZone,
    setSelectedCardId,
    moveCard,
    addOverlayMaterial,
    overlayOnTop,
    removeCard
  } = useDuelStore()
  const hintZone = useDropHintStore((s) => s.zone)
  const showHint = useDropHintStore((s) => s.show)
  const openPile = usePileListStore((s) => s.openPile)
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const [isOver, setIsOver] = useState(false)

  /** 是否为堆叠型区域（主卡组、额外卡组、墓地、除外区） */
  const isPileZone =
    location === CardLocation.EXTRA ||
    location === CardLocation.DECK ||
    location === CardLocation.GRAVE ||
    location === CardLocation.REMOVED

  // 本格是否为最近一次落子的提示目标
  const isHintTarget =
    hintZone !== null &&
    hintZone.controller === controller &&
    hintZone.location === location &&
    hintZone.sequence === sequence

  // 处理拖拽进入
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isOver) setIsOver(true)
  }

  const handleDragLeave = (): void => {
    setIsOver(false)
  }

  // 释放落子 (支持从左侧面板新增卡片，也支持在场上/手牌间拖动调整位置)
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(false)
    // Ctrl 拖入切换默认放置状态 (魔陷发动 / 怪兽盖守 / 手牌公开)
    const posOverride = getDropPosOverride(location, e.ctrlKey)
    try {
      /** 鼠标拖动的卡片 */
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')

      // Alt 键拖入已有怪兽格：进行超量叠放（超量怪兽置顶，素材垫在下方）
      if (card && location === CardLocation.MZONE && e.altKey) {
        // 防止自己叠放自己
        if (movedInstanceId && movedInstanceId === card.instanceId) {
          return
        }

        /** 即将叠放进来的卡片 */
        let incomingCard: CdbCard | null = null
        let incomingSourceId: string | null = null

        if (movedInstanceId) {
          // 拿到场上的卡片
          const movedCard = useDuelStore
            .getState()
            .state.cards.find((c) => c.instanceId === movedInstanceId)
          if (movedCard) {
            incomingSourceId = movedInstanceId
            incomingCard = movedCard.card ?? null
          }
        }

        // 从搜索面板拖入的卡片，把整张卡的详情转成 JSON 字符串
        if (!incomingCard) {
          const dataStr = e.dataTransfer.getData('application/json')
          // 解析成卡片数据对象
          if (dataStr) {
            incomingCard = JSON.parse(dataStr) as CdbCard
          }
        }

        if (incomingCard) {
          const isIncomingXyz = CardUtils.isXyz(incomingCard.type)
          const isExistingXyz =
            (card.card ? CardUtils.isXyz(card.card.type) : false) ||
            (card.overlayMaterials && card.overlayMaterials.length > 0)

          // 核心层级逻辑：
          // 1. 如果拖入的是超量怪兽 (如阿宙斯/电光皇/从额外拖出超量)，超量怪兽必须置于最顶层 (Host)，原怪兽及其素材垫于下方
          // 2. 如果场上原本不是超量怪兽，但按 Alt 拖入卡片叠放，新卡置于顶层，原怪兽退为素材
          // 3. 仅当场上已是超量怪兽且拖入的是非超量素材卡时，才保持场上超量怪兽置顶，将新卡垫入下方素材堆
          if (isIncomingXyz || !isExistingXyz) {
            overlayOnTop(card.instanceId, incomingCard, incomingSourceId || undefined)
          } else {
            if (incomingSourceId) {
              removeCard(incomingSourceId)
            }
            addOverlayMaterial(card.instanceId, incomingCard.id)
          }
          return
        }
      }
      if (movedInstanceId) {
        moveCard(
          movedInstanceId,
          location,
          sequence,
          controller,
          posOverride,
          duelistId || card?.duelistId
        )
      } else {
        const dataStr = e.dataTransfer.getData('application/json')
        if (!dataStr) return
        const droppedCard = JSON.parse(dataStr) as CdbCard
        addCardToZone(
          droppedCard,
          controller,
          location,
          sequence,
          posOverride,
          duelistId || card?.duelistId
        )
      }

      // 怪兽/魔陷/额外卡组落子后浮出轻量表示切换条 (可继续拖下一张，旧提示自动被顶掉)
      if (
        location === CardLocation.MZONE ||
        location === CardLocation.SZONE ||
        location === CardLocation.EXTRA
      ) {
        showHint({ controller, location, sequence })
      }
    } catch (err) {
      console.error('[ZoneSlot] Drop failed:', err)
    }
  }

  const config = VARIANT_CONFIGS[colorVariant] || VARIANT_CONFIGS.monster
  const IconComponent = config.icon

  // 场上交互格 (怪兽/魔陷/灵摆) 为正方形 → 竖卡与横卡共用同一盒子尺寸，仅旋转有别；
  // 手牌与堆叠区保持竖长条，卡面/卡背按原比例完整填充
  const isSquareCell =
    location === CardLocation.MZONE ||
    location === CardLocation.SZONE ||
    location === CardLocation.PZONE

  // 灵摆刻度角标：颜色仅出现在小徽章上（蓝左/红右为原作刻度设定）
  const pendulumMark = isPendulum
    ? pendulumDirection === 'left'
      ? '◀ P'
      : pendulumDirection === 'right'
        ? 'P ▶'
        : 'P'
    : null
  const pendulumMarkClass =
    colorVariant === 'pendulum-red'
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
      : colorVariant === 'pendulum-blue'
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
        : 'bg-muted text-muted-foreground border-border'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClickCapture={() => {
        // 主卡组格：捕获阶段即打开卡组面板（载入/切换卡组、抽卡、调整卡序）。
        // 必须用 capture 而非 bubble —— 格子里显示的卡片 (CardItem) 会在自己的
        // onClick 里 stopPropagation，冒泡阶段收不到点击，会导致「点卡面没反应、
        // 只有点格子边缘才开面板」。capture 先于子元素执行，卡面与边缘行为一致。
        // 不要求已有卡组：「还没载入卡组」恰恰是最主要的使用时机。
        if (location === CardLocation.DECK) {
          openPile(controller, location)
        }
      }}
      onClick={() => {
        // 主卡组格已在捕获阶段处理完毕
        if (location === CardLocation.DECK) return
        if (!card) setSelectedCardId(null)
      }}
      onDoubleClick={() => {
        // 主卡组格：双击与单击指向同一个面板，行为完全一致，因此不存在
        // 「双击先触发一次单击造成误抽」的问题，也无需延迟判定。
        if (location === CardLocation.DECK) {
          openPile(controller, location)
          return
        }
        const isXyz = card?.card ? CardUtils.isXyz(card.card.type) : false
        const hasMats = card?.overlayMaterials && card.overlayMaterials.length > 0
        if (card && (isXyz || hasMats)) {
          openOverlayList(card.instanceId)
        } else if (isPileZone && count !== undefined && count > 0) {
          openPile(controller, location)
        }
      }}
      className={`group relative ${
        isSquareCell ? 'w-[92px] h-[92px]' : 'w-[64px] h-[92px]'
      } rounded border ${config.border} ${config.bg} ${config.shadow} flex flex-col items-center justify-center transition-all duration-150 select-none shrink-0 ${
        // 拖拽目标态：唯一强调色
        isOver ? 'ring-2 ring-blue-400 bg-blue-500/15 scale-[1.03] border-transparent' : ''
      } ${className}`}
      title={
        location === CardLocation.DECK
          ? '单击打开卡组面板（载入 / 切换卡组、抽卡、调整卡序）'
          : card &&
              ((card.card ? CardUtils.isXyz(card.card.type) : false) ||
                (card.overlayMaterials && card.overlayMaterials.length > 0))
            ? `双击查看超量素材列表 (当前 ${card.overlayMaterials?.length || 0} 张)`
            : isPileZone && count !== undefined && count > 0
              ? '双击直接查看列表'
              : undefined
      }
    >
      {/* 堆叠张数徽标 (如卡组/墓地/额外卡组张数，支持点击直接打开查看列表) */}
      {count !== undefined && count > 0 && (
        <button
          type="button"
          onClick={(e) => {
            if (isPileZone) {
              e.stopPropagation()
              openPile(controller, location)
            }
          }}
          className={cn(
            'absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-full bg-black/80 border border-white/25 text-[9px] font-mono font-bold text-white leading-none shadow-sm transition-all',
            isPileZone
              ? 'hover:bg-blue-600 hover:scale-110 cursor-pointer pointer-events-auto'
              : 'pointer-events-none'
          )}
          title={
            isPileZone
              ? location === CardLocation.DECK
                ? '点击打开卡组面板'
                : '点击查看列表 (或双击格子)'
              : undefined
          }
        >
          {count}
        </button>
      )}

      {/* 落子提示浮条：仅最近一次落子的怪兽/魔陷格显示 (非阻塞，点击外部/Esc 关闭) */}
      {isHintTarget && card && (
        <DropHintPopover card={card} location={location} controller={controller} />
      )}

      {card ? (
        <CardItem key={card.instanceId} card={card} squareCell={isSquareCell} />
      ) : (
        <div className="flex flex-col items-center justify-center p-1.5 text-center pointer-events-none relative z-10 w-full">
          {/* 槽位类型水印（灵摆位不渲染，避免与刻度标记互相遮挡） */}
          {!isPendulum && (
            <div className="mb-1 opacity-30 group-hover:opacity-50 transition-opacity">
              <IconComponent className="w-5 h-5 stroke-[1.5] text-foreground" />
            </div>
          )}

          <span
            className={`text-[10px] font-mono tracking-tight font-medium ${config.text} leading-tight`}
          >
            {label}
          </span>

          {pendulumMark && (
            <span
              className={cn(
                'mt-1 text-[9px] px-1 py-0.5 rounded border font-bold',
                pendulumMarkClass
              )}
            >
              {pendulumMark}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
