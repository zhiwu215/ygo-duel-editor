import { type JSX } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppConfig } from '@shared/index'
import { cn } from '../../../lib/utils'

type ThemePreference = AppConfig['theme']

interface ThemeOption {
  value: ThemePreference
  label: string
  icon: LucideIcon
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
]

interface ThemePreferenceCardsProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

export function ThemePreferenceCards({ value, onChange }: ThemePreferenceCardsProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {THEME_OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              'flex min-h-[82px] flex-1 basis-[180px] flex-col items-center justify-center gap-1 rounded-xl border px-6 py-5 text-sm transition-colors',
              selected
                ? 'border-foreground/25 bg-muted/70 text-foreground'
                : 'border-border bg-transparent text-foreground hover:bg-muted/40'
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
