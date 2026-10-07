import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { DeckSection } from '@shared/index'
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
import { DeckGrid } from './DeckGrid'
import { DeckStatsBar } from './DeckStatsBar'
import { DeckSearchPanel } from './DeckSearchPanel'
import { DeckTestHandModal } from './DeckTestHandModal'
import { DeckApplyModal } from './DeckApplyModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import {
  ArrowLeft,
  Folder,
  Save,
  ArrowUpDown,
  Dices,
  Swords,
  Trash2,
  FilePlus2,
  Download,
  Tag,
  FileText,
  Plus,
  X
} from 'lucide-react'

export const DeckEditorApp: React.FC = () => {
  const {
    viewMode,
    deck,
    cardDetails,
    selectedCard,
    testHandCards,
    deckGroups,
    setSelectedCard,
    setDeckName,
    setDeckDescription,
    setDeckGroup,
    addDeckTag,
    removeDeckTag,
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
  const [newTagInput, setNewTagInput] = useState<string>('')
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<{
    code: number
    width: number
    height: number
  } | null>(null)
  const [rejectMessage, setRejectMessage] = useState<string | null>(null)
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  if (viewMode === 'library') {
    return <DeckLibraryView />
  }

  const stats = getStats()

  const showRejectToast = (section: DeckSection): void => {
    if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current)
    setRejectMessage(`无法将该卡片加入${DECK_SECTION_NAMES[section]}`)
    rejectTimerRef.current = setTimeout(() => setRejectMessage(null), 1800)
  }

  const handleDragStart = (event: DragStartEvent): void => {
    const source = event.active.data.current as DeckDragSourceData | undefined
    if (!source) return
    const rect = event.active.rect.current.initial
    const width = rect?.width ?? 68
    setActiveDrag({
      code: source.source === 'search' ? source.card.id : source.code,
      width,
      height: rect?.height ?? (width * 86) / 59
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
      const ok =
        target.kind === 'deck-item'
          ? addCard(source.card, target.section, target.index)
          : addCard(source.card, target.section)
      if (!ok) showRejectToast(target.section)
      return
    }

    if (target.kind === 'search-panel') {
      removeCard(source.section, source.index)
      return
    }

    if (target.kind === 'zone') {
      if (
        target.section !== source.section &&
        !moveCardBetweenSections(source.section, source.index, target.section)
      ) {
        showRejectToast(target.section)
      }
      return
    }

    if (target.section === source.section) {
      if (target.index !== source.index) moveCard(source.section, source.index, target.index)
    } else if (
      !moveCardBetweenSections(source.section, source.index, target.section, target.index)
    ) {
      showRejectToast(target.section)
    }
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

  const handleAddTag = (): void => {
    if (newTagInput.trim()) {
      addDeckTag(newTagInput.trim())
      setNewTagInput('')
    }
  }

  const handleToggleCover = (): void => {
    if (!selectedCard) return
    if (deck.coverCard === selectedCard.id) {
      setDeckCover(undefined)
    } else {
      setDeckCover(selectedCard.id)
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
          <datalist id="deck-group-options">
            {deckGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Tooltip>
            <TooltipTrigger
              render={
                <Input
                  type="text"
                  list="deck-group-options"
                  value={deck.group || ''}
                  onChange={(e) => setDeckGroup(e.target.value)}
                  placeholder="剧情分组"
                  className="h-6.5 w-28 text-[11.5px] bg-background/60 border-border/60"
                />
              }
            />
            <TooltipContent>
              所属剧情分组：可从已有分组下拉选择，也可直接输入新名字（保存时自动创建）
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1.5 shrink-0 max-w-[420px] overflow-x-auto scrollbar-none">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          {deck.tags &&
            deck.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted/80 text-foreground border border-border/60 shrink-0"
              >
                <span>#{tag}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => removeDeckTag(tag)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    }
                  />
                  <TooltipContent>移除标签</TooltipContent>
                </Tooltip>
              </span>
            ))}

          <div className="flex items-center gap-1">
            <Input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="+ 标签回车"
              className="h-6 w-20 text-[11px] bg-background/60 border-border/60 px-1.5"
            />
            {newTagInput && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleAddTag}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 flex overflow-hidden min-h-0">
          <DeckDetailCard
            card={selectedCard}
            isCover={selectedCard ? deck.coverCard === selectedCard.id : false}
            onToggleCover={handleToggleCover}
          />

          <main className="relative flex-1 flex flex-col p-2.5 gap-2.5 min-w-0 min-h-0 bg-background/50">
            <DeckStatsBar stats={stats} />
            <DeckGrid
              deck={deck}
              cardDetails={cardDetails}
              isDragActive={activeDrag !== null}
              onSelectCard={setSelectedCard}
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

          <DeckSearchPanel onSelectCard={setSelectedCard} onAddCard={(card) => addCard(card)} />
        </div>

        <DragOverlay dropAnimation={null}>
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
    </div>
  )
}
