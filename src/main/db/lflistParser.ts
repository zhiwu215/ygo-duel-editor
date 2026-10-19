import { readFileSync } from 'fs'
import * as fs from 'fs'
import path from 'path'

export function loadLflists(searchDirs: string[]): Map<number, 1 | 2 | 3> {
  const limitMap = new Map<number, 1 | 2 | 3>()
  const candidates: string[] = []
  for (const dir of searchDirs) {
    if (!dir) continue
    candidates.push(path.join(dir, 'lflist.conf'))
    candidates.push(path.join(dir, 'lflists'))
  }

  const sectionLevels: Array<{ pattern: RegExp; level: 1 | 2 | 3 }> = [
    { pattern: /^#forbidden/i, level: 1 },
    { pattern: /^#limited/i, level: 2 },
    { pattern: /^#semi-?limited/i, level: 3 }
  ]

  let current: 1 | 2 | 3 | null = null
  let loaded = 0

  for (const candidate of candidates) {
    let stat: fs.Stats
    try {
      stat = fs.statSync(candidate)
    } catch {
      continue
    }

    const files = stat.isDirectory()
      ? fs
          .readdirSync(candidate)
          .filter(
            (f) => f.toLocaleLowerCase().endsWith('.conf') || f.toLocaleLowerCase().endsWith('.txt')
          )
          .map((f) => path.join(candidate, f))
      : [candidate]

    for (const file of files) {
      current = null
      try {
        const content = readFileSync(file, 'utf-8')
        for (const line of content.split(/\r?\n/)) {
          if (!line || line[0] === '!' || line[0] === '#') {
            const section = sectionLevels.find((s) => s.pattern.test(line))
            if (section) current = section.level
            continue
          }
          const parts = line.trim().split(/\s+/)
          if (parts.length < 2) continue
          const code = Number.parseInt(parts[0], 10)
          if (!Number.isFinite(code) || code <= 0) continue
          const flag = Number.parseInt(parts[1], 10)
          const level: 1 | 2 | 3 | null = flag === 0 ? 1 : flag === 1 ? 2 : flag === 2 ? 3 : current
          if (!level) continue
          if (!limitMap.has(code)) limitMap.set(code, level)
        }
        loaded++
      } catch (err) {
        console.error(`[CdbService] Failed to parse lflist ${file}:`, err)
      }
    }
  }

  if (loaded > 0) {
    console.log(`[CdbService] Loaded ${limitMap.size} limit entries from ${loaded} file(s)`)
  }

  return limitMap
}
