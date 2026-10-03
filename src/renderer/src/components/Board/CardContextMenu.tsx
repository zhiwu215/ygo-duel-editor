import React, { useEffect, useRef } from 'react'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { CardPosition, CardLocation, CardType } from '@shared/index'
import {
  Swords,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Layers,
  Ghost,
  ArrowDownToLine,
  Ban,
  RotateCw,
  ArrowLeftRight,
  ListOrdered
} from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

/** 菜单项配置类型 */
interface MenuItemConfig {
  /** 菜单项图标 */
  icon: React.ReactNode
  /** 菜单项标签 */
  label: string
  /** 菜单项点击事件 */
  action: () => void
  /** 菜单项变体 */
  variant?: 'default' | 'destructive'
}

/** 右键上下文菜单 */
export const CardContextMenu: React.FC = () => {
  const { menu, closeMenu } = useContextMenuStore()
  const { updateCardPosition, moveCard, removeCard, state } = useDuelStore()
  const openPile = usePileListStore((s) => s.openPile)
  const currentPileTarget = usePileListStore((s) => s.target)
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return

    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        closeMenu()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('resize', closeMenu)
    window.addEventListener('contextmenu', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('contextmenu', handlePointerDown)
    }
  }, [menu, closeMenu])

  if (!menu) return null

  const { card, x, y } = menu
  /** 是否处于堆叠型区域（主卡组、额外卡组、墓地、除外区） */
  const isPileZone =
    card.location === CardLocation.EXTRA ||
    card.location === CardLocation.DECK ||
    card.location === CardLocation.GRAVE ||
    card.location === CardLocation.REMOVED
  const pileCount = state.cards.filter(
    (c) => c.controller === card.controller && c.location === card.location
  ).length
  /** 是否为手牌 */
  const isHand = card.location === CardLocation.HAND
  const isMonsterZone = card.location === CardLocation.MZONE
  const isSpellTrapZone =
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE

  // 封装"执行操作并关闭菜单"的通用回调
  const act = (fn: () => void) => (): void => {
    fn()
    closeMenu()
  }

  const setPos = (pos: number): (() => void) => act(() => updateCardPosition(card.instanceId, pos))
  const moveTo = (loc: number, ctrl?: 0 | 1): (() => void) =>
    act(() => moveCard(card.instanceId, loc, 0, ctrl))

  // 手牌操作项
  const handItems: MenuItemConfig[] = isHand
    ? [
        {
          icon: <Eye className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '表侧表示 (公开手牌)',
          action: setPos(CardPosition.FACEUP)
        },
        {
          icon: <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '里侧表示 (未公开手牌)',
          action: setPos(CardPosition.FACEDOWN)
        },
        {
          icon: <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />,
          label: `转移至${card.controller === 0 ? '对方手牌' : '我方手牌'}`,
          action: moveTo(CardLocation.HAND, card.controller === 0 ? 1 : 0)
        }
      ]
    : []

  // 怪兽区表示形式操作项
  const monsterItems: MenuItemConfig[] = isMonsterZone
    ? [
        {
          icon: <Swords className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '表侧攻击表示',
          action: setPos(CardPosition.FACEUP_ATTACK)
        },
        {
          icon: <Shield className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '表侧守备表示',
          action: setPos(CardPosition.FACEUP_DEFENSE)
        },
        {
          icon: <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '里侧守备表示',
          action: setPos(CardPosition.FACEDOWN_DEFENSE)
        }
      ]
    : []

  const hasOverlayMaterials =
    isMonsterZone && !!(card.overlayMaterials && card.overlayMaterials.length > 0)

  // 魔陷区操作项
  const spellTrapItems: MenuItemConfig[] = isSpellTrapZone
    ? [
        {
          icon: <Swords className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '表侧表示',
          action: setPos(CardPosition.FACEUP_ATTACK)
        },
        {
          icon: <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '里侧盖放',
          action: setPos(CardPosition.FACEDOWN)
        }
      ]
    : []

  // 卡组 / 额外卡组操作项 (支持灵摆怪兽表侧置入等机制)
  const isDeckPile = card.location === CardLocation.EXTRA || card.location === CardLocation.DECK
  const deckPileItems: MenuItemConfig[] = isDeckPile
    ? [
        {
          icon: <Eye className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '表侧表示',
          action: setPos(CardPosition.FACEUP)
        },
        {
          icon: <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />,
          label: '里侧表示',
          action: setPos(CardPosition.FACEDOWN)
        }
      ]
    : []

  // 判断是否为额外怪兽 (融合/同调/超量/连接)
  const isExtraMonster = card.card
    ? !!(card.card.type & (CardType.FUSION | CardType.SYNCHRO | CardType.XYZ | CardType.LINK))
    : false
  const isPendulum = card.card ? !!(card.card.type & CardType.PENDULUM) : false

  // 区域转移操作项
  const moveItems: MenuItemConfig[] = [
    ...(card.location !== CardLocation.HAND
      ? [
          {
            icon: <Layers className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '移至手牌',
            action: moveTo(CardLocation.HAND)
          }
        ]
      : []),
    ...(card.location !== CardLocation.GRAVE
      ? [
          {
            icon: <ArrowDownToLine className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '送去墓地',
            action: moveTo(CardLocation.GRAVE)
          }
        ]
      : []),
    ...(card.location !== CardLocation.REMOVED
      ? [
          {
            icon: <Ban className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '除外',
            action: moveTo(CardLocation.REMOVED)
          }
        ]
      : []),
    ...((!card.card || !isExtraMonster || isPendulum) && card.location !== CardLocation.DECK
      ? [
          {
            icon: <Layers className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '回到主卡组',
            action: moveTo(CardLocation.DECK)
          }
        ]
      : []),
    ...((!card.card || isExtraMonster || isPendulum) && card.location !== CardLocation.EXTRA
      ? [
          {
            icon: <Layers className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '回到额外卡组',
            action: moveTo(CardLocation.EXTRA)
          }
        ]
      : [])
  ]

  // 防止菜单超出屏幕右侧或下侧
  const menuWidth = 190
  const menuHeight = 280
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12)
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12)

  const renderGroup = (items: MenuItemConfig[]): React.JSX.Element[] =>
    items.map((item, idx) => (
      <Button
        key={idx}
        variant={item.variant === 'destructive' ? 'destructive' : 'ghost'}
        size="sm"
        onClick={item.action}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
      >
        {item.icon}
        <span>{item.label}</span>
      </Button>
    ))

  const isModalOpenForThisZone =
    currentPileTarget &&
    currentPileTarget.controller === card.controller &&
    currentPileTarget.location === card.location

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-48">
        {card.card?.name || `卡片: ${card.code}`}
      </div>

      {isPileZone && !isModalOpenForThisZone && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={act(() => openPile(card.controller, card.location))}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>查看列表 ({pileCount})</span>
          </Button>
          <Separator className="my-1" />
        </>
      )}

      {handItems.length > 0 && (
        <>
          {renderGroup(handItems)}
          <Separator className="my-1" />
        </>
      )}

      {monsterItems.length > 0 && (
        <>
          {renderGroup(monsterItems)}
          <Separator className="my-1" />
        </>
      )}

      {hasOverlayMaterials && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={act(() => openOverlayList(card.instanceId))}
            className="w-full justify-between h-7 px-2 text-xs font-normal text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Ghost className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>拔除素材</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/80">
              {card.overlayMaterials!.length}张
            </span>
          </Button>
          <Separator className="my-1" />
        </>
      )}

      {spellTrapItems.length > 0 && (
        <>
          {renderGroup(spellTrapItems)}
          <Separator className="my-1" />
        </>
      )}

      {deckPileItems.length > 0 && (
        <>
          {renderGroup(deckPileItems)}
          <Separator className="my-1" />
        </>
      )}

      {moveItems.length > 0 && (
        <>
          {renderGroup(moveItems)}
          <Separator className="my-1" />
        </>
      )}

      {/* 删除卡片 */}
      <Button
        variant="destructive"
        size="sm"
        onClick={act(() => removeCard(card.instanceId))}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>{isHand ? '从手牌移除' : isPileZone ? '从卡堆移除' : '从场上移除'}</span>
      </Button>
    </div>
  )
}
