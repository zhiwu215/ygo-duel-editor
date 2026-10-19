/**
 * 冒烟测试用 cdbService 替身：sql.js 读取 cards.cdb，接口与真实 cdbService 对齐（仅 getCardById）。
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

interface CdbCardLike {
  id: number
  ot?: number
  alias?: number
  setcode?: number
  type?: number
  atk?: number
  def?: number
  level?: number
  race?: number
  attribute?: number
  category?: number
  name?: string
}


const cdbPath = process.env.YGO_SMOKE_CDB || 'E:/MyCardLibrary/ygopro/cards.cdb'

let db: ReturnType<Awaited<typeof initSqlJs>>['Database'] extends infer T ? T : never
const cardCache = new Map<number, CdbCardLike>()

async function loadCdb(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = new (SQL as any).Database(fs.readFileSync(cdbPath))
  const stmt = db.prepare(
    'SELECT d.id AS id, d.ot AS ot, d.alias AS alias, d.setcode AS setcode, d.type AS type, d.atk AS atk, d.def AS def, d.level AS level, d.race AS race, d.attribute AS attribute, d.category AS category, t.name AS name FROM datas d LEFT JOIN texts t ON t.id = d.id'
  )
  stmt.bind()
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const id = Number(row.id)
    if (Number.isFinite(id) && id > 0) {
      cardCache.set(id, {
        id,
        ot: Number(row.ot ?? 0),
        alias: Number(row.alias ?? 0),
        setcode: Number(row.setcode ?? 0),
        type: Number(row.type ?? 0),
        atk: row.atk == null ? undefined : Number(row.atk),
        def: row.def == null ? undefined : Number(row.def),
        level: Number(row.level ?? 0),
        race: Number(row.race ?? 0),
        attribute: Number(row.attribute ?? 0),
        category: Number(row.category ?? 0),
        name: row.name == null ? undefined : String(row.name)
      })
    }
  }
  stmt.free()
}

export const cdbService = {
  getCardById(id: number): CdbCardLike | null {
    return cardCache.get(id) ?? null
  },
  /** 冒烟测试辅助：按类型掩码找卡（TYPE_PENDULUM = 0x1000000） */
  findCardsByType(typeMask: number, limit: number): CdbCardLike[] {
    const out: CdbCardLike[] = []
    for (const card of cardCache.values()) {
      if ((Number(card.type ?? 0) & typeMask) !== 0 && (Number(card.type ?? 0) & 0x400000) === 0) {
        out.push(card)
        if (out.length >= limit) break
      }
    }
    return out
  },
  get size(): number {
    return cardCache.size
  },
  ready: loadCdb
}
