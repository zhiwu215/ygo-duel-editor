import type { JSX } from 'react'
import { CardImage } from '../ui/CardImage'
import { BookOpen, X } from 'lucide-react'
import { AgentTextSourceRef, CardUtils, CdbCard } from '@shared/index'

interface AttachmentChipsProps {
  cards: CdbCard[]
  text: AgentTextSourceRef | null
  onRemoveCard: (cardId: number) => void
  onRemoveText: () => void
}

export function AttachmentChips({
  cards,
  text,
  onRemoveCard,
  onRemoveText
}: AttachmentChipsProps): JSX.Element {
  return (
    <>
      {cards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cards.map((card) => (
            <div
              key={card.id}
              className="group flex w-[220px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-1.5 shadow-xs"
              title={card.name}
            >
              <CardImage
                code={card.id}
                small
                alt={card.name}
                className="h-10 w-7 shrink-0 rounded-[3px] border border-border/50 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs leading-tight font-medium text-foreground">
                  {card.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                  {CardUtils.getCardTypeLabel(card.type)} · {card.id}
                </p>
              </div>
              <button
                type="button"
                aria-label={`移除 ${card.name}`}
                title="移除"
                onClick={() => onRemoveCard(card.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {text && (
        <div className="flex flex-wrap gap-1.5">
          <div
            className="group flex w-[220px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-2 shadow-xs"
            title={text.title}
          >
            <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs leading-tight font-medium text-foreground">
                {text.title}
              </p>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                文本素材{text.wordCount ? ` · 约 ${text.wordCount} 字` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label={`移除 ${text.title}`}
              title="移除"
              onClick={onRemoveText}
              className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
