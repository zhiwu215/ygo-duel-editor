import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CustomCard } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'

export interface CustomCardScriptReference {
  code: number
  name: string
  script: string
}

const SEARCH_TERMS = [
  '特殊召唤',
  '破坏',
  '抽卡',
  '检索',
  '墓地',
  '除外',
  '无效',
  '攻击力',
  '守备力',
  '表示形式',
  '以……为对象',
  '控制权'
]

const MAX_REFERENCES = 2
const MAX_SCRIPT_LENGTH = 6000

function scriptDirectories(): string[] {
  const cfg = configService.get()
  const dirs: string[] = []
  if (cfg.gameDirectory) {
    dirs.push(path.join(cfg.gameDirectory, 'script'))
    dirs.push(path.join(cfg.gameDirectory, 'expansions', 'script'))
  }
  for (const cdbPath of cfg.extraCdbPaths ?? []) {
    const dir = path.dirname(cdbPath)
    dirs.push(path.join(dir, 'script'))
  }
  return [...new Set(dirs)]
}

function readOfficialScript(code: number): string | null {
  const name = `c${code}.lua`
  for (const dir of scriptDirectories()) {
    const filePath = path.join(dir, name)
    if (!existsSync(filePath)) continue
    try {
      return readFileSync(filePath, 'utf-8')
        .replace(/^\uFEFF/, '')
        .slice(0, MAX_SCRIPT_LENGTH)
    } catch {
      continue
    }
  }
  return null
}

export function collectCustomCardScriptReferences(card: CustomCard): CustomCardScriptReference[] {
  if (!card.desc.trim()) return []
  const terms = SEARCH_TERMS.filter((term) => card.desc.includes(term)).slice(0, 3)
  if (terms.length === 0) return []

  const seen = new Set<number>([card.id])
  const references: CustomCardScriptReference[] = []
  for (const term of terms) {
    let cards: Array<{ id: number; name: string }> = []
    try {
      const result = cdbService.search({
        keyword: term,
        searchDesc: true,
        showUnofficial: false,
        limit: 20
      })
      cards = result.cards.map((item) => ({ id: item.id, name: item.name }))
    } catch {
      continue
    }
    for (const item of cards) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      const script = readOfficialScript(item.id)
      if (!script) continue
      references.push({ code: item.id, name: item.name, script })
      if (references.length >= MAX_REFERENCES) return references
    }
  }
  return references
}
