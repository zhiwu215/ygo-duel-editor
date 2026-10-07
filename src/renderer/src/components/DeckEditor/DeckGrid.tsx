import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useState } from 'react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { canPlaceInSection, CdbCard, DeckData, DeckSection } from '@shared/index'
import { DeckCardItem } from './DeckCardItem'
import { DeckDragSourceData, DeckDropTargetData } from './deckDnd'
import { cn } from '../../lib/utils'
import { Ban, Plus, Check, ImageIcon, Eye, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

interface SortableCard {
  id: string
  code: number
}

const getSortableCards = (section: DeckSection, codes: number[]): SortableCard[] => {
  const occurrences = new Map<number, number>()
  return codes.map((code) => {
    const occurrence = occurrences.get(code) ?? 0
    occurrences.set(code, occurrence + 1)
    return { id: `${section}:${code}:${occurrence}`, code }
  })
}

interface DeckGridProps {
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  coverCard: number | undefined
  isDragActive: boolean
  onSelectCard: (card: CdbCard | null) => void
  onHoverCard: (code: number | null) => void
  onRemoveCard: (section: DeckSection, index: number) => void
  onSetCover: (code: number) => void
  onClearCover: () => void
}

const DeckZone: React.FC<{
  section: DeckSection
  className?: string
  children: React.ReactNode
}> = ({ section, className, children }) => {
  const { setNodeRef } = useDroppable({
    id: `zone:${section}`,
    data: { kind: 'zone', section } as DeckDropTargetData
  })
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  )
}

const DeckZoneFeedback: React.FC<{
  cardDetails: Record<number, CdbCard>
  isDragActive: boolean
}> = ({ cardDetails, isDragActive }) => {
  const { active, over } = useDndContext()
  const source = active?.data.current as DeckDragSourceData | undefined
  const target = over?.data.current as DeckDropTargetData | undefined
  const targetSection = target && target.kind !== 'search-panel' ? target.section : null
  if (!isDragActive || !source || !targetSection) return null

  let valid: boolean
  if (source.source === 'search') {
    valid = canPlaceInSection(source.card.type, targetSection)
  } else if (source.section === targetSection) {
    valid = true
  } else {
    const type = cardDetails[source.code]?.type
    valid = type === undefined || canPlaceInSection(type, targetSection)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-2.5">
        {valid && source.source === 'search' && (
          <span className="text-xs font-bold text-foreground/70">可以向卡组中添加卡片</span>
        )}
        <div className="w-24 h-24 rounded-full bg-white shadow-2xl ring-1 ring-black/10 flex items-center justify-center">
          {valid ? (
            <Plus className="w-12 h-12 text-blue-600" strokeWidth={3} />
          ) : (
            <Ban className="w-11 h-11 text-red-600" strokeWidth={2.5} />
          )}
        </div>
      </div>
    </div>
  )
}

