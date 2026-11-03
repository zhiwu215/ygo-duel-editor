import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface CardLocationLabelProps {
  label: string
  selected?: boolean
  interactive?: boolean
}

export const CardLocationLabel: React.FC<CardLocationLabelProps> = ({
  label,
  selected = false,
  interactive = false
}) => (
  <span
    className={cn(
      'mb-1 flex h-5 w-full items-center justify-center overflow-hidden rounded-[3px] px-1 text-[11px] font-semibold tabular-nums',
      selected
        ? 'bg-amber-300 text-amber-950'
        : interactive
          ? 'bg-muted text-foreground/70 group-hover:bg-foreground/10 group-hover:text-foreground'
          : 'bg-muted text-foreground/70'
    )}
  >
    {selected && <Check className="mr-0.5 h-3 w-3 shrink-0" strokeWidth={3} />}
    {label}
  </span>
)
