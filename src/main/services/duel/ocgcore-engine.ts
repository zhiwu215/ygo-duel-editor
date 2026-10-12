import fs from 'fs'
import path from 'path'
import {
  createOcgcoreWrapper,
  ZipScriptReader,
  DirScriptReader,
  OcgcoreWrapper
} from 'koishipro-core.js'
import { cdbService } from '../../db/cdbService'
import { configService } from '../configService'

let ocgcoreInstance: OcgcoreWrapper | null = null

function getAvailableScriptSources(): { zips: string[]; dirs: string[] } {
  const config = configService.get()
  const zips: string[] = []
  const dirs: string[] = []

  const testDirs = [
    config.gameDirectory,
    config.gameDirectory ? path.join(config.gameDirectory, 'script') : null,
    config.gameDirectory ? path.join(config.gameDirectory, 'expansions', 'script') : null,
    'D:/Codes/mdpro3/MDPro3-master/Data/script',
    'D:/Codes/ygopro/ygopro/script'
  ].filter(Boolean) as string[]

  const testZips = [
    config.gameDirectory ? path.join(config.gameDirectory, 'script.zip') : null,
    config.gameDirectory ? path.join(config.gameDirectory, 'expansions', 'script.zip') : null,
    'D:/Codes/mdpro3/MDPro3-master/Data/script.zip'
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

export async function getOcgcoreEngine(): Promise<OcgcoreWrapper> {
  if (ocgcoreInstance) return ocgcoreInstance

  ocgcoreInstance = await createOcgcoreWrapper()
  ocgcoreInstance.setMessageHandler((_, message, type) => {
    console.log(`[Core Log (${type})]: ${message}`)
  })

  ocgcoreInstance.setCardReader((code) => {
    const card = cdbService.getCardById(code)
    if (!card) return null
    return {
      code: card.id,
      alias: card.alias ?? 0,
      setcode: Number(card.setcode ?? 0),
      type: card.type,
      atk: card.atk ?? 0,
      def: card.def ?? 0,
      level: card.level ?? 0,
      race: card.race ?? 0,
      attribute: card.attribute ?? 0,
      category: Number(card.category ?? 0)
    }
  })

  const sources = getAvailableScriptSources()
  for (const zipPath of sources.zips) {
    try {
      const zipBuf = fs.readFileSync(zipPath)
      const reader = await ZipScriptReader(zipBuf)
      ocgcoreInstance.setScriptReader(reader, true)
    } catch (err) {
      console.error(`[ocgcore-engine] Failed to load zip script: ${zipPath}`, err)
    }
  }

  if (sources.dirs.length > 0) {
    const dirReader = DirScriptReader(...sources.dirs)
    ocgcoreInstance.setScriptReader(dirReader, true)
  }

  return ocgcoreInstance
}

export function isEngineReady(): boolean {
  return ocgcoreInstance !== null
}
