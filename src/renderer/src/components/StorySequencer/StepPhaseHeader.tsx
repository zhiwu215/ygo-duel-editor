import React from 'react'
import { DuelPhase, PHASE_SHORT_NAMES } from '@shared/index'

interface StepPhaseHeaderProps {
  phase: DuelPhase
  turnPlayer: 0 | 1
}

export const StepPhaseHeader: React.FC<StepPhaseHeaderProps> = ({ phase }) => (
  <div className="flex select-none items-center gap-2 px-2 pb-1 pt-2.5">
    <span className="text-[15px] font-bold tracking-wide text-foreground/90">
      {PHASE_SHORT_NAMES[phase]}
    </span>
    <span className="h-px flex-1 bg-border/70" />
  </div>
)
