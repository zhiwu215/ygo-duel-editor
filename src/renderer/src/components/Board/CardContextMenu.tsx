import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { useDeckSwitcherStore } from '../../stores/useDeckSwitcherStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { CardPosition, CardLocation, CardType, Answer } from '@shared/index'
import { deriveCardEngineActions } from '../../utils/engineActions'
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
  ListOrdered,
  Sliders,
  Zap,
  Sparkles
} from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

interface MenuItemConfig {
  icon: React.ReactNode
  label: string
  action: () => void
  variant?: 'default' | 'destructive'
}

const LOCATION_LABELS: Record<number, string> = {
  [CardLocation.EXTRA]: '额外卡组',
  [CardLocation.DECK]: '主卡组',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.REMOVED]: '除外区'
}

export const CardContextMenu: React.FC = () => {
  const { menu, closeMenu } = useContextMenuStore()
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const { updateCardPosition, moveCard, removeCard, state, executeSendToGrave, executeBanishCard } =
    useDuelStore()
  const openPile = usePileListStore((s) => s.openPile)
  const currentPileTarget = usePileListStore((s) => s.target)
  const openOverlayList = useOverlayListStore((s) => s.openOverlayList)
  const openDeckSwitcher = useDeckSwitcherStore((s) => s.openDeckSwitcher)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  // 引擎激活时菜单动作来自 pendingRequest（与 CardCommandMenu 同源同提交方式）
  const menuCard = menu?.kind === 'card' ? menu.card : null
  const requestActions = React.useMemo(
    () => deriveCardEngineActions(pendingRequest, menuCard),
    [pendingRequest, menuCard]
  )

  useLayoutEffect(() => {
    if (!menu) return
    const el = menuRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setMenuPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - width - 12)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - height - 12))
    })
  }, [menu])

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

  // 封装"执行操作并关闭菜单"的通用回调
  const act = (fn: () => void) => (): void => {
    fn()
    closeMenu()
  }

  // —— 区域级菜单 ——
  // 右键一个**空**的堆叠格（典型场景：尚未载入卡组的主卡组格，此时没有任何卡片可依附），
  // 只提供区域级操作。
  if (menu.kind === 'zone') {
    const { controller, location } = menu
    return (
      <div
        ref={menuRef}
        style={{ left: menuPos.x, top: menuPos.y }}
        className="fixed z-[60] min-w-48 max-w-56 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-52">
          {controller === 0 ? '我方' : '对方'}
          {LOCATION_LABELS[location] || '区域'}
        </div>

        {location === CardLocation.DECK && (
          <Button
            variant="ghost"
            size="sm"
            onClick={act(() => openDeckSwitcher(controller))}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>切换卡组</span>
          </Button>
        )}
      </div>
    )
  }

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

  const setPos = (pos: number): (() => void) => act(() => updateCardPosition(card.instanceId, pos))
  const moveTo = (loc: number, ctrl?: 0 | 1): (() => void) =>
    act(() => moveCard(card.instanceId, loc, 0, ctrl))

  const codeName = (code: number): string =>
    code === card.code
      ? card.card?.name || `卡片 ${code}`
      : state.cards.find((c) => c.code === code)?.card?.name || `卡片 ${code}`

  const engineActions = isEngine ? requestActions : null

  const duelActionItems: MenuItemConfig[] = []
  if (engineActions) {
    const addItem = (icon: React.ReactNode, label: string, answer: Answer): void => {
      duelActionItems.push({
        icon,
        label,
        action: act(() => {
          void useDuelEngineStore.getState().submitAnswer(answer)
        })
      })
    }
    const zapIcon = <Zap className="w-3.5 h-3.5 text-amber-500" />
    const summonIcon = <Sparkles className="w-3.5 h-3.5 text-blue-400" />
    const attackIcon = <Swords className="w-3.5 h-3.5 text-rose-500" />
    const chainIcon = <Layers className="w-3.5 h-3.5 text-teal-400" />
    const setIcon = <RotateCw className="w-3.5 h-3.5 text-emerald-400" />

    if (engineActions.summon) {
      addItem(summonIcon, '召唤', { kind: 'idle', cmd: 'SUMMON', card: engineActions.summon })
    }
    if (engineActions.spSummon) {
      addItem(summonIcon, '特殊召唤', {
        kind: 'idle',
        cmd: 'SPSUMMON',
        card: engineActions.spSummon
      })
    }
    const setCard = engineActions.sset ?? engineActions.mset
    if (setCard) {
      addItem(setIcon, '盖放', {
        kind: 'idle',
        cmd: engineActions.sset ? 'SSET' : 'MSET',
        card: setCard
      })
    }
    engineActions.activate.forEach((cardReq, index) => {
      const suffix = engineActions.activate.length > 1 ? `（效果 ${index + 1}）` : ''
      addItem(
        zapIcon,
        `发动 [${codeName(cardReq.code)}]${suffix}`,
        engineActions.requestKind === 'battle'
          ? { kind: 'battle', cmd: 'ACTIVATE', card: cardReq }
          : { kind: 'idle', cmd: 'ACTIVATE', card: cardReq }
      )
    })
    if (engineActions.repos) {
      const reposLabel =
        card.position === CardPosition.FACEDOWN_DEFENSE
          ? '反转召唤'
          : card.position === CardPosition.FACEUP_ATTACK
            ? '转为守备'
            : '转为攻击'
      addItem(setIcon, reposLabel, { kind: 'idle', cmd: 'REPOS', card: engineActions.repos })
    }
    if (engineActions.attack) {
      addItem(attackIcon, '攻击', { kind: 'battle', cmd: 'ATTACK', card: engineActions.attack })
    }
    if (engineActions.chain) {
      addItem(chainIcon, '发动连锁', { kind: 'chain', card: engineActions.chain })
    }
  }

  const handItems: MenuItemConfig[] =
    !isEngine && isHand
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

  const monsterItems: MenuItemConfig[] =
    !isEngine && isMonsterZone
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

  const spellTrapItems: MenuItemConfig[] =
    !isEngine && isSpellTrapZone
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

  const moveItems: MenuItemConfig[] = !isEngine
    ? [
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
                action: act(() => executeSendToGrave(card.instanceId))
              }
            ]
          : []),
        ...(card.location !== CardLocation.REMOVED
          ? [
              {
                icon: <Ban className="w-3.5 h-3.5 text-muted-foreground" />,
                label: '除外',
                action: act(() => executeBanishCard(card.instanceId))
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
    : []

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
      style={{ left: menuPos.x, top: menuPos.y }}
      className="fixed z-[60] min-w-48 max-w-56 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-52">
        {card.card?.name || `卡片: ${card.code}`}
      </div>

      {duelActionItems.length > 0 && (
        <>
          <div className="px-2 py-0.5 text-[9px] font-bold text-amber-500/90 tracking-wide uppercase flex items-center gap-1 select-none">
            <Zap className="w-2.5 h-2.5 text-amber-500" />
            <span>实战决斗指令 (自动记谱)</span>
          </div>
          {renderGroup(duelActionItems)}
          <Separator className="my-1" />
        </>
      )}

      {isPileZone && !isModalOpenForThisZone && (
        <>
          {card.location === CardLocation.DECK ? (
            // 主卡组：不提供「查看列表」（双击卡组格即可展开列表），只提供切换卡组
            <Button
              variant="ghost"
              size="sm"
              onClick={act(() => openDeckSwitcher(card.controller))}
              className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>切换卡组</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={act(() => openPile(card.controller, card.location))}
              className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>查看列表 ({pileCount})</span>
            </Button>
          )}
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

      {/* 场上卡片快捷微调面板 */}
      {(isMonsterZone || isSpellTrapZone) && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={act(() => {
              const { statPopoverPosition, openStatPopover } = useDuelStore.getState()
              const initialPos = statPopoverPosition || {
                x: Math.max(16, Math.min(x + 20, window.innerWidth - 260)),
                y: Math.max(16, Math.min(y - 20, window.innerHeight - 380))
              }
              openStatPopover(card.instanceId, initialPos)
            })}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>攻守与指示物 (Shift+点击)</span>
          </Button>
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

      {!isEngine && (
        <Button
          variant="destructive"
          size="sm"
          onClick={act(() => removeCard(card.instanceId))}
          className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isHand ? '从手牌移除' : isPileZone ? '从卡堆移除' : '从场上移除'}</span>
        </Button>
      )}
    </div>
  )
}
