import { existsSync, readFileSync } from 'fs'
import path from 'path'

export function collectConfigDirs(
  cdbPaths: string[],
  languageDirs: string[] = [],
  gameDirectory: string | undefined
): string[] {
  const dirs: string[] = []
  for (const cdbPath of cdbPaths) {
    const dir = path.dirname(cdbPath)
    dirs.push(dir, path.dirname(dir))
  }
  if (gameDirectory) {
    dirs.push(gameDirectory, path.join(gameDirectory, 'config'))
  }
  dirs.push(...languageDirs)
  return [...new Set(dirs.filter((d) => d && d.length > 0))]
}

export interface CdbStringsConf {
  setnameMap: Map<number, string>
  systemStringMap: Map<number, string>
}

export function loadCdbStringsConf(searchDirs: string[]): CdbStringsConf {
  const setnameMap = new Map<number, string>()
  const systemStringMap = new Map<number, string>()
  const candidatePaths = [
    ...new Set(
      searchDirs.flatMap((searchDir) => [
        path.join(searchDir, 'strings.conf'),
        path.join(searchDir, 'expansions', 'strings.conf')
      ])
    )
  ]

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        const lines = content.split(/\r?\n/)
        for (const line of lines) {
          const setnameMatch = line.match(/^!setname\s+(0x[0-9a-fA-F]+|\d+)\s+([^\t\r\n]+)/)
          if (setnameMatch) {
            const code = parseInt(setnameMatch[1].replace(/^0x/i, ''), 16)
            const name = setnameMatch[2].trim()
            if (!isNaN(code) && name) setnameMap.set(code, name)
          }

          const systemMatch = line.match(/^!system\s+(\d+)\s+([^\t\r\n]+)/)
          if (systemMatch) {
            const id = Number(systemMatch[1])
            const label = systemMatch[2].trim()
            if (!isNaN(id) && label) systemStringMap.set(id, label)
          }
        }
        console.log(
          `[CdbService] Loaded ${setnameMap.size} setnames and ${systemStringMap.size} system strings from ${p}`
        )
      } catch (err) {
        console.error(`[CdbService] Failed to parse ${p}:`, err)
      }
    }
  }

  return { setnameMap, systemStringMap }
}

export interface StringsConfRecord {
  section: '!effect' | '!system' | string
  id: number
  text: string
}

export function parseEffectSystemLine(line: string): StringsConfRecord | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('!')) return null
  const section = trimmed.split(/\s+/)[0]
  const rest = trimmed.slice(section.length).trim()
  const spaceIdx = rest.indexOf(' ')
  if (spaceIdx === -1) return null
  const id = Number(rest.slice(0, spaceIdx))
  if (!Number.isFinite(id)) return null
  const text = rest.slice(spaceIdx + 1).trim()
  return { section, id, text }
}
