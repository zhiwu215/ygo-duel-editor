import Database from 'better-sqlite3'
import { CdbCard, CardSearchParams } from '@shared/index'
import { existsSync } from 'fs'

export class CdbService {
  private db: Database.Database | null = null
  private currentPath: string | null = null

  /**
   * 打开指定路径的 cards.cdb 文件
   */
  public open(cdbPath: string): boolean {
    try {
      if (!existsSync(cdbPath)) {
        console.error(`[CdbService] File not found: ${cdbPath}`)
        return false
      }

      // 关闭之前已打开的数据库
      if (this.db) {
        this.db.close()
        this.db = null
      }

      // 以只读模式连接，提升性能且不锁死游戏文件
      this.db = new Database(cdbPath, { readonly: true, fileMustExist: true })
      this.currentPath = cdbPath
      console.log(`[CdbService] Successfully connected to cards.cdb: ${cdbPath}`)
      return true
    } catch (err) {
      console.error('[CdbService] Failed to open cdb:', err)
      return false
    }
  }

  public getCurrentPath(): string | null {
    return this.currentPath
  }

  public isReady(): boolean {
    return this.db !== null
  }

  /**
   * 多条件检索卡片
   */
  public search(params: CardSearchParams): CdbCard[] {
    if (!this.db) return []

    let sql = `
      SELECT 
        d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
        t.name, t.desc
      FROM datas d
      JOIN texts t ON d.id = t.id
      WHERE 1=1
    `
    const args: (string | number)[] = []

    // 关键词搜索 (卡名、效果描述、或者精确卡密)
    if (params.keyword && params.keyword.trim().length > 0) {
      const kw = params.keyword.trim()
      // 如果是纯数字，优先匹配卡密
      if (/^\d+$/.test(kw)) {
        sql += ` AND (d.id = ? OR t.name LIKE ?)`
        args.push(parseInt(kw, 10), `%${kw}%`)
      } else {
        sql += ` AND (t.name LIKE ? OR t.desc LIKE ?)`
        args.push(`%${kw}%`, `%${kw}%`)
      }
    }

    // 种类过滤 (使用位与运算)
    if (params.type !== undefined && params.type !== 0) {
      sql += ` AND (d.type & ?) = ?`
      args.push(params.type, params.type)
    }

    // 属性过滤
    if (params.attribute !== undefined && params.attribute !== 0) {
      sql += ` AND (d.attribute & ?) != 0`
      args.push(params.attribute)
    }

    // 种族过滤
    if (params.race !== undefined && params.race !== 0) {
      sql += ` AND (d.race & ?) != 0`
      args.push(params.race)
    }

    // 攻击力过滤
    if (params.atk !== undefined && params.atk >= 0) {
      sql += ` AND d.atk = ?`
      args.push(params.atk)
    }

    // 守备力过滤
    if (params.def !== undefined && params.def >= 0) {
      sql += ` AND d.def = ?`
      args.push(params.def)
    }

    // 分页与排序
    sql += ` ORDER BY d.id DESC LIMIT ? OFFSET ?`
    args.push(params.limit || 50, params.offset || 0)

    try {
      const stmt = this.db.prepare(sql)
      const rows = stmt.all(...args) as CdbCard[]
      return rows
    } catch (err) {
      console.error('[CdbService] Search error:', err)
      return []
    }
  }

  /**
   * 根据卡密列表批量查询卡片详细信息
   */
  public getCardsByIds(ids: number[]): Record<number, CdbCard> {
    if (!this.db || ids.length === 0) return {}

    const placeholders = ids.map(() => '?').join(',')
    const sql = `
      SELECT 
        d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
        t.name, t.desc
      FROM datas d
      JOIN texts t ON d.id = t.id
      WHERE d.id IN (${placeholders})
    `

    try {
      const stmt = this.db.prepare(sql)
      const rows = stmt.all(...ids) as CdbCard[]
      const result: Record<number, CdbCard> = {}
      for (const card of rows) {
        result[card.id] = card
      }
      return result
    } catch (err) {
      console.error('[CdbService] getCardsByIds error:', err)
      return {}
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.currentPath = null
    }
  }
}

export const cdbService = new CdbService()
