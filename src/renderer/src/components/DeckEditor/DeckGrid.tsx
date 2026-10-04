import React from 'react'
import { DeckData, CdbCard } from '@shared/index'
import { DeckCardItem } from './DeckCardItem'

interface DeckGridProps {
  deck: DeckData
  cardDetails: Record<number, CdbCard>
  onSelectCard: (card: CdbCard | null) => void
  onRemoveCard: (section: 'main' | 'extra' | 'side', index: number) => void
}

export const DeckGrid: React.FC<DeckGridProps> = ({
  deck,
  cardDetails,
  onSelectCard,
  onRemoveCard
}) => {
  return (
    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0 select-none">
      {/* 1. 主卡组网格 (10 列) */}
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
          <span>主卡组 (10 列网格)</span>
          <span className="text-[11px] font-normal">右键单张可移出卡组</span>
        </div>

        {deck.main.length > 0 ? (
          <div className="grid grid-cols-10 gap-1.5 w-full">
            {deck.main.map((code, index) => (
              <DeckCardItem
                key={`main_${index}_${code}`}
                code={code}
                card={cardDetails[code]}
                section="main"
                index={index}
                onSelect={onSelectCard}
                onRemove={onRemoveCard}
              />
            ))}
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
            主卡组为空，请从右侧点击卡片加入
          </div>
        )}
      </div>

      {/* 2. 额外卡组网格 (10 列) */}
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
          <span>额外卡组</span>
          <span className="text-[11px] font-normal">融合 / 同调 / 超量 / 连接</span>
        </div>

        {deck.extra.length > 0 ? (
          <div className="grid grid-cols-10 gap-1.5 w-full">
            {deck.extra.map((code, index) => (
              <DeckCardItem
                key={`extra_${index}_${code}`}
                code={code}
                card={cardDetails[code]}
                section="extra"
                index={index}
                onSelect={onSelectCard}
                onRemove={onRemoveCard}
              />
            ))}
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
            额外卡组为空
          </div>
        )}
      </div>

      {/* 3. 副卡组网格 (10 列) */}
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-card/60 border border-border/60">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
          <span>副卡组</span>
          <span className="text-[11px] font-normal">备用卡</span>
        </div>

        {deck.side.length > 0 ? (
          <div className="grid grid-cols-10 gap-1.5 w-full">
            {deck.side.map((code, index) => (
              <DeckCardItem
                key={`side_${index}_${code}`}
                code={code}
                card={cardDetails[code]}
                section="side"
                index={index}
                onSelect={onSelectCard}
                onRemove={onRemoveCard}
              />
            ))}
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border border-dashed border-border/60 rounded text-xs text-muted-foreground italic">
            副卡组为空
          </div>
        )}
      </div>
    </div>
  )
}
