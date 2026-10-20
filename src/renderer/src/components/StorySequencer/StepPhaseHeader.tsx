import React from 'react'
import { DuelPhase, PHASE_SHORT_NAMES } from '@shared/index'
import { cn } from '../../lib/utils'

interface StepPhaseHeaderProps {
  phase: DuelPhase
  turnPlayer: 0 | 1
}

export const StepPhaseHeader: React.FC<StepPhaseHeaderProps> = ({ phase, turnPlayer }) => (
  <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 select-none">
    <span
      className={cn(
        'h-3.5 w-1 rounded-full shrink-0',
        turnPlayer === 0 ? 'bg-blue-500/80' : 'bg-rose-500/80'
      )}
    />
    <span className="text-[11px] font-extrabold tracking-wide text-foreground/90">
      {PHASE_SHORT_NAMES[phase]}
    </span>
    <div className="h-px flex-1 bg-border/70" />
    <span className="text-[9px] font-mono font-semibold text-muted-foreground/70">{phase}</span>
  </div>
)
