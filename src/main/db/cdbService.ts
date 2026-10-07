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
import * as fs from 'fs'
import path from 'path'

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

/** 决定同卡种内的细分先后，取值越小越靠前 */
function subtypeOrder(type: number): number {
  return type & 0x48020c0 ? type & 0x48020c1 : type & 0x31
}

function compareCards(params: CardSearchParams): (a: CdbCard, b: CdbCard) => number {
  const dir = params.sortOrder === 'ASC' ? 1 : -1
  switch (params.sortField) {
    case 'atk':
      return (a, b) => ((a.atk ?? 0) - (b.atk ?? 0)) * dir
    case 'def':
      return (a, b) => ((a.def ?? 0) - (b.def ?? 0)) * dir
    case 'level':
      return (a, b) => (((a.level ?? 0) & 255) - ((b.level ?? 0) & 255)) * dir
    case 'name':
      return (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')) * dir
    default:
      return (a, b) => {
        const at = a.type & 0x7
        const bt = b.type & 0x7
        if (at !== bt) return (at - bt) * -dir
        if (at === CardType.MONSTER) {
          const as = subtypeOrder(a.type)
          const bs = subtypeOrder(b.type)
          if (as !== bs) return (as - bs) * -dir
          const al = (a.level ?? 0) & 255
          const bl = (b.level ?? 0) & 255
          if (al !== bl) return (al - bl) * dir
          const aa = a.atk ?? 0
          const ba = b.atk ?? 0
          if (aa !== ba) return (aa - ba) * dir
          const ad = a.def ?? 0
          const bd = b.def ?? 0
          if (ad !== bd) return (ad - bd) * dir
          return (a.id ?? 0) - (b.id ?? 0)
        }
        const ar = a.type & ~0x7
        const br = b.type & ~0x7
        if (ar !== br) return (ar - br) * -dir
        return (a.id ?? 0) - (b.id ?? 0)
      }
  }
}

interface CdbConnection {
  path: string
  db: Database.Database
  poolId: string
}

export class CdbService {
  private connections: CdbConnection[] = []
  private currentPath: string | null = null
  private setnameMap: Map<number, string> = new Map()
  private systemStringMap: Map<number, string> = new Map()
  private poolTagMap: Record<string, string> = {}
  private limitMap: Map<number, 1 | 2 | 3> = new Map()
  private gameDirectory: string | undefined

  public setPoolTags(tags: Record<string, string>): void {
    this.poolTagMap = tags
    for (const conn of this.connections) {
      const tag = tags[conn.path]
      conn.poolId = !tag || tag === 'none' ? '' : tag
    }
  }

  /** 卡库加载后需要重新探测 lflists 的目录（游戏根目录未必与 cdb 同级） */
  public setGameDirectory(gameDirectory: string | undefined): void {
    this.gameDirectory = gameDirectory
    if (!gameDirectory || this.connections.length === 0) return
    this.loadLflists([gameDirectory, ...this.connections.map((c) => path.dirname(c.path))])
  }

  /**
   * 解析 lflists 得到「卡密 → 禁限等级」。
   * 每行格式为「卡密 限制位 名称」，其中限制位 0=禁止 1=准限制 2=限制，
   * 与 YGOPro 的 filter_lm 语义一致（该位直接决定筛选结果，不依赖段落标题）。
   * `#` 与 `!` 开头是版本/段落标记，仅用于兼容旧格式（部分文件的限制位恒为 0）。
   */
  private loadLflists(searchDirs: string[]): void {
    this.limitMap.clear()
    const candidates: string[] = []
    for (const dir of searchDirs) {
      if (!dir) continue
      candidates.push(path.join(dir, 'lflist.conf'))
      candidates.push(path.join(dir, 'lflists'))
    }

    const sectionLevels: Array<{ pattern: RegExp; level: 1 | 2 | 3 }> = [
      { pattern: /^#forbidden/i, level: 1 },
      { pattern: /^#limited/i, level: 2 },
      { pattern: /^#semi-?limited/i, level: 3 }
    ]

    let current: 1 | 2 | 3 | null = null
    let loaded = 0

    for (const candidate of candidates) {
      let stat: fs.Stats
      try {
        stat = fs.statSync(candidate)
      } catch {
        continue
      }

      const files = stat.isDirectory()
        ? fs
            .readdirSync(candidate)
            .filter(
              (f) =>
                f.toLocaleLowerCase().endsWith('.conf') || f.toLocaleLowerCase().endsWith('.txt')
            )
            .map((f) => path.join(candidate, f))
        : [candidate]

      for (const file of files) {
        current = null
        try {
          const content = readFileSync(file, 'utf-8')
          for (const line of content.split(/\r?\n/)) {
            if (!line || line[0] === '!' || line[0] === '#') {
              const section = sectionLevels.find((s) => s.pattern.test(line))
              if (section) current = section.level
              continue
            }
            const parts = line.trim().split(/\s+/)
            if (parts.length < 2) continue
            const code = Number.parseInt(parts[0], 10)
            if (!Number.isFinite(code) || code <= 0) continue
            const flag = Number.parseInt(parts[1], 10)
            // 限制位 0=禁止 1=准限制 2=限制；异常值回退到段落标题推断
            const level: 1 | 2 | 3 | null =
              flag === 0 ? 1 : flag === 1 ? 2 : flag === 2 ? 3 : current
            if (!level) continue
            if (!this.limitMap.has(code)) this.limitMap.set(code, level)
          }
          loaded++
        } catch (err) {
          console.error(`[CdbService] Failed to parse lflist ${file}:`, err)
        }
      }
    }

    if (loaded > 0) {
      console.log(`[CdbService] Loaded ${this.limitMap.size} limit entries from ${loaded} file(s)`)
    }
  }

  private loadStringsConf(cdbPaths: string[]): void {
    this.setnameMap.clear()
    this.systemStringMap.clear()
    const searchDirs: string[] = []
    for (const cdbPath of cdbPaths) {
      const dir = path.dirname(cdbPath)
      searchDirs.push(dir)
      if (path.basename(dir).toLocaleLowerCase() === 'expansions')
        searchDirs.push(path.dirname(dir))
    }
    if (this.gameDirectory) searchDirs.push(this.gameDirectory)
    this.loadLflists(searchDirs)
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
            const setnameMatch = line.match(/^!setname\s+(0x[0-9a-fA-F]+|\d+)\s+([^\t\r\n]+)/)
            if (setnameMatch) {
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

  public getSetnames(setcode: number | bigint): string[] {
    if (!setcode || this.setnameMap.size === 0) return []
    const names: string[] = []
    let val = typeof setcode === 'bigint' ? setcode : BigInt(setcode)
    if (val === 0n) return []

    for (let i = 0; i < 4; i++) {
      const chunk = Number(val & 0xffffn)
      if (chunk > 0) {
        const name = this.setnameMap.get(chunk)
        if (name && !names.includes(name)) {
          names.push(name)
        } else {
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

  private openConnection(cdbPath: string): CdbConnection | null {
    try {
      if (!existsSync(cdbPath)) {
        console.error(`[CdbService] File not found: ${cdbPath}`)
        return null
      }

      const db = new Database(cdbPath, { readonly: true, fileMustExist: true })

      const probe = db
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('datas','texts')"
        )
        .get() as { n: number } | undefined
      if (!probe || probe.n < 2) {
        db.close()
        console.error(`[CdbService] Not a valid cards.cdb (missing datas/texts tables): ${cdbPath}`)
        return null
      }

      const tag = this.poolTagMap[cdbPath]
      return { path: cdbPath, db, poolId: !tag || tag === 'none' ? '' : tag }
    } catch (err) {
      console.error('[CdbService] Failed to open cdb:', err)
      return null
    }
  }

  public open(cdbPath: string, extraPaths: string[] = []): boolean {
    const primary = this.openConnection(cdbPath)
    if (!primary) return false

    this.closeConnections()
    this.connections = [primary]

    for (const extraPath of extraPaths) {
      if (extraPath === cdbPath) continue
      const conn = this.openConnection(extraPath)
      if (conn) this.connections.push(conn)
      else console.warn(`[CdbService] Skipped invalid extra cdb: ${extraPath}`)
    }

    this.currentPath = cdbPath
    this.loadStringsConf(this.connections.map((c) => c.path))
    console.log(
      `[CdbService] Loaded ${this.connections.length} database(s): ${this.connections.map((c) => c.path).join(', ')}`
    )
    return true
  }

  /**
   * 仅加载附加卡库 (不动主库)，用于设置里追加动漫卡等扩展库
   */
  public addExtra(extraPaths: string[]): string[] {
    const loaded: string[] = []
    for (const extraPath of extraPaths) {
      if (this.connections.some((c) => c.path === extraPath)) {
        loaded.push(extraPath)
        continue
      }
      const conn = this.openConnection(extraPath)
      if (!conn) continue
      this.connections.push(conn)
      loaded.push(extraPath)
    }
    this.loadStringsConf(this.connections.map((c) => c.path))
    console.log(`[CdbService] Extra cdb loaded: ${loaded.join(', ') || '(none)'}`)
    return loaded
  }

  /**
   * 重新按配置加载全部卡库，主库缺失时自动降级到第一个可用库
   */
  public reloadAll(primaryPath: string | undefined, extraPaths: string[]): void {
    this.closeConnections()
    this.currentPath = null
    if (primaryPath) {
      this.open(primaryPath, extraPaths)
      return
    }
    for (const extraPath of extraPaths) {
      const conn = this.openConnection(extraPath)
      if (!conn) continue
      this.connections = [conn]
      this.currentPath = conn.path
      this.loadStringsConf([conn.path])
      return
    }
  }

  public getCurrentPath(): string | null {
    return this.currentPath
  }

  public getLoadedPaths(): string[] {
    return this.connections.map((c) => c.path)
  }

  private applyPoolTags(cards: CdbCard[]): void {
    const poolConns = this.connections.filter((c) => c.poolId)
    if (poolConns.length === 0 || cards.length === 0) return

    const byId = new Map<number, CdbCard>()
    for (const card of cards) {
      const pools: string[] = []
      card.pools = pools
      byId.set(card.id, card)
    }
    const ids = [...byId.keys()]
    const marks = ids.map(() => '?').join(',')

    for (const conn of poolConns) {
      try {
        const rows = conn.db
          .prepare(`SELECT id FROM datas WHERE id IN (${marks})`)
          .all(...ids) as Array<{ id: number }>
        for (const row of rows) {
          const card = byId.get(row.id)
          if (card?.pools && !card.pools.includes(conn.poolId)) card.pools.push(conn.poolId)
        }
      } catch (err) {
        console.error(`[CdbService] Pool tag query error on ${conn.path}:`, err)
      }
    }

    for (const card of cards) {
      if (card.pools && card.pools.length === 0) delete card.pools
    }
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
    return this.connections.length > 0
  }

  public search(params: CardSearchParams): CardSearchResult {
    if (this.connections.length === 0) return { cards: [], total: 0 }

    const limit = params.limit || 50
    const offset = params.offset || 0
    const perDbLimit = offset + limit

    let total = 0
    const collected: CdbCard[] = []
    const seen = new Set<number>()

    for (const conn of this.connections) {
      const result = this.searchOne(conn.db, params, perDbLimit)
      total += result.total
      for (const card of result.cards) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        collected.push(card)
      }
    }

    collected.sort(compareCards(params))

    for (const card of collected) {
      if (card.setcode) {
        const setnames = this.getSetnames(card.setcode)
        if (setnames.length > 0) card.setnames = setnames
      }
      if ((card.type & CardType.LINK) !== 0 && card.def > 0 && card.def <= 0xff) {
        card.markers = card.def
      }
      const limit = this.limitMap.get(card.id)
      if (limit) card.limit = limit
    }
    this.applyPoolTags(collected)

    return { cards: collected.slice(offset, offset + limit), total }
  }

  private searchOne(
    db: Database.Database,
    params: CardSearchParams,
    fetchLimit: number
  ): CardSearchResult {
    let baseWhere =
      ' FROM datas d JOIN texts t ON d.id = t.id WHERE 1=1' +
      " AND t.name NOT LIKE '%占位符%'" +
      ' AND NOT (' +
      ' (d.type & 7) = 0 AND d.atk = 0 AND d.def = 0 AND (d.level & 255) = 0' +
      " AND (t.desc IS NULL OR trim(t.desc) = ''" +
      " OR t.desc LIKE '%战斗包%' OR t.desc LIKE '%Battle Pack%'" +
      " OR t.desc LIKE '%列表%' OR t.desc LIKE '%常见%' OR t.desc LIKE '%Common%')" +
      ' )'
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

    if (params.code !== undefined && params.code > 0) {
      baseWhere += ' AND d.id = ?'
      args.push(params.code)
    }

    if (params.type !== undefined && params.type !== 0) {
      baseWhere += ' AND (d.type & ?) != 0'
      args.push(params.type)
    }

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

    // 禁限来自 lflists 文本 (卡库中没有该列)，把该等级的卡密展开为 IN 条件以保证分页与总数准确
    if (params.limitFilter) {
      const codes: number[] = []
      for (const [code, level] of this.limitMap) {
        if (level === params.limitFilter) codes.push(code)
      }
      if (codes.length === 0) {
        baseWhere += ' AND 0=1'
      } else {
        baseWhere += ` AND d.id IN (${codes.map(() => '?').join(',')})`
        args.push(...codes)
      }
    }

    // 连接标记：方向存放在 Link 怪兽的 def 字段里（卡库无 link_marker 列）
    // 与 YGOPro 一致用 AND 语义：卡片必须同时具备全部选中的方向
    if (params.markers !== undefined && params.markers !== 0) {
      baseWhere += ' AND (d.type & ?) != 0 AND (d.def & ?) = ?'
      args.push(CardType.LINK, params.markers, params.markers)
    }

    try {
      const countSql = `SELECT count(*) as total` + baseWhere
      const countRow = db.prepare(countSql).get(...args) as { total: number } | undefined
      const total = countRow?.total ?? 0

      const orderDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC'
      let orderBy = 'd.id'
      if (params.sortField === 'atk') orderBy = 'd.atk'
      else if (params.sortField === 'def') orderBy = 'd.def'
      else if (params.sortField === 'level') orderBy = '(d.level & 255)'
      else if (params.sortField === 'name') orderBy = 't.name'
      else {
        orderBy = `
          (d.type & 7) ${orderDir === 'ASC' ? 'DESC' : 'ASC'},
          CASE WHEN (d.type & 7) = 1 THEN
            CASE WHEN (d.type & 0x48020c0) != 0 THEN (d.type & 0x48020c1) ELSE (d.type & 0x31) END
          ELSE (d.type & 4294967288) END ${orderDir === 'ASC' ? 'DESC' : 'ASC'},
          CASE WHEN (d.type & 7) = 1 THEN (d.level & 255) ELSE 0 END ${orderDir},
          CASE WHEN (d.type & 7) = 1 THEN d.atk ELSE 0 END ${orderDir},
          CASE WHEN (d.type & 7) = 1 THEN d.def ELSE 0 END ${orderDir},
          d.id ${orderDir === 'ASC' ? 'DESC' : 'ASC'}`
      }

      const dataSql = `
        SELECT
          d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
          t.name, t.desc
        ${baseWhere}
        ORDER BY ${orderBy}
        LIMIT ?
      `
      const rows = db.prepare(dataSql).all(...args, fetchLimit) as CdbCard[]

      return { cards: rows, total }
    } catch (err) {
      console.error('[CdbService] Search error:', err)
      return { cards: [], total: 0 }
    }
  }

  public getCardsByIds(ids: number[]): Record<number, CdbCard> {
    if (this.connections.length === 0 || ids.length === 0) return {}

    const placeholders = ids.map(() => '?').join(',')
    const sql = `
      SELECT
        d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
        t.name, t.desc
      FROM datas d
      JOIN texts t ON d.id = t.id
      WHERE d.id IN (${placeholders})
    `

    const result: Record<number, CdbCard> = {}
    for (const conn of this.connections) {
      try {
        const rows = conn.db.prepare(sql).all(...ids) as CdbCard[]
        for (const card of rows) {
          if (result[card.id]) continue
          if (card.setcode) {
            const sn = this.getSetnames(card.setcode)
            if (sn.length > 0) card.setnames = sn
          }
          if ((card.type & CardType.LINK) !== 0 && card.def > 0 && card.def <= 0xff) {
            card.markers = card.def
          }
          const lv = this.limitMap.get(card.id)
          if (lv) card.limit = lv
          result[card.id] = card
        }
      } catch (err) {
        console.error(`[CdbService] getCardsByIds error on ${conn.path}:`, err)
      }
    }
    this.applyPoolTags(Object.values(result))
    return result
  }

  public getCardById(id: number): CdbCard | null {
    const map = this.getCardsByIds([id])
    return map[id] ?? null
  }

  public getAliasGroupIds(id: number): number[] {
    if (this.connections.length === 0) return [id]
    const ids = new Set<number>([id])
    try {
      for (const conn of this.connections) {
        const rows = conn.db
          .prepare('SELECT id FROM datas WHERE id = ? OR alias = ?')
          .all(id, id) as Array<{ id: number }>
        for (const row of rows) ids.add(row.id)
      }
    } catch (err) {
      console.error('[CdbService] getAliasGroupIds error:', err)
    }
    ids.delete(id)
    return [id, ...ids]
  }

  private closeConnections(): void {
    for (const conn of this.connections) {
      try {
        conn.db.close()
      } catch (err) {
        console.error(`[CdbService] Failed to close ${conn.path}:`, err)
      }
    }
    this.connections = []
  }

  public close(): void {
    this.closeConnections()
    this.currentPath = null
  }
}

export const cdbService = new CdbService()
