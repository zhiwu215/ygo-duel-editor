import React from 'react'
import type { StepProvenance } from '@shared/index'
import { cn } from '../../lib/utils'

function badgeLabel(provenance: StepProvenance): string | null {
  if (provenance.stepCount === 0) return null
  return provenance.manualStepCount === 0 ? '引擎' : '手动'
}

export const StepProvenanceBadge: React.FC<{ provenance: StepProvenance; className?: string }> = ({
  provenance,
  className
}) => {
  const label = badgeLabel(provenance)
  if (!label) return null
  const engineOnly = provenance.manualStepCount === 0
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1 text-[9px] leading-4',
        engineOnly
          ? 'border-emerald-500/30 text-emerald-500'
          : 'border-amber-500/30 text-amber-500',
        className
      )}
    >
      {label}
    </span>
  )
}
