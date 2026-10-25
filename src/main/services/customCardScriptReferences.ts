import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CustomCard } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { getGameScriptDirectories } from './gameScriptPaths'
import { readArchivedCardScript } from './scriptArchive'

export interface CustomCardScriptReference {
  code: number
  name: string
  script: string
}

const REFERENCE_TERMS = [
  '作为素材',
  '超量素材',
  '融合素材',
  '同调素材',
  '连接素材',
  '超量召唤',
  '融合召唤',
  '同调召唤',
  '连接召唤',
  '仪式召唤',
  '上级召唤',
  '特殊召唤',
  '破坏',
  '送去墓地',
  '回到手牌',
  '回到卡组',
  '回到场上',
  '解放',
  '丢弃',
  '除外',
  '抽卡',
  '检索',
  '加入手牌',
  '无效',
  '不能攻击',
  '不能召唤',
  '不能作为',
  '攻击力',
  '守备力',
  '表示形式',
  '控制权',
  '战斗伤害',
  '效果伤害',
  '伤害',
  '回复',
  '指示物',
  '装备',
  '场地魔法',
  '速攻魔法',
  '反击陷阱',
  '翻转',
  '战斗阶段',
  '主要阶段',
  '结束阶段',
  '准备阶段',
  '连锁'
]

const MARKER_HINTS: Array<{ test: RegExp; weight: number; markers: string[] }> = [
  {
    test: /成为.*素材|作为.*素材|超量素材|融合素材|同调素材|连接素材/,
    weight: 16,
    markers: ['EVENT_BE_MATERIAL']
  },
  {
    test: /超量.*素材|超量召唤|成为.*超量/,
    weight: 10,
    markers: ['GetReasonCard']
  },
  {
    test: /超量/,
    weight: 8,
    markers: ['REASON_XYZ']
  },
  { test: /伤害/, weight: 6, markers: ['CATEGORY_DAMAGE', 'Duel.Damage'] },
  { test: /破坏/, weight: 6, markers: ['CATEGORY_DESTROY', 'Duel.Destroy'] },
  { test: /特殊召唤/, weight: 6, markers: ['CATEGORY_SPECIAL_SUMMON', 'Duel.SpecialSummon'] },
  { test: /加入手牌|检索/, weight: 6, markers: ['CATEGORY_TOHAND', 'CATEGORY_SEARCH'] },
  { test: /抽卡/, weight: 6, markers: ['CATEGORY_DRAW', 'Duel.Draw'] },
  { test: /除外/, weight: 6, markers: ['CATEGORY_REMOVE', 'LOCATION_REMOVED'] },
  { test: /攻击力|守备力/, weight: 6, markers: ['CATEGORY_ATKCHANGE', 'CATEGORY_DEFCHANGE'] },
  { test: /无效/, weight: 6, markers: ['CATEGORY_NEGATE'] },
  { test: /控制权/, weight: 6, markers: ['CATEGORY_CONTROL'] },
  { test: /以.*为对象/, weight: 4, markers: ['Duel.SelectTarget'] }
]

const MAX_REFERENCES = 3
const MAX_SCRIPT_LENGTH = 6000
const MAX_TERMS = 6

interface ScriptCandidate {
  code: number
  name: string
  desc: string
}

interface ScoredCandidate extends ScriptCandidate {
  script: string
  score: number
}

function scriptDirectories(): string[] {
  const cfg = configService.get()
  const dirs = getGameScriptDirectories()
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
  const archived = readArchivedCardScript(code)
  return archived === null ? null : archived.slice(0, MAX_SCRIPT_LENGTH)
}

function searchTerms(desc: string): string[] {
  const terms = new Set(REFERENCE_TERMS.filter((term) => desc.includes(term)))
  if (/成为.*素材|作为.*素材/.test(desc)) terms.add('作为素材')
  if (/超量/.test(desc)) terms.add('超量召唤')
  if (/同调/.test(desc)) terms.add('同调召唤')
  if (/融合/.test(desc)) terms.add('融合召唤')
  if (/连接/.test(desc)) terms.add('连接召唤')
  return [...terms].slice(0, MAX_TERMS)
}

function markerScore(desc: string, script: string): number {
  let score = 0
  for (const hint of MARKER_HINTS) {
    if (!hint.test.test(desc)) continue
    if (hint.markers.some((marker) => script.includes(marker))) score += hint.weight
  }
  return score
}

export function collectCustomCardScriptReferences(card: CustomCard): CustomCardScriptReference[] {
  const desc = card.desc.trim()
  if (!desc) return []
  const terms = searchTerms(desc)
  if (terms.length === 0) return []

  const candidates = new Map<number, ScriptCandidate>()
  for (const term of terms) {
    let cards: Array<{ id: number; name: string; desc: string }> = []
    try {
      const result = cdbService.search({
        keyword: term,
        searchDesc: true,
        showUnofficial: false,
        limit: 30
      })
      cards = result.cards.map((item) => ({ id: item.id, name: item.name, desc: item.desc }))
    } catch {
      continue
    }
    for (const item of cards) {
      if (item.id === card.id || candidates.has(item.id)) continue
      candidates.set(item.id, {
        code: item.id,
        name: item.name,
        desc: item.desc
      })
    }
  }

  const scored: ScoredCandidate[] = []
  for (const candidate of candidates.values()) {
    const script = readOfficialScript(candidate.code)
    if (!script) continue
    const overlap = terms.filter((term) => candidate.desc.includes(term)).length
    scored.push({
      ...candidate,
      script,
      score: overlap * 2 + markerScore(desc, script)
    })
  }

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_REFERENCES)
    .map((candidate) => ({
      code: candidate.code,
      name: candidate.name,
      script: candidate.script
    }))
}
