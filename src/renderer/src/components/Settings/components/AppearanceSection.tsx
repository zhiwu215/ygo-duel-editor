import { type JSX } from 'react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SettingsRow } from './SettingsRow'

const THEME_LABELS: Record<string, string> = {
  light: '浅色模式',
  dark: '深色模式'
}

export function AppearanceSection(): JSX.Element {
  const { config, setTheme } = useConfigStore()
  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow title="主题" description="切换应用的浅色 / 深色外观">
        <Select
          value={config.theme || 'light'}
          onValueChange={(val) => {
            if (val === 'light' || val === 'dark') void setTheme(val)
          }}
        >
          <SelectTrigger
            size="xs"
            className="w-28 border-border bg-background dark:bg-background dark:hover:bg-background"
          >
            <SelectValue>{(value) => THEME_LABELS[value as string] ?? '浅色模式'}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-auto min-w-28 p-1">
            <SelectItem value="light" className="text-xs py-1.5 pr-7 pl-2">
              浅色模式
            </SelectItem>
            <SelectItem value="dark" className="text-xs py-1.5 pr-7 pl-2">
              深色模式
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </section>
  )
}
