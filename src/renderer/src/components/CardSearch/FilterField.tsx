import React from 'react'
import { cn } from '../../lib/utils'

interface FilterFieldProps {
  label: string
  tooltip?: string
  disabled?: boolean
  labelClassName?: string
  className?: string
  children: React.ReactNode
}

export const FilterField: React.FC<FilterFieldProps> = ({
  label,
  tooltip,
  disabled,
  labelClassName,
  className,
  children
}) => {
  const labelNode = (
    <span
      className={cn(
        'w-9 shrink-0 whitespace-nowrap text-[11px] leading-none text-muted-foreground/90',
        disabled && 'opacity-50',
        labelClassName
      )}
    >
      {label}
    </span>
  )
  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      {tooltip ? labelNode : labelNode}
      {children}
    </div>
  )
}
