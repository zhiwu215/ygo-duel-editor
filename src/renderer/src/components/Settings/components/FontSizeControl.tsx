import { type JSX } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface FontSizeControlProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function FontSizeControl({ value, min, max, onChange }: FontSizeControlProps): JSX.Element {
  return (
    <div className="inline-flex items-center gap-2">
      <div
        role="group"
        aria-label="字号步进"
        className="group relative inline-flex h-9 min-w-[72px] items-center justify-center rounded-md bg-muted"
      >
        <span className="text-sm tabular-nums text-foreground">{value}</span>
        <div className="absolute right-2 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            aria-label="增大字号"
            disabled={value >= max}
            onClick={() => onChange(value + 1)}
            className="inline-flex h-3 w-[17px] items-center justify-center rounded-xs bg-background/75 text-foreground hover:bg-background disabled:cursor-default disabled:text-muted-foreground/60"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            aria-label="减小字号"
            disabled={value <= min}
            onClick={() => onChange(value - 1)}
            className="inline-flex h-3 w-[17px] items-center justify-center rounded-xs bg-background/75 text-foreground hover:bg-background disabled:cursor-default disabled:text-muted-foreground/60"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">px</span>
    </div>
  )
}
