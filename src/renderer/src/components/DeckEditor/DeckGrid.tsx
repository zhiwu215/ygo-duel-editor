import { ScrollArea } from '../ui/scroll-area'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { CdbCard, DeckData, DeckSection, DeckStats } from '@shared/index'
import { DeckCardItem } from './DeckCardItem'
import { resolveCardName } from '../../utils/cardNames'
import { cn } from '../../lib/utils'
import { Check, ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { useDeckGridLayout, ZONE_STACK_GAP } from '../../hooks/useDeckGridLayout'
import { DeckZone, ZoneHeader, type TypeTally } from './DeckZoneHeader'
import { DeckZoneFeedback } from './DeckZoneFeedback'
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

export interface DeckFlashTarget {
  section: DeckSection
  index: number
}

interface DeckGridProps {
  deck: DeckData
  stats: DeckStats
  cardDetails: Record<number, CdbCard>
  coverCard: number | undefined
  isDragActive: boolean
  flash: DeckFlashTarget | null
  onSelectCard: (card: CdbCard | null) => void
  onHoverCard: (code: number | null) => void
  onRemoveCard: (section: DeckSection, index: number) => void
  onSetCover: (code: number) => void
  onClearCover: () => void
}

const ZONE_CLASS = 'flex flex-col gap-1.5'

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  stats,
  cardDetails,
  coverCard,
  isDragActive,
  flash,
  onSelectCard,
  onHoverCard,
  onRemoveCard,
  onSetCover,
  onClearCover
}) => {
  const [menu, setMenu] = useState<{ code: number; x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { gridStyle, cardHeight, gridWidth } = useDeckGridLayout(scrollRef)

  const handleOpenMenu = useCallback((code: number, x: number, y: number): void => {
    setMenu({ code, x, y })
  }, [])
  const handleClearMenu = useCallback((): void => setMenu(null), [])

  useDismissOnOutside(null, Boolean(menu), handleClearMenu)

  const sortableCards = useMemo(
    () => ({
      main: getSortableCards('main', deck.main),
      extra: getSortableCards('extra', deck.extra),
      side: getSortableCards('side', deck.side)
    }),
    [deck.main, deck.extra, deck.side]
  )

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
                  isFlash={flash?.section === section && flash?.index === index}
                  onSelect={onSelectCard}
                  onHover={onHoverCard}
                  onOpenMenu={handleOpenMenu}
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
  const sideTallies: TypeTally[] = [
    { sprite: cardTypeMonster, label: '怪兽', count: stats.sideMonsterCount },
    { sprite: cardTypeSpell, label: '魔法', count: stats.sideSpellCount },
    { sprite: cardTypeTrap, label: '陷阱', count: stats.sideTrapCount }
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
                tallies={sideTallies}
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
                {card?.name || resolveCardName(menu.code)}
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
