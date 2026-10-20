import fs from 'fs'
import path from 'path'
import { configService } from '../configService'
import { parseEffectSystemLine } from '../../db/stringsConfParser'

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
      const record = parseEffectSystemLine(line)
      if (!record) continue
      if (record.section === '!effect') effectStrings.set(record.id, record.text)
      else if (record.section === '!system') systemStrings.set(record.id, record.text)
    }
  } catch (err) {
    console.warn('[strings-service] 读取 strings.conf 失败:', err)
  }
}

function expandPlaceholders(text: string, args: string[]): string {
  let index = 0
  return text.replace(/\[%ls\]|\[%d\]/g, (token) => {
    if (token === '[%d]') return ''
    const value = args[index++] ?? ''
    return value ? `【${value}】` : '该卡'
  })
}

export function getEffectDescText(desc: number, args: string[] = []): string | undefined {
  loadStringsConf()
  const text = effectStrings.get(desc)
  if (text === undefined) return undefined
  return expandPlaceholders(text, args)
}

export function getSystemDescText(desc: number, args: string[] = []): string | undefined {
  loadStringsConf()
  const text = systemStrings.get(desc)
  if (text === undefined) return undefined
  return expandPlaceholders(text, args)
}
