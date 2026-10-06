import Database from 'better-sqlite3'
import {
  CdbCard,
  CardType,
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  NumericCompareOp
} from '@shared/index'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

/** 数值比较符 → SQL 运算符 (仅白名单，避免把外部字符串直接拼进 SQL) */
const COMPARATOR: Record<Exclude<NumericCompareOp, 'unknown'>, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<='
}

interface SearchToken {
  text: string
  mode: 'any' | 'name' | 'set'
  excluded: boolean
}

/** 解析 YGOPro 风格的空格分词、引号短语、排除词、$卡名限定与@系列限定。 */
function parseSearchTokens(input: string): SearchToken[] {
  const tokens: SearchToken[] = []
  let index = 0

  while (index < input.length) {
    while (/\s/.test(input[index] ?? '')) index++
    if (index >= input.length) break

    let excluded = false
    if (input[index] === '-') {
      excluded = true
      index++
    }

    let mode: SearchToken['mode'] = 'any'
    if (input[index] === '$') {
      mode = 'name'
      index++
    } else if (input[index] === '@') {
      mode = 'set'
      index++
    }

    let text = ''
    if (input[index] === '"') {
      index++
      const end = input.indexOf('"', index)
      if (end === -1) {
        text = input.slice(index)
        index = input.length
      } else {
        text = input.slice(index, end)
        index = end + 1
      }
    } else {
      const start = index
      while (index < input.length && !/\s/.test(input[index])) index++
      text = input.slice(start, index)
    }

    if (text.trim()) tokens.push({ text: text.trim(), mode, excluded })
  }

  return tokens
}

export class CdbService {
  private db: Database.Database | null = null
  private currentPath: string | null = null
  private setnameMap: Map<number, string> = new Map()
  private systemStringMap: Map<number, string> = new Map()

