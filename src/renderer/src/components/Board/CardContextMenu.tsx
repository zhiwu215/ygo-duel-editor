import React, { useEffect, useRef } from 'react'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardPosition, CardLocation } from '@shared/index'
import {
  Swords,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Layers,
  ArrowDownToLine,
  Ban,
  RotateCw,
  ArrowLeftRight
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
  const { updateCardPosition, moveCard, removeCard } = useDuelStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return

    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('contextmenu', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('contextmenu', handlePointerDown)
    }
  }, [menu, closeMenu])

  if (!menu) return null

  const { card, x, y } = menu
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

  // 怪兽区操作项
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

  // 区域转移操作项
  const moveItems: MenuItemConfig[] = [
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
    ...(card.location !== CardLocation.HAND
      ? [
          {
            icon: <Layers className="w-3.5 h-3.5 text-muted-foreground" />,
            label: '移回手牌',
            action: moveTo(CardLocation.HAND)
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

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-48">
        {card.card?.name || `卡片: ${card.code}`}
      </div>

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

      {spellTrapItems.length > 0 && (
        <>
          {renderGroup(spellTrapItems)}
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
        <span>{isHand ? '从手牌移除' : '从场上移除'}</span>
      </Button>
    </div>
  )
}
