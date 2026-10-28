import { join, resolve, sep } from 'path'
import type { AppConfig } from '@shared/index'

export function resetWorkspaceSettings(): Partial<AppConfig> {
  return {
    gameDirectory: undefined,
    gameType: undefined,
    gameLanguage: undefined,
    cdbPath: undefined,
    banlistName: undefined,
    cardImageDirectory: undefined,
    extraCdbPaths: undefined,
    disabledCdbPaths: undefined,
    recentProjectPaths: undefined
  }
}

function relativeToDataDir(target: string, from: string): string | null {
  const source = resolve(from)
  const resolved = resolve(target)
  const prefix = source.endsWith(sep) ? source : `${source}${sep}`
  if (resolved.toLowerCase() === source.toLowerCase()) return ''
  if (!resolved.toLowerCase().startsWith(prefix.toLowerCase())) return null
  return resolved.slice(prefix.length)
}

function remapPathList(list: string[] | undefined, from: string, to: string): string[] | undefined {
  return list?.map((target) => {
    const relativePath = relativeToDataDir(target, from)
    return relativePath === null ? target : join(to, relativePath)
  })
}

export function remapWorkspaceSettings(
  config: AppConfig,
  from: string,
  to: string
): Partial<AppConfig> {
  return {
    extraCdbPaths: remapPathList(config.extraCdbPaths, from, to),
    disabledCdbPaths: remapPathList(config.disabledCdbPaths, from, to),
    recentProjectPaths: remapPathList(config.recentProjectPaths, from, to)
  }
}
