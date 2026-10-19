import type { JSX } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
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
          {cards.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-1.5 rounded border border-border bg-muted/60 pl-1.5 pr-1 py-1 max-w-full"
            >
              <CardImage
                code={c.id}
                small
                alt={c.name}
                className="w-6 h-8 object-cover rounded-sm shrink-0 border border-border/60"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium leading-tight truncate max-w-32">{c.name}</p>
                <p className="text-[9px] text-muted-foreground font-mono leading-tight">
                  {CardUtils.getCardTypeLabel(c.type)} · {c.id}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onRemoveCard(c.id)}
                      className="p-0.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  }
                />
                <TooltipContent>移除这张卡片</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {text && (
        <div className="flex flex-wrap gap-1.5">
          <div className="group flex items-center gap-1.5 rounded border border-border bg-muted/60 pl-2 pr-1 py-1 max-w-full">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium leading-tight truncate max-w-52">
                {text.title}
              </p>
              <p className="text-[9px] text-muted-foreground font-mono leading-tight">
                {text.wordCount ? `约 ${text.wordCount} 字` : '文本素材'}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onRemoveText}
                    className="p-0.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                }
              />
              <TooltipContent>移除这本文本素材</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </>
  )
}
