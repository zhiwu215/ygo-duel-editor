import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useDetachMaterialStore } from '../../stores/useDetachMaterialStore'
import { useDeckSwitcherStore } from '../../stores/useDeckSwitcherStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useEngineCardEditStore } from '../../stores/useEngineCardEditStore'
import { useStagingStore } from '../../stores/useStagingStore'
import { CardLocation, LOCATION_NAMES } from '@shared/index'
import { deriveCardEngineActions } from '../../utils/engineActions'
import {
  buildDuelActionItems,
  buildEngineEditItems,
  isPileLocation,
  isSpellTrapLocation,
  type CardMenuItemContext,
  type MenuItemConfig
} from '../../utils/cardMenuItems'
import { ZoneContextMenu } from './components/ZoneContextMenu'
import { Zap, History, ArrowLeftRight, ListOrdered, Trash2, SquarePen } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { resolveDuelistDeck } from '../../utils/duelistNames'

export const CardContextMenu: React.FC = () => {
  const { menu, closeMenu } = useContextMenuStore()
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const stagingActive = useStagingStore((s) => s.session !== null)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const { removeCard, clearPile, state, activeDuelistId } = useDuelStore()
  const openPile = usePileListStore((s) => s.openPile)
  const currentPileTarget = usePileListStore((s) => s.target)
  const openDetach = useDetachMaterialStore((s) => s.openDetach)
  const openDeckSwitcher = useDeckSwitcherStore((s) => s.openDeckSwitcher)
  const openProvenance = useEngineCardEditStore((s) => s.openProvenance)
  const openReplace = useEngineCardEditStore((s) => s.openReplace)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

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

  const act = (fn: () => void) => (): void => {
    fn()
    closeMenu()
  }

  if (menu.kind === 'zone') {
    return (
      <ZoneContextMenu
        menuRef={menuRef}
        menuPos={menuPos}
        controller={menu.controller}
        location={menu.location}
        isEngine={isEngine}
        onSwitchDeck={act(() => openDeckSwitcher(menu.controller))}
      />
    )
  }

  const { card, x, y } = menu
  const isPileZone = isPileLocation(card.location)
  const pileCount = state.cards.filter(
    (c) => c.controller === card.controller && c.location === card.location
  ).length
  const isHand = card.location === CardLocation.HAND
  const isMonsterZone = card.location === CardLocation.MZONE
  const isSpellTrapZone = isSpellTrapLocation(card.location)
  const deckDuelist =
    card.location === CardLocation.DECK
      ? resolveDuelistDeck(state.duelists, card.controller, activeDuelistId, card.duelistId)
      : null

  const engineActions = isEngine && !stagingActive ? requestActions : null

  const ctx: CardMenuItemContext = {
    card,
    isEngine,
    stagingActive,
    engineActions,
    act,
    submitAnswer: (answer) => {
      void useDuelEngineStore.getState().submitAnswer(answer)
    },
    openProvenance: (target) => {
      void openProvenance(target)
    },
    openReplace,
    removeEngineCard: (ref) => {
      void useDuelEngineStore.getState().removeCard(ref)
    }
  }

  const duelActionItems = buildDuelActionItems(ctx)
  const engineEditItems = buildEngineEditItems(ctx)

  const renderGroup = (items: MenuItemConfig[]): React.JSX.Element[] =>
    items.map((item, idx) => (
      <Button
        key={idx}
        variant={item.variant === 'destructive' ? 'destructive' : 'ghost'}
        size="sm"
        onClick={item.action}
        className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
      >
        <item.icon className={item.iconClassName} />
        <span>{item.label}</span>
      </Button>
    ))

  const isModalOpenForThisZone =
    currentPileTarget &&
    currentPileTarget.controller === card.controller &&
    currentPileTarget.location === card.location

  const showPileBranch = isPileZone && !isModalOpenForThisZone
  const showOverlayBranch =
    isMonsterZone && !isEngine && !!(card.overlayMaterials && card.overlayMaterials.length > 0)
  const showStatBranch = isMonsterZone || isSpellTrapZone
  const showRemoveBranch = (!isEngine || stagingActive) && !isModalOpenForThisZone
  const hasAnyContent =
    duelActionItems.length > 0 ||
    engineEditItems.length > 0 ||
    showPileBranch ||
    showOverlayBranch ||
    showStatBranch ||
    showRemoveBranch
  if (!hasAnyContent) return null

  return (
    <div
      ref={menuRef}
      style={{ left: menuPos.x, top: menuPos.y }}
      className="fixed z-[60] min-w-48 max-w-56 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
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

      {engineEditItems.length > 0 && (
        <>
          <div className="px-2 py-0.5 text-[9px] font-bold text-sky-400/90 tracking-wide uppercase flex items-center gap-1 select-none">
            <History className="w-2.5 h-2.5 text-sky-400" />
            <span>剧情溯源（重演生效）</span>
          </div>
          {renderGroup(engineEditItems)}
          <Separator className="my-1" />
        </>
      )}

      {isPileZone && !isModalOpenForThisZone && (
        <>
          {card.location === CardLocation.DECK ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={isEngine}
                onClick={act(() => openDeckSwitcher(card.controller))}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>切换卡组</span>
              </Button>
              {deckDuelist && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={act(() => {
                    if (deckDuelist) void window.api.openDeckEditor(deckDuelist.deckId)
                  })}
                  className="w-full justify-start gap-2 h-7 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                  <span>编辑卡组</span>
                </Button>
              )}
            </>
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

      {isMonsterZone &&
        !isEngine &&
        !!(card.overlayMaterials && card.overlayMaterials.length > 0) && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={act(() => openDetach(card.instanceId))}
              className="w-full justify-between h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer"
            >
              <span>拔除素材</span>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                {card.overlayMaterials!.length}张
              </span>
            </Button>
            <Separator className="my-1" />
          </>
        )}

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
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer"
          >
            <span>攻守与指示物 (Shift+点击)</span>
          </Button>
          <Separator className="my-1" />
        </>
      )}

      {(!isEngine || stagingActive) && !isModalOpenForThisZone && (
        <Button
          variant="destructive"
          size="sm"
          onClick={act(() =>
            isPileZone ? clearPile(card.controller, card.location) : removeCard(card.instanceId)
          )}
          className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>
            {isHand
              ? '从手牌移除'
              : isPileZone
                ? `清空${LOCATION_NAMES[card.location] ?? '卡堆'} (${pileCount})`
                : '从场上移除'}
          </span>
        </Button>
      )}
    </div>
  )
}
