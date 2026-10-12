import fs from 'fs'
import path from 'path'
import { configService } from '../configService'

const effectStrings = new Map<number, string>()
const systemStrings = new Map<number, string>()
let loaded = false

function loadStringsConf(): void {
  if (loaded) return
  loaded = true
  const dir = configService.get().gameDirectory
  if (!dir) return
  const confPath = path.join(dir, 'strings.conf')
  if (!fs.existsSync(confPath)) return
  try {
    const content = fs.readFileSync(confPath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('!')) continue
      const section = trimmed.split(/\s+/)[0]
      const rest = trimmed.slice(section.length).trim()
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx === -1) continue
      const id = Number(rest.slice(0, spaceIdx))
      if (!Number.isFinite(id)) continue
      const text = rest.slice(spaceIdx + 1).trim()
      if (section === '!effect') effectStrings.set(id, text)
      else if (section === '!system') systemStrings.set(id, text)
    }
  } catch (err) {
    console.warn('[strings-service] 读取 strings.conf 失败:', err)
  }
}

function expandPlaceholders(text: string, cardName: string): string {
  return text
    .replaceAll('[%ls]', cardName ? `【${cardName}】` : '该卡')
    .replaceAll('[%ls]', cardName ? `【${cardName}】` : '该卡')
    .replaceAll('[%d]', '')
}

export function getEffectDescText(desc: number, cardName?: string): string | undefined {
  loadStringsConf()
  const text = effectStrings.get(desc)
  if (text === undefined) return undefined
  return expandPlaceholders(text, cardName ?? '')
}

export function getSystemDescText(desc: number, cardName?: string): string | undefined {
  loadStringsConf()
  const text = systemStrings.get(desc)
  if (text === undefined) return undefined
  return expandPlaceholders(text, cardName ?? '')
}

export function hasEffectStringsConf(): boolean {
  loadStringsConf()
  return effectStrings.size > 0
}
