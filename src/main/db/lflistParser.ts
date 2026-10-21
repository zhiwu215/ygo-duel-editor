import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'

export interface LfList {
  name: string
  hash: number
  content: Map<number, 1 | 2 | 3>
}

const LF_LIST_HASH_SEED = 0x7dfcee6a
const LFLIST_FILE_PATTERN = /\.(conf|txt)$/i

function appendEntryHash(hash: number, code: number, count: number): number {
  const high = (code << 18) | (code >>> 14)
  const low = (code << (27 + count)) | (code >>> (5 - count))
  return (hash ^ high ^ low) >>> 0
}

function parseLfFile(file: string, lists: LfList[]): boolean {
  if (!existsSync(file)) return false
  let content: string
  try {
    content = readFileSync(file, 'utf-8')
  } catch (err) {
    console.error(`[CdbService] Failed to read lflist ${file}:`, err)
    return false
  }

  let pending: LfList | null = null
  const flush = (): void => {
    if (!pending) return
    lists.push(pending)
    pending = null
  }

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('$')) continue
    if (line.startsWith('!')) {
      flush()
      pending = { name: line.slice(1).trim(), hash: LF_LIST_HASH_SEED, content: new Map() }
      continue
    }
    if (!pending) continue
    const matched = /^(\d+)\s+(\d+)/.exec(line)
    if (!matched) continue
    const code = Number(matched[1])
    const count = Number(matched[2])
    if (!Number.isSafeInteger(code) || code <= 0 || count < 0 || count > 2) continue
    pending.content.set(code, (count + 1) as 1 | 2 | 3)
    pending.hash = appendEntryHash(pending.hash, code, count)
  }

  flush()
  return true
}

export function loadLfLists(searchDirs: string[]): LfList[] {
  const lists: LfList[] = []
  const loaded = new Set<string>()

  const loadFile = (file: string): void => {
    if (loaded.has(file)) return
    loaded.add(file)
    parseLfFile(file, lists)
  }

  for (const dir of searchDirs) {
    if (!dir) continue
    loadFile(path.join(dir, 'expansions', 'lflist.conf'))
    loadFile(path.join(dir, 'lflist.conf'))
    const folder = path.join(dir, 'lflists')
    let entries: string[] = []
    try {
      entries = readdirSync(folder)
        .filter((entry) => LFLIST_FILE_PATTERN.test(entry))
        .sort()
    } catch {}
    for (const entry of entries) loadFile(path.join(folder, entry))
  }

  lists.push({ name: 'N/A', hash: 0, content: new Map() })
  return lists
}

export function selectActiveLimitList(
  lists: LfList[],
  config: Record<string, string>
): LfList | null {
  if (lists.length === 0) return null

  if (config.use_lflist !== undefined && Number(config.use_lflist) === 0) {
    return lists[lists.length - 1]
  }

  const lastHash = Number(config.lastlflist)
  if (config.lastlflist !== undefined && Number.isFinite(lastHash)) {
    const matched = lists.find((list) => list.hash === lastHash)
    if (matched) return matched
  }

  const defaultIndex = Number(config.default_lflist)
  const index = Number.isFinite(defaultIndex) && defaultIndex >= 0 ? defaultIndex : 0
  return lists[index] ?? lists[0]
}
