import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React from 'react'
import { CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Dices, X } from 'lucide-react'

interface DeckTestHandModalProps {
  cards: number[]
  cardDetails: Record<number, CdbCard>
  onRedraw: () => void
  onClose: () => void
}

export const DeckTestHandModal: React.FC<DeckTestHandModalProps> = ({
  cards,
  cardDetails,
  onRedraw,
  onClose
}) => {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-4 max-w-[820px] w-full animate-in zoom-in-95 duration-100 ring-0 sm:max-w-[820px]"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border/60 pb-2">
          <DialogTitle className="text-sm font-bold">手牌起手模拟测试 (5 张)</DialogTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={onRedraw}
              className="gap-1 h-7 text-xs font-semibold"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>重新洗牌试抽</span>
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-3 py-2">
          {cards.map((code, idx) => {
            const card = cardDetails[code]
            return (
              <div
                key={`testhand_${idx}_${code}`}
                className="flex flex-col gap-1.5 items-center group"
              >
                <div className="aspect-[59/86] w-full rounded-lg overflow-hidden border border-border shadow-md bg-background group-hover:scale-105 transition-transform duration-150">
                  <img
                    src={getCardImageUrl(code)}
                    alt={card?.name || String(code)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).src = CARD_BACK_IMAGE
                    }}
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="text-[11px] font-medium text-foreground text-center truncate w-full">
                        {card?.name || code}
                      </span>
                    }
                  />
                  <TooltipContent>{card?.name || String(code)}</TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
