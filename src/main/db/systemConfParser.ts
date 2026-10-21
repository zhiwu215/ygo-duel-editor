import { existsSync, readFileSync } from 'fs'
import path from 'path'

export function readSystemConf(searchDirs: string[]): Record<string, string> {
  for (const dir of searchDirs) {
    const file = path.join(dir, 'system.conf')
    if (!existsSync(file)) continue
    const values: Record<string, string> = {}
    try {
      for (const raw of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#') || line.startsWith('!')) continue
        const separator = line.indexOf('=')
        if (separator === -1) continue
        values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
      }
      return values
    } catch (err) {
      console.error(`[CdbService] Failed to parse ${file}:`, err)
    }
  }
  return {}
}
