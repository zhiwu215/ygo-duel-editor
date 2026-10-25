import { existsSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { configService } from './configService'
import { buildZipScriptIndex, readZipScriptEntry, type ZipScriptEntry } from './scriptArchiveZip'

interface ScriptArchive {
  key: string
  buffer: Buffer
  entries: Map<number, ZipScriptEntry>
}

let cachedArchive: ScriptArchive | null = null

function archiveCandidates(): string[] {
  const cfg = configService.get()
  const paths: string[] = []
  if (cfg.gameDirectory) {
    paths.push(path.join(cfg.gameDirectory, 'Data', 'script.zip'))
    paths.push(path.join(cfg.gameDirectory, 'script.zip'))
  }
  for (const cdbPath of cfg.extraCdbPaths ?? []) {
    const dir = path.dirname(cdbPath)
    paths.push(path.join(dir, 'script.zip'))
  }
  return [...new Set(paths)]
}

function loadArchive(): ScriptArchive | null {
  for (const file of archiveCandidates()) {
    if (!existsSync(file)) continue
    try {
      const stat = statSync(file)
      const key = `${file}:${stat.size}:${stat.mtimeMs}`
      if (cachedArchive && cachedArchive.key === key) return cachedArchive
      const buffer = readFileSync(file)
      const entries = buildZipScriptIndex(buffer)
      if (!entries) continue
      cachedArchive = { key, buffer, entries }
      return cachedArchive
    } catch {
      continue
    }
  }
  return null
}

export function readArchivedCardScript(code: number): string | null {
  const archive = loadArchive()
  if (!archive) return null
  const entry = archive.entries.get(code)
  if (!entry) return null
  return readZipScriptEntry(archive.buffer, entry)
}
