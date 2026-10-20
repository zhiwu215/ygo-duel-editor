import React from 'react'
import { DuelStep } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { resolveTeamLabel } from '../../utils/duelistNames'
import { cn } from '../../lib/utils'

type LpChange = NonNullable<DuelStep['lpChange']>

interface StepLpChangeProps {
  lpChange: LpChange
  turn: number
}

export const StepLpChange: React.FC<StepLpChangeProps> = ({ lpChange, turn }) => {
  const duelists = useDuelStore((s) => s.state.duelists)
  const delta = lpChange.newLp - lpChange.oldLp
  const isLoss = delta < 0
  const isGain = delta > 0
  const playerName = resolveTeamLabel({ duelists }, lpChange.player, turn)

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 select-none',
        isLoss
          ? 'border-rose-500/30 bg-rose-500/[0.07]'
          : isGain
            ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
            : 'border-border/60 bg-muted/30'
      )}
    >
      <span
        className={cn(
          'h-7 w-1 shrink-0 rounded-full',
          isLoss ? 'bg-rose-500' : isGain ? 'bg-emerald-500' : 'bg-muted-foreground/50'
        )}
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[10px] font-semibold text-foreground/80">{playerName}</span>
        <span
          className={cn(
            'text-[10px] font-bold leading-tight',
            isLoss ? 'text-rose-400' : isGain ? 'text-emerald-400' : 'text-muted-foreground'
          )}
        >
          {isLoss ? '伤害' : isGain ? '回复' : 'LP 变化'}
        </span>
      </div>
      <span
        className={cn(
          'ml-auto shrink-0 font-mono text-lg font-bold leading-none tabular-nums',
          isLoss ? 'text-rose-400' : isGain ? 'text-emerald-400' : 'text-muted-foreground'
        )}
      >
        {Math.abs(delta)}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        LP {lpChange.newLp}
      </span>
    </div>
  )
}
