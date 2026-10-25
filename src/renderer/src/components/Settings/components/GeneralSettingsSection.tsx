import { type JSX } from 'react'
import {
  CARD_NAME_WRAPPERS,
  FONT_SIZE_SPECS,
  FontSizeRole,
  normalizeCardNameWrapper,
  normalizeFontSizes
} from '@shared/index'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
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
    description: '影响文本库正文、剧本台词与卡片笔记的字号'
  },
  {
    role: 'code',
    title: '代码字号',
    description: '影响脚本、代码块与等宽文本的字号'
  }
]

export function GeneralSettingsSection(): JSX.Element {
  const { config, setTheme, setFontSize, setCardNameWrapper } = useConfigStore()
  const fontSizes = normalizeFontSizes(config.fontSizes)
  const cardNameWrapper = normalizeCardNameWrapper(config.cardNameWrapper)
  const wrapperOpen = cardNameWrapper.slice(0, 1)
  const wrapperClose = cardNameWrapper.slice(1)

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
        <h2 className="text-sm text-foreground">台本</h2>
        <div className="mt-1">
          <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-b-0">
            <div className="min-w-0 pr-8">
              <div className="text-sm text-foreground">卡名包裹符号</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                默认台本文本中用哪种符号包裹卡名（示例：
                <span className="font-mono text-foreground/80">
                  {wrapperOpen}青眼白龙{wrapperClose}
                </span>
                ）
              </div>
            </div>
            <Select
              value={cardNameWrapper}
              onValueChange={(value) => {
                if (value) void setCardNameWrapper(value)
              }}
            >
              <SelectTrigger size="sm" className="w-24 shrink-0 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_NAME_WRAPPERS.map((wrapper) => (
                  <SelectItem key={wrapper} value={wrapper}>
                    <span className="inline-flex w-12 justify-center font-mono text-xs">
                      {wrapper}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
