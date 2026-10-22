import React from 'react'
import { cn } from '../../lib/utils'

interface EffectCategoryGridProps {
  categories: Array<{ mask: number; label: string }>
  value: number
  onToggle: (mask: number) => void
  columns?: number
}

export const EffectCategoryGrid: React.FC<EffectCategoryGridProps> = ({
  categories,
  value,
  onToggle,
  columns = 3
}) => {
  return (
    <div
      className="grid gap-x-3 gap-y-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {categories.map((category) => {
        const checked = (value & category.mask) !== 0
        return (
          <button
            key={category.mask}
            type="button"
            role="checkbox"
            aria-checked={checked}
            title={category.label}
            onClick={() => onToggle(category.mask)}
            className="flex items-start gap-1.5 rounded px-1 py-1 text-left text-[11px] text-foreground/85 outline-none transition-colors hover:bg-neutral-500/15 focus-visible:bg-neutral-500/20"
          >
            <span
              className={cn(
                'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
                checked ? 'border-primary bg-primary' : 'border-border bg-background'
              )}
            >
              {checked && (
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-primary-foreground">
                  <path
                    d="M1.5 5.2 L4 7.6 L8.5 2.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="min-w-0 whitespace-normal break-words leading-snug">
              {category.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
