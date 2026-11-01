import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { enabledExtraCdbPaths } from './gameContent'
import { buildZipScriptIndex, readZipScriptEntry, type ZipScriptEntry } from './scriptArchiveZip'

const SCRIPT_ROOT_DEPTH = 4

export interface ExtraScriptSources {
  key: string
  scriptDirs: string[]
  scriptZips: string[]
}

interface ZipScriptArchive {
  key: string
  buffer: Buffer
  entries: Map<number, ZipScriptEntry>
}

const zipCache = new Map<string, ZipScriptArchive>()
let cachedSources: ExtraScriptSources | null = null

function listDirectories(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name))
  } catch {
    return []
  }
}

function listZipFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'))
      .map((entry) => join(dir, entry.name))
  } catch {
    return []
  }
}

function scriptRootFor(cdbPath: string): string | null {
  let dir = dirname(cdbPath)
  for (let depth = 0; depth < SCRIPT_ROOT_DEPTH; depth++) {
    if (existsSync(join(dir, 'script')) || existsSync(join(dir, 'expansions'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function collectScriptSources(extraPaths: string[]): ExtraScriptSources {
  const scriptDirs: string[] = []
  const scriptZips: string[] = []
  const addDir = (dir: string): void => {
    if (dir && existsSync(dir) && !scriptDirs.includes(dir)) scriptDirs.push(dir)
  }
  const addZip = (file: string): void => {
    if (existsSync(file) && !scriptZips.includes(file)) scriptZips.push(file)
  }

  for (const cdbPath of extraPaths) {
    const dir = dirname(cdbPath)
    addDir(dir)
    addDir(join(dir, 'script'))
    for (const file of listZipFiles(dir)) addZip(file)

    const root = scriptRootFor(cdbPath)
    if (!root) continue
    const scriptRoot = join(root, 'script')
    addDir(scriptRoot)
    for (const sub of listDirectories(scriptRoot)) addDir(sub)
    addDir(join(root, 'expansions', 'script'))
    for (const file of listZipFiles(root)) addZip(file)
    for (const file of listZipFiles(join(root, 'expansions'))) addZip(file)
    for (const file of listZipFiles(join(root, 'repositories'))) addZip(file)
    for (const repo of listDirectories(join(root, 'repositories'))) addDir(join(repo, 'script'))
  }

  return { key: extraPaths.join('|'), scriptDirs, scriptZips }
}

export function extraScriptSources(): ExtraScriptSources {
  const extraPaths = enabledExtraCdbPaths()
  const key = extraPaths.join('|')
  if (cachedSources && cachedSources.key === key) return cachedSources
  cachedSources = collectScriptSources(extraPaths)
  return cachedSources
}

function loadZipScripts(zipPath: string): ZipScriptArchive | null {
  let key: string
  try {
    const stat = statSync(zipPath)
    key = `${stat.size}:${stat.mtimeMs}`
  } catch {
    return null
  }
  const cached = zipCache.get(zipPath)
  if (cached && cached.key === key) return cached
  try {
    const buffer = readFileSync(zipPath)
    const entries = buildZipScriptIndex(buffer)
    if (!entries) return null
    const archive = { key, buffer, entries }
    zipCache.set(zipPath, archive)
    return archive
  } catch {
    return null
  }
}

export function findExtraCardScript(id: number): { fileName: string; content: Buffer } | null {
  const fileName = `c${id}.lua`
  const sources = extraScriptSources()
  for (const dir of sources.scriptDirs) {
    const file = join(dir, fileName)
    if (!existsSync(file)) continue
    try {
      return { fileName, content: readFileSync(file) }
    } catch {
      continue
    }
  }
  for (const zipPath of sources.scriptZips) {
    const archive = loadZipScripts(zipPath)
    if (!archive) continue
    const entry = archive.entries.get(id)
    if (!entry) continue
    const text = readZipScriptEntry(archive.buffer, entry)
    if (text !== null) return { fileName, content: Buffer.from(text, 'utf8') }
  }
  return null
}

export function readExtraCardScript(scriptPath: string): Uint8Array | null {
  const match = /(?:^|[\\/])c(\d+)\.lua$/i.exec(scriptPath)
  if (!match) return null
  const code = Number(match[1])
  if (!Number.isSafeInteger(code) || code <= 0) return null
  const found = findExtraCardScript(code)
  return found ? new Uint8Array(found.content) : null
}
