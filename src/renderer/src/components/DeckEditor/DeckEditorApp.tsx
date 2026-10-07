import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { CardUtils, CdbCard, DeckData, DeckSection, groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { alertDialog, confirmDialog } from '../../stores/useDialogStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  DeckDragSourceData,
  DeckDropTargetData,
  DECK_SECTION_NAMES,
  deckDragGuard
} from './deckDnd'
import { DeckLibraryView } from './DeckLibraryView'
import { DeckDetailCard } from './DeckDetailCard'
import { DeckGrid, type DeckFlashTarget } from './DeckGrid'
import { DeckSearchPanel } from './DeckSearchPanel'
import { FilterDrawer } from '../CardSearch/FilterDrawer'
import { DeckTestHandModal } from './DeckTestHandModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { WindowControls } from '../ui/window-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dices, Download, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

const NONE_GROUP_VALUE = '__none__'

/** 卡组内卡片落位时的回弹动画；从搜索面板拖入的新卡不回弹（源节点不动，回弹会看成失败） */
const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
const FLASH_DURATION = 700

const PanelButton: React.FC<{
  label: string
  title?: string
  emphasize?: boolean
  disabled?: boolean
  onClick?: () => void
}> = ({ label, title, emphasize, disabled, onClick }) => (
  <Button
    type="button"
    variant="outline"
    size="xs"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-[58px] shrink-0 px-0 bg-background/70 text-[11px] font-normal text-muted-foreground hover:text-foreground',
      emphasize && 'font-semibold text-foreground'
    )}
  >
    {label}
  </Button>
)

const MiniButton: React.FC<{
  icon: LucideIcon
  label: string
  title?: string
  emphasize?: boolean
  disabled?: boolean
  onClick?: () => void
}> = ({ icon: Icon, label, title, emphasize, disabled, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background/60 px-0.5 text-[10px] leading-none text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground cursor-pointer disabled:pointer-events-none disabled:opacity-40',
      emphasize &&
        'border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/20 hover:text-primary'
    )}
  >
    <Icon className="w-3 h-3 shrink-0" />
    <span className="max-w-full truncate">{label}</span>
  </button>
)

/**
 * 指针命中优先；指针落空（停在区块间隙、详情面板上方等）时回退到矩形相交，
 * 否则松手位置稍微偏出卡图就会整次拖拽无声失败。
 */
const deckCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

