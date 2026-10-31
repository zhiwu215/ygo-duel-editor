import React from 'react'
import { DuelPhase } from '@shared/index'
import { phaseLabel } from './stepLogFormat'

interface StepPhaseHeaderProps {
  phase: DuelPhase
}

export const StepPhaseHeader: React.FC<StepPhaseHeaderProps> = ({ phase }) => (
  <div className="flex select-none items-center border-b border-border/60 bg-muted/20 px-2 py-1">
    <span className="text-[11px] font-bold tracking-wide text-foreground/90">
      {phaseLabel(phase)}
    </span>
  </div>
)