const ZONE_CLASS = 'flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60'
const ZONE_HEADER_CLASS =
  'flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5'

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  cardDetails,
  coverCard,
  isDragActive,
  onSelectCard,
  onHoverCard,
  onRemoveCard,
  onSetCover,
  onClearCover
}) => {
  const [menu, setMenu] = useState<{ code: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menu])

  const sortableCards = {
    main: getSortableCards('main', deck.main),
    extra: getSortableCards('extra', deck.extra),
    side: getSortableCards('side', deck.side)
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div
          className={cn(
            'pr-1 flex flex-col gap-3 select-none',
            isDragActive && 'pointer-events-none'
          )}
        >
          {/* 1. 主卡组网格 (10 列) */}
          <DeckZone section="main" className={ZONE_CLASS}>
            <div className={ZONE_HEADER_CLASS}>
              <span>主卡组 (10 列网格)</span>
              <span className="text-[11px] font-normal">拖动调整，右键移出卡组</span>
            </div>

            {deck.main.length > 0 ? (
              <SortableContext items={sortableCards.main} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-10 gap-1.5 w-full">
                  {sortableCards.main.map(({ id, code }, index) => (
                    <DeckCardItem
                      key={id}
                      sortableId={id}
                      code={code}
                      card={cardDetails[code]}
                      section="main"
                      index={index}
                      isCover={coverCard === code}
                      onSelect={onSelectCard}
                      onHover={onHoverCard}
                      onOpenMenu={(c, x, y) => setMenu({ code: c, x, y })}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div className="h-28 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
                {isDragActive ? '' : '主卡组为空，可从右侧拖入或点击卡片加入'}
              </div>
            )}
          </DeckZone>

          {/* 2. 额外卡组网格 (10 列) */}
          <DeckZone section="extra" className={ZONE_CLASS}>
            <div className={ZONE_HEADER_CLASS}>
              <span>额外卡组</span>
              <span className="text-[11px] font-normal">融合 / 同调 / 超量 / 连接</span>
            </div>

            {deck.extra.length > 0 ? (
              <SortableContext items={sortableCards.extra} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-10 gap-1.5 w-full">
                  {sortableCards.extra.map(({ id, code }, index) => (
                    <DeckCardItem
                      key={id}
                      sortableId={id}
                      code={code}
                      card={cardDetails[code]}
                      section="extra"
                      index={index}
                      isCover={coverCard === code}
                      onSelect={onSelectCard}
                      onHover={onHoverCard}
                      onOpenMenu={(c, x, y) => setMenu({ code: c, x, y })}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
                {isDragActive ? '' : '额外卡组为空'}
              </div>
            )}
          </DeckZone>

          {/* 3. 副卡组网格 (10 列) */}
          <DeckZone section="side" className={ZONE_CLASS}>
            <div className={ZONE_HEADER_CLASS}>
              <span>副卡组</span>
              <span className="text-[11px] font-normal">备用卡</span>
            </div>

            {deck.side.length > 0 ? (
              <SortableContext items={sortableCards.side} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-10 gap-1.5 w-full">
                  {sortableCards.side.map(({ id, code }, index) => (
                    <DeckCardItem
                      key={id}
                      sortableId={id}
                      code={code}
                      card={cardDetails[code]}
                      section="side"
                      index={index}
                      isCover={coverCard === code}
                      onSelect={onSelectCard}
                      onHover={onHoverCard}
                      onOpenMenu={(c, x, y) => setMenu({ code: c, x, y })}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
                {isDragActive ? '' : '副卡组为空'}
              </div>
            )}
          </DeckZone>
        </div>
      </ScrollArea>
      <DeckZoneFeedback cardDetails={cardDetails} isDragActive={isDragActive} />

      {menu &&
        (() => {
          const located = (
            [
              ['main', deck.main],
              ['extra', deck.extra],
              ['side', deck.side]
            ] as Array<[DeckSection, number[]]>
          ).find(([, codes]) => codes.includes(menu.code))
          if (!located) return null
          const [section, codes] = located
          const index = codes.indexOf(menu.code)
          const card = cardDetails[menu.code]
          return (
            <div
              style={{
                left: Math.min(menu.x, window.innerWidth - 190),
                top: Math.min(menu.y, window.innerHeight - 150)
              }}
              className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 mb-1 truncate max-w-44">
                {card?.name ?? `卡密 ${menu.code}`}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (coverCard === menu.code) onClearCover()
                  else onSetCover(menu.code)
                  setMenu(null)
                }}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
              >
                {coverCard === menu.code ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>{coverCard === menu.code ? '取消卡组封面' : '设为卡组封面'}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (card) onSelectCard(card)
                  setMenu(null)
                }}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span>查看详情</span>
              </Button>

              <Separator className="my-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemoveCard(section, index)
                  setMenu(null)
                }}
                className="w-full justify-start gap-2 h-7 px-2 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>移出卡组</span>
              </Button>
            </div>
          )
        })()}
    </div>
  )
}
