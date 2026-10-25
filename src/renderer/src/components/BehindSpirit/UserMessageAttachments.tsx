import type { JSX } from 'react'
import { BookOpen } from 'lucide-react'
import { CardUtils } from '@shared/index'
import { CardImage } from '../ui/CardImage'

interface UserMessageAttachmentsProps {
  cards?: { id: number; name: string; type?: number }[]
  text?: { title: string; wordCount?: number } | null
}

export function UserMessageAttachments({
  cards,
  text
}: UserMessageAttachmentsProps): JSX.Element | null {
  const hasCards = Boolean(cards && cards.length > 0)
  if (!hasCards && !text) return null

  return (
    <div className="flex w-full max-w-[95%] flex-col items-end gap-1.5">
      {hasCards && (
        <div className="flex w-full max-w-full flex-wrap justify-end gap-1.5">
          {cards?.map((card) => (
            <div
              key={card.id}
              className="flex w-[220px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-1.5 shadow-xs"
            >
              <CardImage
                code={card.id}
                small
                alt={card.name}
                className="h-10 w-7 shrink-0 rounded-[3px] border border-border/50 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-xs leading-tight font-medium text-foreground">
                  {card.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                  {card.type !== undefined
                    ? `${CardUtils.getCardTypeLabel(card.type)} · ${card.id}`
                    : card.id}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {text && (
        <div className="flex w-[220px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-2 shadow-xs">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-xs leading-tight font-medium text-foreground">
              {text.title}
            </p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
              文本素材{text.wordCount ? ` · 约 ${text.wordCount} 字` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
