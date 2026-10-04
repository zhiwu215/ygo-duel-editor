import React from 'react'
import { Crown } from 'lucide-react'
import { Duelist } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { cn } from '../../../lib/utils'

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

  return (
    <div
      className={cn(
        'relative inline-flex items-center group cursor-pointer select-none',
        className
      )}
      title={`行动顺位：第 ${currentOrder} 位（点击可直接切换全场顺位）`}
    >
      {/* 视觉展现徽标 */}
      <div
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all pointer-events-none',
          isFirst
            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold shadow-xs'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-border/70 group-hover:border-primary/50'
        )}
      >
        {isFirst ? (
          <Crown className="w-3 h-3 text-amber-500 shrink-0" />
        ) : (
          <span className="font-mono text-[9px] font-semibold text-muted-foreground">#</span>
        )}
        <span>{isFirst ? '1 先攻' : totalCount === 2 ? '2 后攻' : `${currentOrder} 顺位`}</span>
      </div>

      {/* 原生下拉无缝浮动层：点击即呼出顺位选择 */}
      <select
        value={currentOrder}
        onChange={(e) => setDuelistTurnOrder(duelist.id, Number(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
        title="选择行动顺序 (1 为先攻)"
      >
        {Array.from({ length: Math.max(2, totalCount) }, (_, i) => i + 1).map((order) => (
          <option key={order} value={order} className="bg-popover text-popover-foreground">
            {order === 1 ? '1 先攻' : totalCount === 2 ? '2 后攻' : `${order} 顺位`}
          </option>
        ))}
      </select>
    </div>
  )
}
