import Database from 'better-sqlite3'
import { CdbCard, CardSearchParams, CardSearchResult } from '@shared/index'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

export class CdbService {
  private db: Database.Database | null = null
  private currentPath: string | null = null
  private setnameMap: Map<number, string> = new Map()

  /**
   * 从 cards.cdb 同级目录或子目录加载 strings.conf 中的系列名称定义
   */
  private loadStringsConf(cdbPath: string): void {
    this.setnameMap.clear()
    const dir = path.dirname(cdbPath)
    const candidatePaths = [
      path.join(dir, 'strings.conf'),
      path.join(dir, 'expansions', 'strings.conf')
    ]

    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          const content = readFileSync(p, 'utf-8')
          const lines = content.split(/\r?\n/)
          for (const line of lines) {
            if (!line.startsWith('!setname')) continue
            // 格式形如: !setname 0x22 朱罗纪\tジュラック 或 !setname 0x11d 禁忌的
            const match = line.match(/^!setname\s+(0x[0-9a-fA-F]+|\d+)\s+([^\t\r\n]+)/)
            if (match) {
              const code = parseInt(match[1], 16)
              const name = match[2].trim()
              if (!isNaN(code) && name) {
                this.setnameMap.set(code, name)
              }
            }
          }
          console.log(`[CdbService] Loaded ${this.setnameMap.size} setnames from ${p}`)
        } catch (err) {
          console.error(`[CdbService] Failed to parse ${p}:`, err)
        }
      }
    }
  }

  /**
   * 根据 setcode 掩码解析卡片所属的所有系列名
   */
  public getSetnames(setcode: number | bigint): string[] {
    if (!setcode || this.setnameMap.size === 0) return []
    const names: string[] = []
    let val = typeof setcode === 'bigint' ? setcode : BigInt(setcode)
    if (val === 0n) return []

    // ocgcore 的 setcode 最多支持 4 个 16 位字段
    for (let i = 0; i < 4; i++) {
      const chunk = Number(val & 0xffffn)
      if (chunk > 0) {
        const name = this.setnameMap.get(chunk)
        if (name && !names.includes(name)) {
          names.push(name)
        } else {
          // 子字段低 12 位
          const sub = chunk & 0xfff
          const subName = this.setnameMap.get(sub)
          if (subName && !names.includes(subName)) {
            names.push(subName)
          }
        }
      }
      val = val >> 16n
    }
    return names
  }

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
      this.loadStringsConf(cdbPath)
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
   * 多条件检索卡片 (支持全文/卡名、种类、细分类型、属性、种族、星级、攻防、卡密、排序)
   */
  public search(params: CardSearchParams): CardSearchResult {
    if (!this.db) return { cards: [], total: 0 }

    let baseWhere = ' FROM datas d JOIN texts t ON d.id = t.id WHERE 1=1'
    const args: (string | number)[] = []

    // 关键词搜索 (卡名、效果描述、或者精确卡密)
    if (params.keyword && params.keyword.trim().length > 0) {
      const kw = params.keyword.trim()
      if (/^\d+$/.test(kw)) {
        baseWhere += ' AND (d.id = ? OR t.name LIKE ?)'
        args.push(parseInt(kw, 10), `%${kw}%`)
      } else {
        if (params.searchDesc !== false) {
          baseWhere += ' AND (t.name LIKE ? OR t.desc LIKE ?)'
          args.push(`%${kw}%`, `%${kw}%`)
        } else {
          baseWhere += ' AND t.name LIKE ?'
          args.push(`%${kw}%`)
        }
      }
    }

    // 精确卡密过滤
    if (params.code !== undefined && params.code > 0) {
      baseWhere += ' AND d.id = ?'
      args.push(params.code)
    }

    // 主种类过滤 (Monster / Spell / Trap)
    if (params.type !== undefined && params.type !== 0) {
      baseWhere += ' AND (d.type & ?) != 0'
      args.push(params.type)
    }

    // 细分种类过滤 (如 Fusion / Synchro / Quickplay / Continuous 等)
    if (params.subType !== undefined && params.subType !== 0) {
      baseWhere += ' AND (d.type & ?) != 0'
      args.push(params.subType)
    }

    // 属性过滤
    if (params.attribute !== undefined && params.attribute !== 0) {
      baseWhere += ' AND (d.attribute & ?) != 0'
      args.push(params.attribute)
    }

    // 种族过滤
    if (params.race !== undefined && params.race !== 0) {
      baseWhere += ' AND (d.race & ?) != 0'
      args.push(params.race)
    }

    // 等级/阶级/连接值过滤 (取低 8 位: d.level & 0xff)
    if (params.level !== undefined && params.level > 0) {
      baseWhere += ' AND (d.level & 255) = ?'
      args.push(params.level)
    }

    // 攻击力过滤
    if (params.atk !== undefined && params.atk >= 0) {
      baseWhere += ' AND d.atk = ?'
      args.push(params.atk)
    }

    // 守备力过滤
    if (params.def !== undefined && params.def >= 0) {
      baseWhere += ' AND d.def = ?'
      args.push(params.def)
    }

    try {
      // 1. 获取符合条件的总数
      const countSql = `SELECT count(*) as total` + baseWhere
      const countStmt = this.db.prepare(countSql)
      const countRow = countStmt.get(...args) as { total: number } | undefined
      const total = countRow?.total ?? 0

      // 2. 排序规则
      let orderBy = 'd.id'
      if (params.sortField === 'atk') orderBy = 'd.atk'
      else if (params.sortField === 'def') orderBy = 'd.def'
      else if (params.sortField === 'level') orderBy = '(d.level & 255)'
      else if (params.sortField === 'name') orderBy = 't.name'

      const orderDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC'

      // 3. 分页查询记录
      const dataSql = `
        SELECT 
          d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
          t.name, t.desc
        ${baseWhere}
        ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?
      `
      const dataStmt = this.db.prepare(dataSql)
      const rows = dataStmt.all(...args, params.limit || 50, params.offset || 0) as CdbCard[]
      for (const card of rows) {
        if (card.setcode) {
          const sn = this.getSetnames(card.setcode)
          if (sn.length > 0) card.setnames = sn
        }
      }

      return { cards: rows, total }
    } catch (err) {
      console.error('[CdbService] Search error:', err)
      return { cards: [], total: 0 }
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
        if (card.setcode) {
          const sn = this.getSetnames(card.setcode)
          if (sn.length > 0) card.setnames = sn
        }
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
