import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
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
import { CardUtils, CdbCard, DeckSection, groupChildPath, groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
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
import { DeckTestHandModal } from './DeckTestHandModal'
import { DeckApplyModal } from './DeckApplyModal'
import { GroupNameModal } from './GroupNameModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import {
  ArrowLeft,
  Folder,
  FolderPlus,
  Save,
  ArrowUpDown,
  Dices,
  Swords,
  Trash2,
  FilePlus2,
  Download,
  FileText
} from 'lucide-react'

const NONE_GROUP_VALUE = '__none__'
const NEW_GROUP_VALUE = '__new__'

/** 卡组内卡片落位时的回弹动画；从搜索面板拖入的新卡不回弹（源节点不动，回弹会看成失败） */
const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
const FLASH_DURATION = 700

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
    cardDetails,
    selectedCard,
    hoveredCardId,
    testHandCards,
    deckGroups,
    setSelectedCard,
    setHoveredCardId,
    setDeckName,
    setDeckDescription,
    setDeckGroup,
    createGroup,
    setDeckCover,
    addCard,
    removeCard,
    moveCard,
    moveCardBetweenSections,
    clearDeck,
    sortDeck,
    drawTestHand,
    closeTestHand,
    saveDeckFile,
    saveCurrentDeckToLibrary,
    backToLibrary,
    applyToDuel,
    getStats
  } = useDeckEditorStore()

  const [showApplyModal, setShowApplyModal] = useState<boolean>(false)
  const [groupModalOpen, setGroupModalOpen] = useState<boolean>(false)
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

  const handleSaveToLibrary = async (): Promise<void> => {
    const ok = await saveCurrentDeckToLibrary()
    if (ok) {
      setSaveToast('卡组已成功保存到资产库')
      setTimeout(() => setSaveToast(null), 2000)
    } else {
      alert('保存到卡组库失败')
    }
  }

  const handleExportYdk = async (): Promise<void> => {
    const res = await saveDeckFile()
    if (res.success && res.filePath) {
      alert(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  const handleClear = (): void => {
    if (deck.main.length > 0 || deck.extra.length > 0 || deck.side.length > 0) {
      if (confirm('确认清空当前卡组的所有卡片？')) {
        clearDeck()
      }
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <header className="h-11 px-3 border-b border-border bg-card flex items-center justify-between shrink-0 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => void backToLibrary()}
                  className="h-7 px-2 gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>返回卡组库</span>
                </Button>
              }
            />
            <TooltipContent>返回卡组总览库</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Input
                  type="text"
                  value={deck.name}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="卡组名称"
                  className="h-7 w-52 text-xs font-bold bg-background/80 border-border/80"
                />
              }
            />
            <TooltipContent>点击修改卡组名称</TooltipContent>
          </Tooltip>

          {saveToast && (
            <span className="text-[11px] font-bold text-emerald-500 animate-in fade-in duration-150">
              {saveToast}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => void handleSaveToLibrary()}
                  className="h-7 px-2.5 gap-1 text-xs font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>保存到库</span>
                </Button>
              }
            />
            <TooltipContent>保存卡组修改至本地卡组资产库</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearDeck}
                  className="h-7 px-2 gap-1 text-xs"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>新建</span>
                </Button>
              }
            />
            <TooltipContent>新建空白卡组</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void handleExportYdk()}
                  className="h-7 px-2 gap-1 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>导出 YDK</span>
                </Button>
              }
            />
            <TooltipContent>导出卡组为标准 .ydk 文件</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={sortDeck}
                  disabled={deck.main.length === 0 && deck.extra.length === 0}

                  className="h-7 px-2 gap-1 text-xs"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>排序</span>
                </Button>
              }
            />
            <TooltipContent>卡组智能排序 (怪兽/魔陷/星级/攻击力)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={drawTestHand}
                  disabled={deck.main.length === 0}

                  className="h-7 px-2.5 gap-1 text-xs font-semibold"
                >
                  <Dices className="w-3.5 h-3.5 text-primary" />
                  <span>手牌测试</span>
                </Button>
              }
            />
            <TooltipContent>模拟起手随机抽取 5 张手牌</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setShowApplyModal(true)}
                  disabled={deck.main.length === 0 && deck.extra.length === 0}

                  className="h-7 px-3 gap-1.5 text-xs font-bold shadow-xs"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>送入决斗盘</span>
                </Button>
              }
            />
            <TooltipContent>将当前卡组直接装载到主界面的决斗盘中</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClear}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>清空当前卡组</TooltipContent>
          </Tooltip>

          <WindowControls className="-mr-3 ml-0.5" />
        </div>
      </header>

      <div className="px-3 py-1.5 bg-muted/30 border-b border-border/70 flex items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            value={deck.description || ''}
            onChange={(e) => setDeckDescription(e.target.value)}
            placeholder="描述"
            className="h-6.5 text-[11.5px] bg-background/60 border-border/60 flex-1 min-w-0"
          />
        </div>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Select
            value={deck.group || NONE_GROUP_VALUE}
            onValueChange={(value) => {
              if (value === NEW_GROUP_VALUE) {
                setGroupModalOpen(true)
                return
              }
              setDeckGroup(!value || value === NONE_GROUP_VALUE ? '' : value)
            }}
          >
            <SelectTrigger size="sm" className="h-6.5 w-32 text-[11.5px] bg-background/60">
              <SelectValue placeholder="选择分组" />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-40 max-h-72">
              <SelectItem value={NONE_GROUP_VALUE} className="text-xs py-1.5 pr-7 pl-2">
                未分组
              </SelectItem>
              {deckGroups.map((g) => (
                <SelectItem key={g} value={g} className="text-xs py-1.5 pr-7 pl-2">
                  {g.split('/').map(groupLeafName).join(' / ')}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={NEW_GROUP_VALUE} className="text-xs py-1.5 pr-7 pl-2">
                <FolderPlus className="w-3.5 h-3.5" />
                新建分组…
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      {showApplyModal && (
        <DeckApplyModal
          deck={deck}
          onConfirm={async (player, drawCount) => {
            return applyToDuel(player, drawCount)
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}

      {groupModalOpen && (
        <GroupNameModal
          initialName={null}
          existingGroups={deckGroups}
          onConfirm={async (name) => {
            const ok = await createGroup(name, null)
            if (ok) setDeckGroup(groupChildPath(null, name))
            return ok
          }}
          onClose={() => setGroupModalOpen(false)}
        />
      )}
    </div>
  )
}
