import React from 'react'
import { Button } from '../../ui/button'

interface AnnounceMaskPickerProps {
  options: Array<{ value: number; label: string }>
  requiredCount: number
  selectedMask: number
  onToggle: (value: number) => void
  loading: boolean
}

export const AnnounceMaskPicker: React.FC<AnnounceMaskPickerProps> = ({
  options,
  requiredCount,
  selectedMask,
  onToggle,
  loading
}) => {
  const selectedCount = options.filter((entry) => (selectedMask & entry.value) !== 0).length
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">
        已选 {selectedCount} / {requiredCount} 种
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {options.map((entry) => {
          const selected = (selectedMask & entry.value) !== 0
          return (
            <Button
              key={entry.value}
              variant={selected ? 'default' : 'outline'}
              disabled={loading}
              className="h-9 text-xs"
              onClick={() => onToggle(entry.value)}
            >
              {entry.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
