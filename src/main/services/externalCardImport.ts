import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { CardType, CustomCard, unpackCardLevel } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { enabledExtraCdbPaths } from './gameContent'
import { imageService } from './imageService'
import { buildZipScriptIndex, readZipScriptEntry, type ZipScriptEntry } from './scriptArchiveZip'

const SCRIPT_ROOT_DEPTH = 4
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']

interface ZipScriptArchive {
  key: string
  buffer: Buffer
  entries: Map<number, ZipScriptEntry>
}

interface ExternalSources {
  key: string
  scriptDirs: string[]
  scriptZips: string[]
  imageDirs: string[]
}

const zipCache = new Map<string, ZipScriptArchive>()
let cachedSources: ExternalSources | null = null

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

function collectExternalSources(extraPaths: string[]): ExternalSources {
  const scriptDirs: string[] = []
  const scriptZips: string[] = []
  const imageDirs: string[] = []
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
    for (const imageDir of imageService.detectPicsDirsFromCdb(cdbPath)) {
      if (!imageDirs.includes(imageDir)) imageDirs.push(imageDir)
    }

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

  return {
    key: extraPaths.join('|'),
    scriptDirs,
    scriptZips,
    imageDirs
  }
}

function externalSources(): ExternalSources {
  const extraPaths = enabledExtraCdbPaths()
  if (cachedSources && cachedSources.key === extraPaths.join('|')) return cachedSources
  cachedSources = collectExternalSources(extraPaths)
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

function setcodeSlots(value: bigint | number): number[] {
  const raw = BigInt.asUintN(64, typeof value === 'bigint' ? value : BigInt(Math.trunc(value)))
  return Array.from({ length: 4 }, (_, index) => Number((raw >> BigInt(index * 16)) & 0xffffn))
}

export function importableCard(id: number): CustomCard | null {
  const card = cdbService.getCardById(id)
  if (!card) return null
  const { level, lscale, rscale } = unpackCardLevel(card.level)
  const isLink = (card.type & CardType.LINK) !== 0
  return {
    schemaVersion: 2,
    id: card.id,
    alias: card.alias,
    ot: card.ot,
    setcode: setcodeSlots(card.setcode),
    type: card.type,
    attribute: card.attribute,
    race: card.race,
    level,
    lscale,
    rscale,
    atk: card.atk,
    def: isLink ? 0 : card.def,
    linkMarkers: isLink ? card.def : 0,
    category: Number(card.category),
    name: card.name,
    desc: card.desc,
    strings: [],
    createdAt: 0,
    updatedAt: 0
  }
}

export function findExternalCardScript(id: number): { fileName: string; content: Buffer } | null {
  const fileName = `c${id}.lua`
  const sources = externalSources()
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

export function findExternalCardImage(id: number): string | null {
  for (const dir of externalSources().imageDirs) {
    for (const ext of IMAGE_EXTENSIONS) {
      const file = join(dir, `${id}${ext}`)
      if (existsSync(file)) return file
    }
  }
  return null
}
