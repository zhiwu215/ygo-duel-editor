const LANGUAGE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文 (官方译名)',
  'zh-SC': '简体中文 (民间译名)',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'en-US_mdpro3': 'English (MDPro3)',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  'ko-KRIDS': '한국어 (IDS)',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'it-IT': 'Italiano',
  'pt-PT': 'Português',
  en: 'English (内置)',
  Chs: '简体中文',
  Cht: '繁體中文',
  English: 'English (语言包)'
}

export function languageLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id
}

export function mdpro3LocaleIdFromCdbPath(cdbPath: string | undefined): string | null {
  if (!cdbPath) return null
  const segments = cdbPath.split(/[\\/]/)
  const fileName = segments[segments.length - 1] ?? ''
  const localeDir = segments[segments.length - 2] ?? ''
  if (!/^cards\.cdb$/i.test(fileName) || !localeDir) return null
  return localeDir
}
