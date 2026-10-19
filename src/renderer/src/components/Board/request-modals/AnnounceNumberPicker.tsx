import React from 'react'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { Button } from '../../ui/button'

interface AnnounceNumberPickerProps {
  numbers: number[]
  value: number | null
  onSelect: (value: number) => void
}

export const AnnounceNumberPicker: React.FC<AnnounceNumberPickerProps> = ({
  numbers,
  value,
  onSelect
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {numbers.map((n) => (
        <Button
          key={n}
          variant={value === n ? 'default' : 'outline'}
          disabled={loading}
          className="h-9 text-xs font-mono"
          onClick={() => onSelect(n)}
        >
          {n}
        </Button>
      ))}
      {numbers.length === 0 && (
        <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
          引擎没有提供候选数字
        </p>
      )}
    </div>
  )
}
