import React from 'react'
import { NumericCompareOp } from '@shared/index'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import { filterText, parseFilterText } from '../../utils/numericFilterText'
import { FilterField } from './FilterField'

interface NumericRowProps {
  label: string
  op: NumericCompareOp
  value: number | undefined
  allowUnknown?: boolean
  disabled?: boolean
  className?: string
  inputClassName?: string
  onChange: (value: number | undefined, op: NumericCompareOp) => void
}

export const NumericRow: React.FC<NumericRowProps> = ({
  label,
  op,
  value,
  allowUnknown = false,
  disabled = false,
  className,
  inputClassName = 'h-7',
  onChange
}) => {
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <FilterField label={label} disabled={disabled} className={className}>
      <Input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={draft ?? filterText(value, op)}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const parsed = parseFilterText(next, allowUnknown)
          onChange(parsed.value, parsed.op)
        }}
        onBlur={() => setDraft(null)}
        className={cn(inputClassName, 'min-w-0 flex-1 px-1.5 text-xs')}
      />
    </FilterField>
  )
}
