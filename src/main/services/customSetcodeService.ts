import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dataDirService } from './dataDirService'

const LIBRARY_FILE = 'custom_setcodes.json'
const MAX_NAME_LENGTH = 40

type SetcodeNames = Record<string, string>

function normalizeCodeHex(value: string): string | null {
  const text = value.replace(/^0x/i, '').trim()
  if (!/^[0-9a-f]{1,4}$/i.test(text)) return null
  return text.toUpperCase().padStart(4, '0')
}

class CustomSetcodeService {
  private names: SetcodeNames = {}
  private loaded = false

  private get filePath(): string {
    return dataDirService.resolve(LIBRARY_FILE)
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    if (!existsSync(this.filePath)) return
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, unknown>
      for (const [key, value] of Object.entries(parsed)) {
        const code = normalizeCodeHex(key)
        if (!code || typeof value !== 'string') continue
        const name = value.trim().slice(0, MAX_NAME_LENGTH)
        if (name) this.names[code] = name
      }
    } catch (err) {
      console.error('[CustomSetcodeService] Failed to load setcode names:', err)
    }
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.names, null, 2), 'utf-8')
  }

  public list(): SetcodeNames {
    this.ensureLoaded()
    return { ...this.names }
  }

  public rename(codeHex: string, name: string): SetcodeNames {
    this.ensureLoaded()
    const code = normalizeCodeHex(codeHex)
    if (!code) throw new Error('字段代码必须是 1–4 位十六进制')
    const nextName = name.trim().slice(0, MAX_NAME_LENGTH)
    if (nextName) this.names[code] = nextName
    else delete this.names[code]
    this.persist()
    return { ...this.names }
  }
}

export const customSetcodeService = new CustomSetcodeService()
