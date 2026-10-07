import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React from 'react'
import { Crown } from 'lucide-react'
import { Duelist } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { cn } from '../../../lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../ui/select'

interface TurnOrderBadgeProps {
  duelist: Duelist
  totalCount: number
  className?: string
}

export const TurnOrderBadge: React.FC<TurnOrderBadgeProps> = ({
  duelist,
  totalCount,
  className
}) => {
  const { setDuelistTurnOrder } = useDuelStore()

  const currentOrder = duelist.turnOrder ?? (duelist.isFirst ? 1 : 2)
  const isFirst = currentOrder === 1
  const orders = Array.from({ length: Math.max(2, totalCount) }, (_, i) => i + 1)
  const orderLabel = (order: number): string =>
    order === 1 ? '1 先攻' : totalCount === 2 ? '2 后攻' : `${order} 顺位`

  return (
    <Select
      value={String(currentOrder)}
      onValueChange={(v) => setDuelistTurnOrder(duelist.id, Number(v))}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <SelectTrigger
              className={cn(
                'relative inline-flex items-center group select-none border-0 bg-transparent p-0 h-auto shadow-none focus-visible:ring-0 [&_svg]:hidden',
                className
              )}
            >
              {/* 视觉展现徽标 */}
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all',
                  isFirst
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-border/70 group-hover:border-primary/50'
                )}
              >
                {isFirst ? (
                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                ) : (
                  <span className="font-mono text-[9px] font-semibold text-muted-foreground">
                    #
                  </span>
                )}
                <span>{orderLabel(currentOrder)}</span>
              </div>
            </SelectTrigger>
          }
        />
        <TooltipContent>{`行动顺位：第 ${currentOrder} 位（点击可直接切换全场顺位）`}</TooltipContent>
      </Tooltip>
      <SelectContent className="min-w-24 w-auto">
        {orders.map((order) => (
          <SelectItem key={order} value={String(order)} className="text-xs">
            {orderLabel(order)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
