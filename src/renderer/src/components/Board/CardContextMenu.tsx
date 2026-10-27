import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { usePileListStore } from '../../stores/usePileListStore'
import { useDetachMaterialStore } from '../../stores/useDetachMaterialStore'
import { useDeckSwitcherStore } from '../../stores/useDeckSwitcherStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useEngineCardEditStore } from '../../stores/useEngineCardEditStore'
import { confirmDialog } from '../../stores/useDialogStore'
import {
  CardLocation,
  EngineProvenance,
  LOCATION_NAMES,
  isEngineSupportedMatch,
  isPileLocation,
  isPlaceholderCard,
  isSpellTrapLocation,
  PLACEHOLDER_CARD_CODE
} from '@shared/index'
import { ZoneContextMenu } from './components/ZoneContextMenu'
import { HandContextMenu } from './components/HandContextMenu'
import { ArrowLeftRight, ListOrdered, Trash2, SquarePen } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { resolveDuelistDeck } from '../../utils/duelistNames'
import { resolveCardName } from '../../utils/cardNames'
import { PLACEHOLDER_CDB_CARD } from '../../utils/placeholderCard'

export const CardContextMenu: React.FC = () => {
  const { menu, closeMenu } = useContextMenuStore()
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const engineLoading = useDuelEngineStore((s) => s.loading)
  const timeline = useDuelEngineStore((s) => s.timeline)
  const { removeCard, clearPile, state, activeDuelistIds, addCardToZone } = useDuelStore()
  const matchConfig = useDuelStore((s) => s.state.matchConfig)
  const openPile = usePileListStore((s) => s.openPile)
  const currentPileTarget = usePileListStore((s) => s.target)
  const openDetach = useDetachMaterialStore((s) => s.openDetach)
  const openDeckSwitcher = useDeckSwitcherStore((s) => s.openDeckSwitcher)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [provenanceState, setProvenanceState] = useState<{
    instanceId: string
    value: EngineProvenance
  } | null>(null)
  const menuCard = menu?.kind === 'card' ? menu.card : null

  useEffect(() => {
    if (!isEngine || isReplay || !menuCard) return
    let cancelled = false
    void useDuelEngineStore
      .getState()
      .getProvenance({
        controller: menuCard.controller,
        location: menuCard.location,
        sequence: menuCard.sequence,
        instanceId: menuCard.instanceId
      })
      .then((value) => {
        if (!cancelled) setProvenanceState({ instanceId: menuCard.instanceId, value })
      })
    return () => {
      cancelled = true
    }
  }, [isEngine, isReplay, menuCard])

  useLayoutEffect(() => {
    if (!menu) return
    const el = menuRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setMenuPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - width - 12)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - height - 12))
    })
  }, [menu, provenanceState])

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

  const addDeckPlaceholder = (controller: 0 | 1): void => {
    const engine = useDuelEngineStore.getState()
    if (engine.isInitialized) {
      if (engine.replayInfo) return
      void engine.inject({
        op: 'add-card',
        player: controller,
        code: PLACEHOLDER_CARD_CODE,
        to: 'deck-top'
      })
      return
    }
    addCardToZone(PLACEHOLDER_CDB_CARD, controller, CardLocation.DECK, 0)
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
        onAddPlaceholder={
          menu.location === CardLocation.DECK
            ? act(() => addDeckPlaceholder(menu.controller))
            : undefined
        }
      />
    )
  }

  if (menu.kind === 'hand') {
    return (
      <HandContextMenu
        menuRef={menuRef}
        menuPos={menuPos}
        controller={menu.controller}
        duelistId={menu.duelistId}
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
  const cardName = card.card?.name ?? resolveCardName(card.code)
  const cardRef = {
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    instanceId: card.instanceId,
    duelistId: card.duelistId
  }
  const provenance = provenanceState?.instanceId === card.instanceId ? provenanceState.value : null
  const showEngineEdit = isEngine && !isReplay
  const editSupported = isEngineSupportedMatch(matchConfig)
  const editableHandPlaceholder = isHand && isPlaceholderCard(card.code)
  const provenanceLoading = showEngineEdit && provenance === null
  const traceable = provenance?.kind === 'initial' || provenance?.kind === 'inject'
  const canEdit =
    showEngineEdit &&
    !engineLoading &&
    traceable &&
    (editSupported || provenance?.kind === 'inject' || editableHandPlaceholder)
  const injectStep =
    provenance?.kind === 'inject'
      ? timeline.find((node) => node.id === provenance.nodeId)?.stepNumber
      : undefined
  const sourceLabel = provenanceLoading
    ? '正在读取来源…'
    : provenance?.kind === 'initial'
      ? '来源：初始牌局'
      : provenance?.kind === 'inject'
        ? injectStep
          ? `来源：第 ${injectStep} 步注入`
          : '来源：注入'
        : provenance?.kind === 'drawn'
          ? '来源：抽牌'
          : '来源：无法溯源'
  const disabledReason = engineLoading
    ? '引擎正在处理，请稍候。'
    : provenance?.kind === 'drawn'
      ? '抽到的卡没有可编辑的来源，不能替换或移除。'
      : !provenanceLoading && !canEdit
        ? !editSupported && !editableHandPlaceholder && provenance?.kind !== 'inject'
          ? '多人数对局只能编辑手牌占位卡或手动添加的卡片。'
          : '该卡无法溯源，不能替换或移除。'
        : null
  const handleReplace = (): void => {
    if (!canEdit) return
    closeMenu()
    useEngineCardEditStore.getState().openReplace({
      ref: cardRef,
      name: cardName,
      code: card.code
    })
  }
  const handleRemove = async (): Promise<void> => {
    if (!canEdit) return
    closeMenu()
    const ok = await confirmDialog({
      title: '从对局中移除这张卡？',
      description: `「${cardName}」\n${sourceLabel}\n\n会修改来源并自动重演；无法与原历史对齐时会回到分歧点，之后的操作需要重新进行。`,
      confirmText: '移除并重演',
      destructive: true
    })
    if (ok !== true) return
    await useDuelEngineStore.getState().removeCard(cardRef)
  }
  const deckDuelist =
    card.location === CardLocation.DECK
      ? resolveDuelistDeck(
          state.duelists,
          card.controller,
          activeDuelistIds[card.controller],
          card.duelistId
        )
      : null

  const isModalOpenForThisZone =
    currentPileTarget &&
    currentPileTarget.controller === card.controller &&
    currentPileTarget.location === card.location

  const showPileBranch = isPileZone && !isModalOpenForThisZone
  const showOverlayBranch =
    isMonsterZone && !isEngine && !!(card.overlayMaterials && card.overlayMaterials.length > 0)
  const showStatBranch = !isEngine && (isMonsterZone || isSpellTrapZone)
  const showRemoveBranch = !isEngine && !isModalOpenForThisZone
  const showDeckPlaceholder = card.location === CardLocation.DECK && !isReplay
  const hasAnyContent =
    showEngineEdit ||
    showPileBranch ||
    showDeckPlaceholder ||
    showOverlayBranch ||
    showStatBranch ||
    showRemoveBranch
  if (!hasAnyContent) return null

  return (
    <div
      ref={menuRef}
      style={{ left: menuPos.x, top: menuPos.y }}
      className="fixed z-[60] max-h-[70vh] min-w-48 max-w-56 overflow-y-auto bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {showEngineEdit && (
        <>
          <div className="truncate border-b border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
            {sourceLabel}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canEdit}
            onClick={handleReplace}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer"
          >
            替换
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canEdit}
            onClick={() => void handleRemove()}
            className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal"
          >
            移除
          </Button>
          {disabledReason && (
            <div className="px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
              {disabledReason}
            </div>
          )}
          <Separator className="my-1" />
        </>
      )}

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
          {card.location === CardLocation.DECK && (
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
          )}
          <Separator className="my-1" />
        </>
      )}

      {showDeckPlaceholder && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={act(() => addDeckPlaceholder(card.controller))}
            className="w-full justify-start h-7 px-2 text-xs font-normal hover:bg-accent cursor-pointer"
          >
            添加占位卡
          </Button>
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

      {showStatBranch && (
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
            <span>攻守与指示物 (Shift+左键)</span>
          </Button>
          <Separator className="my-1" />
        </>
      )}

      {!isEngine && !isModalOpenForThisZone && (
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