  /**
   * 从 cards.cdb 同级目录或子目录加载 strings.conf 中的系列名称定义
   */
  private loadStringsConf(cdbPath: string): void {
    this.setnameMap.clear()
    this.systemStringMap.clear()
    const dir = path.dirname(cdbPath)
    const searchDirs = [dir]
    if (path.basename(dir).toLocaleLowerCase() === 'expansions') searchDirs.push(path.dirname(dir))
    const candidatePaths = [
      ...new Set(
        searchDirs.flatMap((searchDir) => [
          path.join(searchDir, 'strings.conf'),
          path.join(searchDir, 'expansions', 'strings.conf')
        ])
      )
    ]

    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          const content = readFileSync(p, 'utf-8')
          const lines = content.split(/\r?\n/)
          for (const line of lines) {
            // !setname 记录系列名；!system 1100–1131 是游戏内效果分类标签。
            const setnameMatch = line.match(/^!setname\s+(0x[0-9a-fA-F]+|\d+)\s+([^\t\r\n]+)/)
            if (setnameMatch) {
              // strings.conf 的 setname 编号按十六进制解析，即使没有 0x 前缀。
              const code = parseInt(setnameMatch[1].replace(/^0x/i, ''), 16)
              const name = setnameMatch[2].trim()
              if (!isNaN(code) && name) this.setnameMap.set(code, name)
            }

            const systemMatch = line.match(/^!system\s+(\d+)\s+([^\t\r\n]+)/)
            if (systemMatch) {
              const id = Number(systemMatch[1])
              const label = systemMatch[2].trim()
              if (id >= 1100 && id < 1132 && label) this.systemStringMap.set(id, label)
            }
          }
          console.log(
            `[CdbService] Loaded ${this.setnameMap.size} setnames and ${this.systemStringMap.size} effect labels from ${p}`
          )
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

  /** 按游戏 strings.conf 的系列名规则解析可匹配的 setcode。 */
  private getSetcodesForKeyword(keyword: string): number[] {
    const normalized = keyword.toLocaleLowerCase()
    const codes: number[] = []
    for (const [code, rawName] of this.setnameMap) {
      const names = rawName.split('|').map((name) => name.trim())
      const matched = names.some((name) => {
        const candidate = name.toLocaleLowerCase()
        return normalized.length < 2 ? candidate === normalized : candidate.includes(normalized)
      })
      if (matched) codes.push(code)
    }
    return codes
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

      const db = new Database(cdbPath, { readonly: true, fileMustExist: true })

      // 校验是真正的卡牌数据库 (必须含 datas 与 texts 表)，避免选中任意 sqlite/其他文件
      const probe = db
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('datas','texts')"
        )
        .get() as { n: number } | undefined
      if (!probe || probe.n < 2) {
        db.close()
        console.error(`[CdbService] Not a valid cards.cdb (missing datas/texts tables): ${cdbPath}`)
        return false
      }

      // 校验通过后才关闭旧连接，保证失败时旧数据库仍然可用
      if (this.db) {
        this.db.close()
      }

      this.db = db
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

  public getSearchFilterOptions(): CardSearchFilterOptions {
    const effectCategories: CardSearchFilterOptions['effectCategories'] = []
    for (let index = 0; index < 32; index++) {
      const label = this.systemStringMap.get(1100 + index)
      if (label) effectCategories.push({ mask: 2 ** index, label })
    }
    return { effectCategories }
  }

  public isReady(): boolean {
    return this.db !== null
  }

  /**
   * 多条件检索卡片；筛选逻辑沿用 YGOPro 的 CDB 位掩码与关键词语法。
   */
  public search(params: CardSearchParams): CardSearchResult {
    if (!this.db) return { cards: [], total: 0 }

    let baseWhere = ' FROM datas d JOIN texts t ON d.id = t.id WHERE 1=1'
    const args: (string | number)[] = []

    const getSetcodeClause = (codes: number[]): string => {
      const exactCodes = [...new Set(codes)]
      const baseCodes = [...new Set(codes.map((code) => code & 0xfff))]
      const parts: string[] = []
      for (const shift of [0, 16, 32, 48]) {
        const exactMarks = exactCodes.map(() => '?').join(',')
        const baseMarks = baseCodes.map(() => '?').join(',')
        parts.push(
          `(((d.setcode >> ${shift}) & 65535) IN (${exactMarks}) OR ((d.setcode >> ${shift}) & 4095) IN (${baseMarks}))`
        )
        args.push(...exactCodes, ...baseCodes)
      }
      return `(${parts.join(' OR ')})`
    }

    // 关键词支持空格 AND、引号短语、-排除词、$卡名限定、@系列限定。
    if (params.keyword && params.keyword.trim().length > 0) {
      const keyword = params.keyword.trim()
      if (/^\d+$/.test(keyword)) {
        baseWhere += ' AND (d.id = ? OR t.name LIKE ?)'
        args.push(parseInt(keyword, 10), `%${keyword}%`)
      } else {
        for (const token of parseSearchTokens(keyword)) {
          const clauses: string[] = []
          const like = `%${token.text}%`
          if (token.mode !== 'set') {
            clauses.push('t.name LIKE ?')
            args.push(like)
          }
          if (token.mode === 'any' && params.searchDesc !== false) {
            clauses.push('t.desc LIKE ?')
            args.push(like)
          }
          if (token.mode !== 'name') {
            const setcodes = this.getSetcodesForKeyword(token.text)
            if (setcodes.length > 0) clauses.push(getSetcodeClause(setcodes))
            else if (token.mode === 'set') clauses.push('0=1')
          }
          if (clauses.length === 0) continue
          const match = `(${clauses.join(' OR ')})`
          baseWhere += token.excluded ? ` AND NOT ${match}` : ` AND ${match}`
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

    // YGOPro 对怪兽按位包含匹配，对魔法/陷阱按完整类型值精确匹配。
    if (params.subType !== undefined && params.subType !== 0) {
      if (params.type === CardType.SPELL || params.type === CardType.TRAP) {
        baseWhere += ' AND d.type = ?'
        args.push(params.subType)
      } else {
        baseWhere += ' AND (d.type & ?) = ?'
        args.push(params.subType, params.subType)
      }
    }

    if (params.attribute !== undefined && params.attribute !== 0) {
      baseWhere += ' AND (d.attribute & ?) != 0'
      args.push(params.attribute)
    }
    if (params.race !== undefined && params.race !== 0) {
      baseWhere += ' AND (d.race & ?) != 0'
      args.push(params.race)
    }

    const addNumericFilter = (
      column: string,
      value: number | undefined,
      op: NumericCompareOp | undefined,
      allowUnknown = false
    ): void => {
      const compare = op ?? 'eq'
      if (compare === 'unknown') {
        if (allowUnknown) baseWhere += ` AND ${column} = -2`
        return
      }
      if (value === undefined || value < 0) return
      if (compare === 'lt' || compare === 'lte') baseWhere += ` AND ${column} >= 0`
      baseWhere += ` AND ${column} ${COMPARATOR[compare]} ?`
      args.push(value)
    }

    if (params.level !== undefined && params.level > 0) {
      addNumericFilter('(d.level & 255)', params.level, params.levelOp)
    }

    if (params.scale !== undefined) {
      baseWhere += ' AND (d.type & ?) != 0'
      args.push(CardType.PENDULUM)
      addNumericFilter('((d.level >> 24) & 255)', params.scale, params.scaleOp)
    }

    addNumericFilter('d.atk', params.atk, params.atkOp, true)
    if (params.def !== undefined || params.defOp === 'unknown') {
      // Link 怪兽没有守备力；对齐 YGOPro，DEF 条件不匹配 Link 怪兽。
      baseWhere += ' AND (d.type & ?) = 0'
      args.push(CardType.LINK)
    }
    addNumericFilter('d.def', params.def, params.defOp, true)

    if (params.effectCategoryMask !== undefined && params.effectCategoryMask > 0) {
      baseWhere += ' AND (d.category & ?) != 0'
      args.push(params.effectCategoryMask)
    }

    if (params.cardPool === 'ocg') baseWhere += ' AND (d.ot & 1) != 0'
    else if (params.cardPool === 'tcg') baseWhere += ' AND (d.ot & 2) != 0'
    else if (params.cardPool === 'both') baseWhere += ' AND (d.ot & 3) = 3'

    try {
      const countSql = `SELECT count(*) as total` + baseWhere
      const countRow = this.db.prepare(countSql).get(...args) as { total: number } | undefined
      const total = countRow?.total ?? 0

      let orderBy = 'd.id'
      if (params.sortField === 'atk') orderBy = 'd.atk'
      else if (params.sortField === 'def') orderBy = 'd.def'
      else if (params.sortField === 'level') orderBy = '(d.level & 255)'
      else if (params.sortField === 'name') orderBy = 't.name'

      const orderDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC'
      const dataSql = `
        SELECT
          d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
          t.name, t.desc
        ${baseWhere}
        ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?
      `
      const rows = this.db
        .prepare(dataSql)
        .all(...args, params.limit || 50, params.offset || 0) as CdbCard[]
      for (const card of rows) {
        if (card.setcode) {
          const setnames = this.getSetnames(card.setcode)
          if (setnames.length > 0) card.setnames = setnames
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

  public getCardById(id: number): CdbCard | null {
    const map = this.getCardsByIds([id])
    return map[id] ?? null
  }

  public getAliasGroupIds(id: number): number[] {
    if (!this.db) return [id]
    try {
      const rows = this.db
        .prepare('SELECT id FROM datas WHERE id = ? OR alias = ?')
        .all(id, id) as Array<{ id: number }>
      const ids = rows.map((r) => r.id)
      return ids.includes(id) ? ids : [id, ...ids]
    } catch (err) {
      console.error('[CdbService] getAliasGroupIds error:', err)
      return [id]
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
