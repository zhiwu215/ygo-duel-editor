import type { AppConfig, FontSizes } from '@shared/index'

const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function resolveTheme(theme: AppConfig['theme']): 'dark' | 'light' {
  return theme === 'system' ? (systemDarkQuery.matches ? 'dark' : 'light') : theme
}

export function applyTheme(theme: AppConfig['theme']): void {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
  systemDarkQuery.onchange = theme === 'system' ? () => applyTheme('system') : null
}

export function applyFontSizes(sizes: FontSizes): void {
  const style = document.documentElement.style
  style.setProperty('--chat-font-size', `${sizes.chat}px`)
  style.setProperty('--content-font-size', `${sizes.content}px`)
  style.setProperty('--code-font-size', `${sizes.code}px`)
}
