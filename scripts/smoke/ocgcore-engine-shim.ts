/**
 * 联测用 ocgcore-engine 替身：
 * 与真实实现接口一致（getOcgcoreEngine / isEngineReady），
 * 但用 wasmBinary 直喂（绕过 ESM/CJS 与 fetch 的坑）。
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { cdbService } from './cdb-shim'

declare const __filename: string
const coreRequire = createRequire(__filename)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocgcoreInstance: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedReaders: any[] | null = null

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'

function wasmDir(): string {
  return path.join(path.dirname(coreRequire.resolve('koishipro-core.js')), 'vendor/wasm_cjs')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOcgcoreEngine(): Promise<any> {
  if (ocgcoreInstance) return ocgcoreInstance
  // 引擎读卡前必须先把 cdb 载入（否则卡片数据全空，行为异常）
  await cdbService.ready()
  const { createOcgcoreWrapper } = await import('koishipro-core.js')
  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(wasmDir(), 'libocgcore.wasm')))
  ocgcoreInstance = await createOcgcoreWrapper({ wasmBinary })
  await bindEngineCapabilities(ocgcoreInstance)
  return ocgcoreInstance
}

export function isEngineReady(): boolean {
  return ocgcoreInstance !== null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function bindEngineCapabilities(wrapper: any): Promise<void> {
  wrapper.setMessageHandler((_: unknown, message: string, type: number) => {
    if (type === 2) console.log(`[core-error] ${message}`)
  })
  wrapper.setCardReader((code: number) => {
    const c = cdbService.getCardById(code)
    if (!c) return null
    return {
      code: c.id,
      alias: c.alias ?? 0,
      setcode: Number(c.setcode ?? 0),
      type: Number(c.type ?? 0),
      atk: c.atk ?? 0,
      def: c.def ?? 0,
      level: c.level ?? 0,
      race: Number(c.race ?? 0),
      attribute: Number(c.attribute ?? 0),
      category: 0
    }
  })

  if (!cachedReaders) {
    const scriptRoot = path.join(GAME_DIR, 'script')
    cachedReaders = [
      (scriptPath: string): Uint8Array | null => {
        const normalized = scriptPath.replace(/^\.\//, '').replace(/^script\//, '')
        try {
          return new Uint8Array(fs.readFileSync(path.join(scriptRoot, normalized)))
        } catch {
          return null
        }
      }
    ]
  }
  for (const reader of cachedReaders) {
    wrapper.setScriptReader(reader, true)
  }
}
