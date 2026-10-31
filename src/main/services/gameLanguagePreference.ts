import { AppConfig } from '@shared/index'
import { configService } from './configService'
import { currentLanguagePack, listMdpro3Locales } from './gameContent'

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

export function seedCurrentGameLanguage(): void {
  const cfg = configService.get()
  if (!cfg.gameDirectory) return
  const language = effectiveGameLanguage(cfg)
  if (language) rememberGameLanguage(cfg.gameDirectory, language)
}

function effectiveGameLanguage(cfg: AppConfig): string | undefined {
  if (cfg.gameType !== 'mdpro3') return currentLanguagePack()?.id
  if (!cfg.gameDirectory || !cfg.cdbPath) return undefined
  const cdbPath = cfg.cdbPath.toLowerCase()
  return listMdpro3Locales(cfg.gameDirectory).find(
    (option) => option.detail?.toLowerCase() === cdbPath
  )?.id
}
