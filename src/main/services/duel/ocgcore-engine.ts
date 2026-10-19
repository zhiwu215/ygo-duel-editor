import fs from 'fs'
import path from 'path'
import {
  createOcgcoreWrapper,
  ZipScriptReader,
  DirScriptReader,
  OcgcoreWrapper,
  ScriptReader
} from 'koishipro-core.js'
import { configService } from '../configService'
import { readEngineCardData } from './card-reader'
import { readCustomScript } from '../customCardLibrary'

let ocgcoreInstance: OcgcoreWrapper | null = null
let cachedScriptReaders: ScriptReader[] | null = null

function getAvailableScriptSources(): { zips: string[]; dirs: string[] } {
  const config = configService.get()
  const zips: string[] = []
  const dirs: string[] = []

  const testDirs = [
    config.gameDirectory,
    config.gameDirectory ? path.join(config.gameDirectory, 'script') : null,
    config.gameDirectory ? path.join(config.gameDirectory, 'expansions', 'script') : null
  ].filter(Boolean) as string[]

  const testZips = [
    config.gameDirectory ? path.join(config.gameDirectory, 'script.zip') : null,
    config.gameDirectory ? path.join(config.gameDirectory, 'expansions', 'script.zip') : null
  ].filter(Boolean) as string[]

  const extraDirs = (config.extraCdbPaths || []).map((p) => path.dirname(p))
  for (const dir of extraDirs) {
    testZips.push(path.join(dir, 'script.zip'))
    testDirs.push(path.join(dir, 'script'))
    testDirs.push(dir)
  }

  for (const z of testZips) {
    if (fs.existsSync(z) && fs.statSync(z).isFile()) {
      zips.push(z)
    }
  }

  for (const d of testDirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory() && !dirs.includes(d)) {
      dirs.push(d)
    }
  }

  return { zips, dirs }
}

async function loadScriptReaders(): Promise<ScriptReader[]> {
  if (cachedScriptReaders) return cachedScriptReaders

  const readers: ScriptReader[] = []
  const sources = getAvailableScriptSources()

  for (const zipPath of sources.zips) {
    try {
      const zipBuf = fs.readFileSync(zipPath)
      const reader = await ZipScriptReader(zipBuf)
      readers.push(reader)
      console.log(`[ocgcore-engine] loaded script zip: ${zipPath}`)
    } catch (err) {
      console.error(`[ocgcore-engine] Failed to load zip script: ${zipPath}`, err)
    }
  }

  if (sources.dirs.length > 0) {
    readers.push(DirScriptReader(...sources.dirs))
    console.log(`[ocgcore-engine] loaded script dirs: ${sources.dirs.join(', ')}`)
  }

  cachedScriptReaders = readers
  return readers
}

export async function bindEngineCapabilities(wrapper: OcgcoreWrapper): Promise<void> {
  wrapper.setMessageHandler((_, message, type) => {
    console.log(`[Core Log (${type})]: ${message}`)
  })

  wrapper.setCardReader(readEngineCardData)

  wrapper.setScriptReader(readCustomScript)

  const readers = await loadScriptReaders()
  for (const reader of readers) {
    wrapper.setScriptReader(reader)
  }
}

export async function getOcgcoreEngine(): Promise<OcgcoreWrapper> {
  if (ocgcoreInstance) return ocgcoreInstance

  ocgcoreInstance = await createOcgcoreWrapper()
  await bindEngineCapabilities(ocgcoreInstance)

  return ocgcoreInstance
}
