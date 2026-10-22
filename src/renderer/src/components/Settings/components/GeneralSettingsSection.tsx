import { type JSX } from 'react'
import { FONT_SIZE_SPECS, FontSizeRole, normalizeFontSizes } from '@shared/index'
import { useConfigStore } from '../../../stores/useConfigStore'
import { FontSizeControl } from './FontSizeControl'
import { ThemePreferenceCards } from './ThemePreferenceCards'

const FONT_SIZE_ROWS: { role: FontSizeRole; title: string; description: string }[] = [
  {
    role: 'chat',
    title: '对话字号',
    description: '影响背后灵消息与回复正文的字号'
  },
  {
    role: 'content',
    title: '文本字号',
    description: '影响素材库正文、剧本台词与卡片笔记的字号'
  },
  {
    role: 'code',
    title: '代码字号',
    description: '影响脚本、代码块与等宽文本的字号'
  }
]

export function GeneralSettingsSection(): JSX.Element {
  const { config, setTheme, setFontSize } = useConfigStore()
  const fontSizes = normalizeFontSizes(config.fontSizes)

  return (
    <div className="text-sm">
      <section>
        <h2 className="text-sm text-foreground">主题</h2>
        <div className="mt-2">
          <ThemePreferenceCards
            value={config.theme || 'system'}
            onChange={(theme) => void setTheme(theme)}
          />
        </div>
      </section>

      <section className="mt-5 border-t border-border/60 pt-4">
        <h2 className="text-sm text-foreground">字号大小</h2>
        <div className="mt-1">
          {FONT_SIZE_ROWS.map(({ role, title, description }) => {
            const spec = FONT_SIZE_SPECS[role]
            return (
              <div
                key={role}
                className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-b-0"
              >
                <div className="min-w-0 pr-8">
                  <div className="text-sm text-foreground">{title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </div>
                </div>
                <FontSizeControl
                  value={fontSizes[role]}
                  min={spec.min}
                  max={spec.max}
                  onChange={(value) => void setFontSize(role, value)}
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
