/**
 * 冒烟测试:YGOPro 语言包发现/默认语言读取 + 语言包作为文本覆盖层加载后检索为中文。
 * 运行:node scripts/smoke/language-pack-smoke.bundle.cjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { cdbService } from '../../src/main/db/cdbService'
import {
  currentLanguagePack,
  discoverGameLanguagePacks,
  readGameConfigLanguage
} from '../../src/main/services/gameContent'

const fixture = join(os.tmpdir(), 'yde-smoke-language-pack')

function makeCdb(path: string, cards: Array<{ id: number; ot: number; name: string }>): void {
  const db = new Database(path)
  db.exec(
    'CREATE TABLE datas (id INTEGER PRIMARY KEY, ot INTEGER, alias INTEGER, setcode INTEGER, type INTEGER, atk INTEGER, def INTEGER, level INTEGER, race INTEGER, attribute INTEGER, category INTEGER)'
  )
  db.exec('CREATE TABLE texts (id INTEGER PRIMARY KEY, name TEXT, desc TEXT, strings TEXT)')
  const insert = db.prepare(
    'INSERT INTO datas (id, ot, alias, setcode, type, atk, def, level, race, attribute, category) VALUES (?, ?, 0, 0, 33, 100, 100, 4, 1, 1, 0)'
  )
  const insertText = db.prepare('INSERT INTO texts (id, name, desc, strings) VALUES (?, ?, ?, ?)')
  for (const card of cards) {
    insert.run(card.id, card.ot)
    insertText.run(card.id, card.name, `${card.name} 的效果描述`, null)
  }
  db.close()
}

function fail(message: string): never {
  console.error(`[language-pack-smoke] FAIL: ${message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  process.env.YGO_SMOKE_GAMETYPE = 'ygopro'
  process.env.YGO_SMOKE_GAMEDIR = fixture
  rmSync(fixture, { recursive: true, force: true })
  mkdirSync(join(fixture, 'cdb'), { recursive: true })
  mkdirSync(join(fixture, 'config', 'languages', 'Chs'), { recursive: true })
  mkdirSync(join(fixture, 'config', 'languages', 'Cht'), { recursive: true })

  const cards = [
    { id: 1000, ot: 3, name: 'Blue-Eyes White Dragon' },
    { id: 2000, ot: 2, name: 'Dark Magician' },
    { id: 3000, ot: 0x10, name: 'TF Only Card' }
  ]
  makeCdb(join(fixture, 'cdb', 'cards.cdb'), cards)
  makeCdb(join(fixture, 'config', 'languages', 'Chs', 'ocgtcg.cdb'), [
    { id: 1000, ot: 3, name: '青眼白龙' },
    { id: 2000, ot: 2, name: '黑魔术师' },
    { id: 3000, ot: 0x10, name: 'TF 独有卡' }
  ])
  makeCdb(join(fixture, 'config', 'languages', 'Cht', 'ocgtcg.cdb'), [
    { id: 1000, ot: 3, name: '青眼白龍' }
  ])
  writeFileSync(join(fixture, 'config', 'system.conf'), 'language = Chs\n')

  const packs = discoverGameLanguagePacks(fixture)
  const packIds = packs.map((p) => p.id).join(',')
  if (packIds !== 'en,Chs,Cht') {
    fail(`语言包发现错误: ${packIds}`)
  }
  if (readGameConfigLanguage(fixture) !== 'Chs') fail('system.conf 默认语言读取错误')

  const pack = currentLanguagePack()
  if (!pack || pack.cdbPaths.length !== 1 || !pack.cdbPaths[0].includes('Chs')) {
    fail(`currentLanguagePack 错误: ${JSON.stringify(pack)}`)
  }

  const ok = cdbService.open(join(fixture, 'cdb', 'cards.cdb'), [], [], pack)
  if (!ok) fail('卡库加载失败')

  const named = cdbService.getCardsByIds([1000])
  if (named[1000]?.name !== '青眼白龙') fail(`文本覆盖失败: ${named[1000]?.name}`)

  const chinese = cdbService.search({ keyword: '黑魔术师' })
  if (chinese.total !== 1 || chinese.cards[0]?.name !== '黑魔术师') {
    fail(`中文关键词检索失败: ${JSON.stringify(chinese.cards.map((c) => c.name))}`)
  }

  const tf = cdbService.search({ cardPool: 'tf' })
  if (tf.total !== 1 || tf.cards[0]?.name !== 'TF 独有卡') {
    fail(`TF 池过滤失败: ${JSON.stringify(tf.cards.map((c) => c.name))}`)
  }

  const switched = cdbService.open(
    join(fixture, 'cdb', 'cards.cdb'),
    [],
    [],
    { id: 'Cht', cdbPaths: [join(fixture, 'config', 'languages', 'Cht', 'ocgtcg.cdb')] }
  )
  if (!switched) fail('切换繁体语言包加载失败')
  const traditional = cdbService.getCardsByIds([1000])
  if (traditional[1000]?.name !== '青眼白龍')
    fail(`切换语言包后覆盖失败: ${traditional[1000]?.name}`)

  cdbService.close()
  rmSync(fixture, { recursive: true, force: true })
  console.log('[language-pack-smoke] OK')
}

main().catch((err) => {
  console.error('[language-pack-smoke] ERROR:', err)
  process.exit(1)
})
