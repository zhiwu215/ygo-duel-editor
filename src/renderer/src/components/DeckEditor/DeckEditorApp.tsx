import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core'
import { CardUtils, CdbCard, DeckData, DeckSection } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { alertDialog, confirmDialog } from '../../stores/useDialogStore'
import { DECK_SECTION_NAMES } from './deckDnd'
import { DeckLibraryView } from './DeckLibraryView'
import { DeckDetailCard } from './DeckDetailCard'
import { DeckGrid, type DeckFlashTarget } from './DeckGrid'
import { DeckSearchPanel } from './DeckSearchPanel'
import { DeckTestHandModal } from './DeckTestHandModal'
import { DeckEditorToolbar, NONE_GROUP_VALUE } from './DeckEditorToolbar'
import { CardImage } from '../ui/CardImage'
import { deckCollisionDetection, useDeckDnd } from '../../hooks/useDeckDnd'
import { useDeckDirtyGuard } from '../../hooks/useDeckDirtyGuard'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { useDeckFileExport } from '../../hooks/useDeckFileExport'
import { getGroupSiblings, pickNextDeckAfterDelete } from '../../utils/deckLibraryView'

const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
const FLASH_DURATION = 700

export const DeckEditorApp: React.FC = () => {
  const {
    viewMode,
    deck,
    deckList,
    isLoadingLibrary,
    cardDetails,
    selectedCard,
    hoveredCardId,
    testHandCards,
    setSelectedCard,
    setHoveredCardId,
    setDeckGroup,
    setDeckCover,
    addCard,
    removeCard,
    moveCard,
    moveCardBetweenSections,
    clearDeck,
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

  const [rejectMessage, setRejectMessage] = useState<string | null>(null)
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flash, setFlash] = useState<DeckFlashTarget | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saveToast, showToast] = useFlashMessage(2000)

  const [browsedCategory, setBrowsedCategory] = useState<string>(deck.group || NONE_GROUP_VALUE)
  const [prevDeckId, setPrevDeckId] = useState<string | undefined>(deck.id)
  if (prevDeckId !== deck.id) {
    setPrevDeckId(deck.id)
    setBrowsedCategory(deck.group || NONE_GROUP_VALUE)
  }

  const { markDeckClean, confirmDiscard } = useDeckDirtyGuard(deck.id)

  const exportDeckFile = useDeckFileExport()

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

  const { activeDrag, sensors, handleDragStart, handleDragEnd, handleDragCancel } = useDeckDnd({
    addCard: handleAddCard,
    removeCard,
    moveCard,
    moveCardBetweenSections,
    showRejectToast,
    triggerFlash
  })

  if (viewMode === 'library') {
    return <DeckLibraryView />
  }

  const stats = getStats()

  const detailCard = (hoveredCardId !== null ? cardDetails[hoveredCardId] : null) ?? selectedCard
  const detailCardInDeck =
    detailCard &&
    (deck.main.includes(detailCard.id) ||
      deck.extra.includes(detailCard.id) ||
      deck.side.includes(detailCard.id))

  const browsedGroup = browsedCategory === NONE_GROUP_VALUE ? '' : browsedCategory

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
    const siblings = getGroupSiblings(deckList, browsedGroup)
    const ok = await deleteDeckFromLibrary(deck.id)
    if (!ok) {
      void alertDialog('删除失败')
      return
    }
    showToast('删除成功')
    const remaining = getGroupSiblings(useDeckEditorStore.getState().deckList, browsedGroup)
    const next = pickNextDeckAfterDelete(siblings, deck.id, remaining)
    if (next) {
      void openDeck(next)
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

  const handleExportYdk = (): Promise<void> => exportDeckFile(saveDeckFile)

  const handleClear = async (): Promise<void> => {
    if (deck.main.length + deck.extra.length + deck.side.length === 0) return
    if (await confirmDialog({ title: '清空卡组', description: '是否清空正在编辑的卡组？' })) {
      clearDeck()
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      <DeckEditorToolbar
        browsedCategory={browsedCategory}
        onBrowseCategory={handleBrowseCategory}
        saveToast={saveToast}
        onLeaveEditor={handleLeaveEditor}
        onManageDecks={handleManageDecks}
        onSave={() => void handleSave()}
        onExportYdk={() => void handleExportYdk()}
        onClear={handleClear}
        onDelete={() => void handleDelete()}
      />

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
            onToggleCover={
              detailCard && detailCardInDeck
                ? () => setDeckCover(deck.coverCard === detailCard.id ? undefined : detailCard.id)
                : undefined
            }
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
              <CardImage
                code={activeDrag.code}
                small
                alt={cardDetails[activeDrag.code]?.name ?? ''}
                draggable={false}
                className="w-full h-full object-cover"
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
