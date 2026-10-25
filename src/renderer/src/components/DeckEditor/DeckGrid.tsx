import { ScrollArea } from '../ui/scroll-area'
import React, { useMemo, useRef } from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { CdbCard, DeckData, DeckSection, DeckStats } from '@shared/index'
import { DeckCardItem } from './DeckCardItem'
import { cn } from '../../lib/utils'
import { getCodeOccurrences } from '../../utils/cardOccurrences'
import { useDeckGridLayout, ZONE_STACK_GAP } from '../../hooks/useDeckGridLayout'
import { DeckZone, ZoneHeader, type TypeTally } from './DeckZoneHeader'
import { DeckZoneFeedback } from './DeckZoneFeedback'
import cardTypeMonster from '../../assets/card/type/monster.png'
import cardTypeSpell from '../../assets/card/type/spell.png'
import cardTypeTrap from '../../assets/card/type/trap.png'
import cardTypeFusion from '../../assets/card/type/fusion.png'
import cardTypeSynchro from '../../assets/card/type/synchro.png'
import cardTypeXyz from '../../assets/card/type/xyz.png'
import cardTypeLink from '../../assets/card/type/link.png'

interface SortableCard {
  id: string
  code: number
}

const getSortableCards = (section: DeckSection, codes: number[]): SortableCard[] => {
  const occurrences = getCodeOccurrences(codes)
  return codes.map((code, index) => ({
    id: `${section}:${code}:${occurrences[index]}`,
    code
  }))
}

export interface DeckFlashTarget {
  section: DeckSection
  index: number
}

interface DeckGridProps {
  deck: DeckData
  stats: DeckStats
  cardDetails: Record<number, CdbCard>
  isDragActive: boolean
  flash: DeckFlashTarget | null
  onSelectCard: (card: CdbCard) => void
  onRemoveCard: (section: DeckSection, index: number) => void
}

const ZONE_CLASS = 'flex flex-col gap-1.5'

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  stats,
  cardDetails,
  isDragActive,
  flash,
  onSelectCard,
  onRemoveCard
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { gridStyle, cardHeight, gridWidth } = useDeckGridLayout(scrollRef)

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
                  isFlash={flash?.section === section && flash?.index === index}
                  onSelect={onSelectCard}
                  onRemove={onRemoveCard}
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
    </div>
  )
}
