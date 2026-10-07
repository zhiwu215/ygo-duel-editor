import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { canPlaceInSection, CdbCard, DeckData, DeckSection, DeckStats } from '@shared/index'
import { DeckCardItem } from './DeckCardItem'
import { DeckDragSourceData, DeckDropTargetData } from './deckDnd'
import { cn } from '../../lib/utils'
import { Ban, Plus, Check, ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import cardTypeMonster from '../../assets/icons/cardtype/cardtype_1.png'
import cardTypeSpell from '../../assets/icons/cardtype/cardtype_2.png'
import cardTypeTrap from '../../assets/icons/cardtype/cardtype_3.png'
import cardTypeFusion from '../../assets/icons/cardtype/cardtype_4.png'
import cardTypeSynchro from '../../assets/icons/cardtype/cardtype_5.png'
import cardTypeXyz from '../../assets/icons/cardtype/cardtype_6.png'
import cardTypeLink from '../../assets/icons/cardtype/cardtype_7.png'

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
  stats: DeckStats
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

interface TypeTally {
  sprite: string
  label: string
  count: number
}

const TypeTallyBadge: React.FC<{ tally: TypeTally }> = ({ tally }) => (
  <span className="flex items-center gap-1 shrink-0" title={`${tally.label} ${tally.count} 张`}>
    <img src={tally.sprite} alt={tally.label} className="h-4 w-auto opacity-90" draggable={false} />
    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{tally.count}</span>
  </span>
)

const ZoneHeader: React.FC<{
  title: string
  total: number
  tallies: TypeTally[]
  unit?: string
  width: number
}> = ({ title, total, tallies, unit, width }) => (
  <div
    className="flex items-center justify-between gap-3 h-7 pl-2 pr-2.5 rounded-md bg-neutral-500/15 dark:bg-neutral-500/20 border border-border/40"
    style={{ width: `${width}px` }}
  >
    <div className="flex items-center gap-1.5 min-w-0 shrink">
      <span className="text-xs font-bold text-foreground truncate">{title}</span>
      <span className="text-xs text-muted-foreground font-normal">
        {total} 张{unit}
      </span>
    </div>
    <div className="flex items-center gap-2.5 min-w-0 shrink-0">
      {tallies.map((t) => (
        <TypeTallyBadge key={t.label} tally={t} />
      ))}
    </div>
  </div>
)

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

const ZONE_CLASS = 'flex flex-col gap-1.5'

const CARD_ASPECT = 59 / 86
const ROW_GAP = 6
const ZONE_HEADER_H = 28
const ZONE_PADDING = 4
const ZONE_CHROME = ZONE_HEADER_H + ZONE_PADDING + 4
const ZONE_STACK_GAP = 6
const H_SCROLLBAR_RESERVE = 10
const MAX_CARD_WIDTH = 72
const MIN_CARD_WIDTH = 22
const MIN_COLUMNS = 6
const MAX_COLUMNS = 30

interface Layout {
  cols: number
  cardWidth: number
}

const pickLayout = (
  availW: number,
  availH: number,
  counts: { main: number; extra: number; side: number }
): Layout => {
  const budget = availH - ZONE_CHROME * 3 - ZONE_STACK_GAP * 2
  const rowsAt = (cols: number): number =>
    Math.max(1, Math.ceil(counts.main / cols)) +
    Math.max(1, Math.ceil(counts.extra / cols)) +
    Math.max(1, Math.ceil(counts.side / cols))
  const widthAt = (cols: number): number =>
    (availW - ZONE_PADDING * 2 - ROW_GAP * (cols - 1)) / cols
  const heightCap = (cols: number): number =>
    ((budget - ROW_GAP * (rowsAt(cols) - 3)) / rowsAt(cols)) * CARD_ASPECT
  const spanOf = (cols: number, cardWidth: number): number =>
    cols * cardWidth + ROW_GAP * (cols - 1)
  const heightOf = (cols: number, cardWidth: number): number =>
    (rowsAt(cols) * cardWidth) / CARD_ASPECT + ROW_GAP * (rowsAt(cols) - 3)

  let best: Layout | null = null
  let bestOverflow = 0
  const consider = (cols: number, cardWidth: number): void => {
    const overflow = Math.max(0, heightOf(cols, cardWidth) - budget)
    if (!best) {
      best = { cols, cardWidth }
      bestOverflow = overflow
      return
    }
    if (overflow < bestOverflow - 0.5) {
      best = { cols, cardWidth }
      bestOverflow = overflow
      return
    }
    if (overflow > bestOverflow + 0.5) return
    if (cardWidth > best.cardWidth + 0.5) {
      best = { cols, cardWidth }
      return
    }
    if (
      cardWidth >= best.cardWidth - 0.5 &&
      spanOf(cols, cardWidth) > spanOf(best.cols, best.cardWidth)
    ) {
      best = { cols, cardWidth }
    }
  }

  for (let cols = MIN_COLUMNS; cols <= MAX_COLUMNS; cols++) {
    const cardWidth = Math.min(MAX_CARD_WIDTH, heightCap(cols), widthAt(cols))
    if (cardWidth >= MIN_CARD_WIDTH) consider(cols, cardWidth)
  }
  if (best) return best

  for (let cols = MIN_COLUMNS; cols <= MAX_COLUMNS; cols++) {
    const cardWidth = Math.min(MAX_CARD_WIDTH, widthAt(cols))
    if (cardWidth >= MIN_CARD_WIDTH) consider(cols, cardWidth)
  }
  return best ?? { cols: MIN_COLUMNS, cardWidth: MIN_CARD_WIDTH }
}

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  stats,
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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState<Layout>({ cols: 10, cardWidth: MAX_CARD_WIDTH })
  const layoutRef = useRef<Layout>(layout)
  const mainCount = deck.main.length
  const extraCount = deck.extra.length
  const sideCount = deck.side.length

  useLayoutEffect(() => {
    const counts = { main: mainCount, extra: extraCount, side: sideCount }
    const measure = (): void => {
      const el = scrollRef.current
      if (!el) return
      const availW = el.clientWidth
      const availH = el.clientHeight - H_SCROLLBAR_RESERVE
      if (availW <= 0 || availH <= 0) return
      const next = pickLayout(availW, availH, counts)
      const prev = layoutRef.current
      if (prev.cols === next.cols && Math.abs(prev.cardWidth - next.cardWidth) < 0.5) return
      layoutRef.current = next
      setLayout({ cols: next.cols, cardWidth: Math.round(next.cardWidth * 2) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (scrollRef.current) ro.observe(scrollRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mainCount, extraCount, sideCount])

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

  const gridStyle = {
    gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardWidth}px)`,
    gap: `${ROW_GAP}px`
  }
  const cardHeight = Math.round((layout.cardWidth * 86) / 59)
  const gridWidth = layout.cols * layout.cardWidth + ROW_GAP * (layout.cols - 1)
  const emptyBox = (text: string): React.ReactNode => (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-border/50 text-[11px] text-muted-foreground/70 italic"
      style={{ height: `${cardHeight}px`, width: `${gridWidth}px` }}
    >
      {text}
    </div>
  )

  const renderZone = (
    section: DeckSection,
    cards: SortableCard[],
    header: React.ReactNode,
    emptyText: string
  ): React.ReactNode => {
    const codes = section === 'main' ? deck.main : section === 'extra' ? deck.extra : deck.side
    return (
      <DeckZone key={section} section={section} className={ZONE_CLASS}>
        {header}
        {cards.length > 0 ? (
          <SortableContext items={cards} strategy={rectSortingStrategy}>
            <div className="grid justify-start" style={gridStyle}>
              {cards.map(({ id, code }, index) => (
                <DeckCardItem
                  key={id}
                  sortableId={id}
                  code={code}
                  card={cardDetails[code]}
                  section={section}
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
          codes.length === 0 && emptyBox(isDragActive ? '' : emptyText)
        )}
      </DeckZone>
    )
  }

  const mstTallies: TypeTally[] = [
    { sprite: cardTypeMonster, label: '怪兽', count: stats.monsterCount },
    { sprite: cardTypeSpell, label: '魔法', count: stats.spellCount },
    { sprite: cardTypeTrap, label: '陷阱', count: stats.trapCount }
  ]
  const exTallies: TypeTally[] = [
    { sprite: cardTypeFusion, label: '融合', count: stats.fusionCount },
    { sprite: cardTypeSynchro, label: '同调', count: stats.synchroCount },
    { sprite: cardTypeXyz, label: '超量', count: stats.xyzCount },
    { sprite: cardTypeLink, label: '连接', count: stats.linkCount }
  ]

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="relative flex-1 min-h-0">
        <ScrollArea className="size-full" horizontal>
          <div
            className={cn('flex flex-col select-none', isDragActive && 'pointer-events-none')}
            style={{ gap: `${ZONE_STACK_GAP}px` }}
          >
            {renderZone(
              'main',
              sortableCards.main,
              <ZoneHeader
                title="主卡组"
                total={stats.mainCount}
                tallies={mstTallies}
                width={gridWidth}
              />,
              '主卡组为空，可从右侧拖入或点击卡片加入'
            )}

            {renderZone(
              'extra',
              sortableCards.extra,
              <ZoneHeader
                title="额外卡组"
                total={stats.extraCount}
                tallies={exTallies}
                width={gridWidth}
              />,
              '额外卡组为空'
            )}

            {renderZone(
              'side',
              sortableCards.side,
              <ZoneHeader
                title="副卡组"
                total={stats.sideCount}
                tallies={mstTallies}
                width={gridWidth}
              />,
              '副卡组为空'
            )}
          </div>
        </ScrollArea>
      </div>
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