export const DeckEditorApp: React.FC = () => {
  const {
    viewMode,
    deck,
    deckList,
    deckGroups,
    isLoadingLibrary,
    cardDetails,
    selectedCard,
    hoveredCardId,
    testHandCards,
    setSelectedCard,
    setHoveredCardId,
    setDeckName,
    setDeckDescription,
    setDeckGroup,
    setDeckCover,
    addCard,
    removeCard,
    moveCard,
    moveCardBetweenSections,
    clearDeck,
    sortDeck,
    shuffleDeck,
    drawTestHand,
    closeTestHand,
    saveDeckFile,
    saveCurrentDeckToLibrary,
    deleteDeckFromLibrary,
    createNewDeck,
    openDeck,
    fetchDeckList,
    backToLibrary,
    getStats
  } = useDeckEditorStore()

  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<{
    code: number
    width: number
    height: number
    source: 'search' | 'deck'
  } | null>(null)
  const [rejectMessage, setRejectMessage] = useState<string | null>(null)
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flash, setFlash] = useState<DeckFlashTarget | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [browsedCategory, setBrowsedCategory] = useState<string>(deck.group || NONE_GROUP_VALUE)
  const [prevDeckId, setPrevDeckId] = useState<string | undefined>(deck.id)
  if (prevDeckId !== deck.id) {
    setPrevDeckId(deck.id)
    setBrowsedCategory(deck.group || NONE_GROUP_VALUE)
  }

  const savedSnapshotRef = useRef<string>('')
  const markDeckClean = useCallback((): void => {
    savedSnapshotRef.current = JSON.stringify(useDeckEditorStore.getState().deck)
  }, [])
  useEffect(() => {
    markDeckClean()
  }, [deck.id, markDeckClean])

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const current = JSON.stringify(useDeckEditorStore.getState().deck)
    if (current === savedSnapshotRef.current) return true
    return confirmDialog({
      title: '放弃修改',
      description: '此操作将放弃对当前卡组的修改，是否继续？',
      confirmText: '继续'
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const handleSelectCard = useCallback(
    (card: CdbCard | null): void => {
      setSelectedCard(card)
      setHoveredCardId(null)
    },
    [setSelectedCard, setHoveredCardId]
  )

  const handleHoverCard = useCallback(
    (code: number | null): void => {
      setHoveredCardId(code)
    },
    [setHoveredCardId]
  )

  const handleClearHover = useCallback((): void => {
    setHoveredCardId(null)
  }, [setHoveredCardId])

  const triggerFlash = useCallback((target: DeckFlashTarget): void => {
    setFlash(target)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_DURATION)
  }, [])

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (viewMode !== 'editor' || deckList.length > 0 || isLoadingLibrary) return
    void fetchDeckList()
  }, [viewMode, deckList.length, isLoadingLibrary, fetchDeckList])

  useEffect(() => {
    const openDeckInEditor = (targetDeck: DeckData): void => {
      void useDeckEditorStore.getState().openDeck(targetDeck)
    }

    void window.api.consumePendingDeckToEdit().then((deck) => {
      if (deck) openDeckInEditor(deck)
    })

    return window.api.onOpenDeckInEditor(openDeckInEditor)
  }, [])

  const showRejectToast = useCallback((section: DeckSection): void => {
    if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current)
    setRejectMessage(`无法将该卡片加入${DECK_SECTION_NAMES[section]}`)
    rejectTimerRef.current = setTimeout(() => setRejectMessage(null), 1800)
  }, [])

  /**
   * 加入卡组的统一入口：点击加入、拖入加入、右键指定区域都走这里。
   * 成功时给落位的那张卡一次高亮，避免「点了但看不出加哪去了」。
   */
  const handleAddCard = useCallback(
    (card: CdbCard, section?: DeckSection, index?: number): boolean => {
      const ok = addCard(card, section, index)
      const resolved: DeckSection = section ?? (CardUtils.isExtraDeck(card.type) ? 'extra' : 'main')
      if (!ok) {
        showRejectToast(resolved)
        return false
      }
      const list = useDeckEditorStore.getState().deck[resolved]
      const landed = index === undefined ? list.length - 1 : Math.min(index, list.length - 1)
      if (landed >= 0) triggerFlash({ section: resolved, index: landed })
      return true
    },
    [addCard, showRejectToast, triggerFlash]
  )

  if (viewMode === 'library') {
    return <DeckLibraryView />
  }

  const stats = getStats()

  // 悬停预览优先于选中卡：鼠标滑到左侧面板时仍停留在刚看过的那张
  const detailCard = (hoveredCardId !== null ? cardDetails[hoveredCardId] : null) ?? selectedCard

  const handleDragStart = (event: DragStartEvent): void => {
    const source = event.active.data.current as DeckDragSourceData | undefined
    if (!source) return
    const rect = event.active.rect.current.initial
    const width = rect?.width ?? 68
    setActiveDrag({
      code: source.source === 'search' ? source.card.id : source.code,
      width,
      height: rect?.height ?? (width * 86) / 59,
      source: source.source
    })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDrag(null)
    deckDragGuard.lastDragEndAt = Date.now()

    const source = event.active.data.current as DeckDragSourceData | undefined
    const target = event.over?.data.current as DeckDropTargetData | undefined
    if (!source || !target) return

    if (source.source === 'search') {
      if (target.kind === 'search-panel') return
      if (target.kind === 'deck-item') {
        handleAddCard(source.card, target.section, target.index)
      } else {
        handleAddCard(source.card, target.section)
      }
      return
    }

    if (target.kind === 'search-panel') {
      removeCard(source.section, source.index)
      return
    }

    if (target.kind === 'zone') {
      if (target.section === source.section) return
      if (!moveCardBetweenSections(source.section, source.index, target.section)) {
        showRejectToast(target.section)
        return
      }
      const list = useDeckEditorStore.getState().deck[target.section]
      triggerFlash({ section: target.section, index: list.length - 1 })
      return
    }

    if (target.section === source.section) {
      if (target.index !== source.index) moveCard(source.section, source.index, target.index)
      return
    }

    if (!moveCardBetweenSections(source.section, source.index, target.section, target.index)) {
      showRejectToast(target.section)
      return
    }
    const list = useDeckEditorStore.getState().deck[target.section]
    triggerFlash({ section: target.section, index: Math.min(target.index, list.length - 1) })
  }

  const handleDragCancel = (): void => {
    setActiveDrag(null)
    deckDragGuard.lastDragEndAt = Date.now()
  }

  const browsedGroup = browsedCategory === NONE_GROUP_VALUE ? '' : browsedCategory

  const showToast = (message: string): void => {
    setSaveToast(message)
    setTimeout(() => setSaveToast(null), 2000)
  }

  const handleSave = async (): Promise<void> => {
    if (!deck.id) setDeckGroup(browsedGroup)
    const ok = await saveCurrentDeckToLibrary()
    if (ok) {
      markDeckClean()
      showToast('保存成功')
    } else {
      void alertDialog('保存失败')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!deck.id) return
    if (
      !(await confirmDialog({
        title: `「${deck.name}」`,
        description: '是否删除这个卡组？',
        confirmText: '删除'
      }))
    )
      return
    const siblings = deckList.filter(
      (d): d is DeckData & { id: string } => (d.group ?? '') === browsedGroup && !!d.id
    )
    const index = siblings.findIndex((d) => d.id === deck.id)
    const ok = await deleteDeckFromLibrary(deck.id)
    if (!ok) {
      void alertDialog('删除失败')
      return
    }
    showToast('删除成功')
    const fresh = useDeckEditorStore.getState().deckList
    const remaining = fresh.filter(
      (d): d is DeckData & { id: string } => (d.group ?? '') === browsedGroup && !!d.id
    )
    if (remaining.length > 0) {
      const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)]
      if (next) void openDeck(next)
    } else {
      createNewDeck()
      if (browsedGroup) useDeckEditorStore.getState().setDeckGroup(browsedGroup)
    }
  }

  const handleBrowseCategory = async (value: string | null): Promise<void> => {
    if (!value || value === browsedCategory) return
    if (!(await confirmDiscard())) return
    setBrowsedCategory(value)
    const group = value === NONE_GROUP_VALUE ? '' : value
    const first = deckList.find((d) => (d.group ?? '') === group)
    if (first) void openDeck(first)
  }

  const handleLeaveEditor = async (): Promise<void> => {
    if (!(await confirmDiscard())) return
    void backToLibrary()
  }

  const handleManageDecks = async (): Promise<void> => {
    if (!(await confirmDiscard())) return
    void backToLibrary()
  }

  const handleExportYdk = async (): Promise<void> => {
    const res = await saveDeckFile()
    if (res.success && res.filePath) {
      void alertDialog(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (deck.main.length + deck.extra.length + deck.side.length === 0) return
    if (await confirmDialog({ title: '清空卡组', description: '是否清空正在编辑的卡组？' })) {
      clearDeck()
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <div className="relative shrink-0 bg-card border-b border-border px-3 py-2 flex items-stretch gap-2 [-webkit-app-region:drag]">
        <div className="flex flex-col gap-1 w-[124px] shrink-0 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={handleLeaveEditor}
            title="返回卡组总览库"
            className="flex-1 min-h-0 rounded-md border border-border bg-muted/40 text-sm font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
          >
            退出编辑
          </button>
          <div className="grid grid-cols-1 gap-1 h-16 shrink-0">
            <MiniButton
              icon={Download}
              label="导出 YDK"
              title="导出卡组为标准 .ydk 文件"
              onClick={() => void handleExportYdk()}
            />
            <MiniButton
              icon={Dices}
              label="手牌测试"
              title="模拟起手随机抽取 5 张手牌"
              onClick={drawTestHand}
              disabled={deck.main.length === 0}
            />
          </div>
        </div>

        <div className="w-[430px] shrink-0 rounded-md border border-border bg-muted/20 p-2 flex flex-col gap-1 justify-between [-webkit-app-region:no-drag]">
          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">卡组分类：</span>
            <Select value={browsedCategory} onValueChange={handleBrowseCategory}>
              <SelectTrigger size="sm" className="h-6 flex-1 min-w-0 bg-background/70 text-xs">
                <SelectValue>
                  {browsedCategory === NONE_GROUP_VALUE
                    ? '未分组'
                    : browsedCategory.split('/').map(groupLeafName).join(' / ')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="max-h-72">
                <SelectItem value={NONE_GROUP_VALUE}>未分组</SelectItem>
                {deckGroups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g.split('/').map(groupLeafName).join(' / ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PanelButton
              label="管理"
              title="打开卡组库管理分组与卡组"
              onClick={handleManageDecks}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">卡组名称：</span>
            <Input
              type="text"
              value={deck.name}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="输入卡组名称"
              className="h-6 flex-1 min-w-0 bg-background/70 text-xs"
            />
            <PanelButton
              label="保存"
              title="保存当前卡组到卡组库"
              emphasize
              onClick={() => void handleSave()}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">描述：</span>
            <Input
              type="text"
              value={deck.description || ''}
              onChange={(e) => setDeckDescription(e.target.value)}
              placeholder="描述"
              className="h-6.5 flex-1 min-w-0 bg-background/60 border-border/60 text-[11.5px]"
            />
            {saveToast && (
              <span className="text-[11px] font-bold text-emerald-500 animate-in fade-in duration-150 shrink-0">
                {saveToast}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <PanelButton
              label="打乱"
              title="随机打乱主卡组顺序"
              onClick={shuffleDeck}
              disabled={deck.main.length === 0}
            />
            <PanelButton
              label="排序"
              title="卡组智能排序 (怪兽/魔陷/星级/攻击力)"
              onClick={sortDeck}
              disabled={deck.main.length === 0 && deck.extra.length === 0}
            />
            <PanelButton label="清空" title="清空正在编辑的卡组" onClick={handleClear} />
            <div className="flex-1" />
            <PanelButton
              label="删除"
              title="从卡组库删除当前卡组"
              onClick={() => void handleDelete()}
              disabled={!deck.id}
            />
          </div>
        </div>

        <FilterDrawer
          variant="band"
          className="flex-1 min-w-0"
          headerSlot={<WindowControls size="sm" actions={['maximize']} className="-mr-1" />}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={deckCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 flex overflow-hidden min-h-0">
          <DeckDetailCard
            card={detailCard}
            isCover={detailCard ? deck.coverCard === detailCard.id : false}
          />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 flex min-h-0">
              <main className="relative flex-1 flex flex-col p-2 min-w-0 min-h-0 bg-background/50">
                <DeckGrid
                  deck={deck}
                  stats={stats}
                  cardDetails={cardDetails}
                  isDragActive={activeDrag !== null}
                  flash={flash}
                  coverCard={deck.coverCard}
                  onSelectCard={handleSelectCard}
                  onHoverCard={handleHoverCard}
                  onRemoveCard={removeCard}
                  onSetCover={(code) => {
                    setDeckCover(code)
                    setSelectedCard(cardDetails[code] ?? null)
                    handleClearHover()
                  }}
                  onClearCover={() => setDeckCover(undefined)}
                />

                {rejectMessage && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <span className="bg-black/85 text-white text-sm font-bold tracking-wide px-6 py-2.5 rounded-md shadow-2xl animate-in fade-in duration-150">
                      {rejectMessage}
                    </span>
                  </div>
                )}
              </main>

              <DeckSearchPanel onSelectCard={handleSelectCard} onAddCard={handleAddCard} />
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={activeDrag?.source === 'deck' ? DROP_ANIMATION : null}>
          {activeDrag && (
            <div
              className="pointer-events-none overflow-hidden rounded border border-primary/80 shadow-2xl ring-2 ring-primary/40"
              style={{ width: activeDrag.width, height: activeDrag.height }}
            >
              <img
                src={getCardImageUrl(activeDrag.code, true)}
                alt={cardDetails[activeDrag.code]?.name ?? ''}
                draggable={false}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = CARD_BACK_IMAGE
                }}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {testHandCards && (
        <DeckTestHandModal
          cards={testHandCards}
          cardDetails={cardDetails}
          onRedraw={drawTestHand}
          onClose={closeTestHand}
        />
      )}
    </div>
  )
}
