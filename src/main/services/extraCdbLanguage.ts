import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { ExtraCdbLanguageInfo, GameLanguageOption } from '@shared/index'
import { configService } from './configService'
import {
  currentLanguagePack,
  discoverGameLanguagePacks,
  enabledExtraCdbPaths,
  type GameLanguagePack
} from './gameContent'
import {
  gameDirectoryKey,
  rememberGameLanguage,
  rememberedGameLanguage
} from './gameLanguagePreference'

const LANGUAGE_ROOT_DEPTH = 4

export function externalLanguageRoot(cdbPath: string): string | null {
  let dir = dirname(resolve(cdbPath))
  for (let depth = 0; depth < LANGUAGE_ROOT_DEPTH; depth++) {
    if (existsSync(join(dir, 'config', 'languages'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function packsForRoot(root: string): GameLanguagePack[] {
  return discoverGameLanguagePacks(root).filter((pack) => pack.cdbPaths.length > 0)
}

export function resolvedExtraLanguage(root: string): string | null {
  const packs = packsForRoot(root)
  if (packs.length === 0) return null
  const preferred = rememberedGameLanguage(root) ?? configService.get().preferredLanguage
  const matched = preferred ? packs.find((pack) => pack.id === preferred) : undefined
  if (matched) return matched.id
  return packs.length === 1 ? packs[0].id : null
}

export function extraLanguageOptions(root: string): GameLanguageOption[] {
  return packsForRoot(root).map((pack) => ({ id: pack.id }))
}

export function extraLanguageFor(cdbPath: string): ExtraCdbLanguageInfo | null {
  const root = externalLanguageRoot(cdbPath)
  if (!root) return null
  const options = extraLanguageOptions(root)
  if (options.length === 0) return null
  return { root, language: resolvedExtraLanguage(root), options }
}

export function extraLanguagePacks(): GameLanguagePack[] {
  const packs: GameLanguagePack[] = []
  const seen = new Set<string>()
  for (const cdbPath of enabledExtraCdbPaths()) {
    const root = externalLanguageRoot(cdbPath)
    if (!root) continue
    const key = gameDirectoryKey(root)
    if (seen.has(key)) continue
    seen.add(key)
    const language = resolvedExtraLanguage(root)
    const pack = language ? packsForRoot(root).find((item) => item.id === language) : undefined
    if (pack) packs.push(pack)
  }
  return packs
}

export function currentLanguagePacks(): GameLanguagePack[] {
  const main = currentLanguagePack()
  return main ? [main, ...extraLanguagePacks()] : extraLanguagePacks()
}

export function rememberExtraLanguage(root: string, languageId: string): boolean {
  if (!packsForRoot(root).some((item) => item.id === languageId)) return false
  rememberGameLanguage(root, languageId)
  return true
}
