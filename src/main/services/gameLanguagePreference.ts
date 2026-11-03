import { configService } from './configService'

export const FOLLOW_GAME_LANGUAGE = 'auto'

export function gameDirectoryKey(dir: string): string {
  return dir.replace(/[\\/]+$/, '').toLowerCase()
}

export function rememberedGameLanguage(dir: string): string | undefined {
  return configService.get().gameLanguageByDirectory?.[gameDirectoryKey(dir)]
}

export function rememberGameLanguage(dir: string, language: string): void {
  const cfg = configService.get()
  const key = gameDirectoryKey(dir)
  if (cfg.gameLanguageByDirectory?.[key] === language) return
  configService.save({
    gameLanguageByDirectory: { ...cfg.gameLanguageByDirectory, [key]: language }
  })
}

export function forgetGameLanguage(dir: string): void {
  const cfg = configService.get()
  const key = gameDirectoryKey(dir)
  if (!cfg.gameLanguageByDirectory?.[key]) return
  const next = { ...cfg.gameLanguageByDirectory }
  delete next[key]
  configService.save({ gameLanguageByDirectory: next })
}
