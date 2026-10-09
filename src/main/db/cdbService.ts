import Database from 'better-sqlite3'
import {
  CARD_POOL_OT_MASKS,
  CdbCard,
  CdbLibraryRole,
  CardType,
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  NumericCompareOp,
  cardPoolIdsFromOt,
  cardPoolOtMask
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

export function parseSearchTokens(input: string): SearchToken[] {
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

type MonsterSortStep = 'sub' | 'level' | 'atk' | 'def'

function deckSortComparator(
  params: CardSearchParams,
  monsterSteps: MonsterSortStep[]
): (a: CdbCard, b: CdbCard) => number {
  const keyDir = params.sortOrder === 'ASC' ? 1 : -1
  const groupDir = -keyDir
  const stepValue = (card: CdbCard, step: MonsterSortStep): number => {
    if (step === 'sub') return subtypeOrder(card.type)
    if (step === 'level') return (card.level ?? 0) & 255
    if (step === 'atk') return card.atk ?? 0
    return card.def ?? 0
  }
  return (a, b) => {
    const at = a.type & 0x7
    const bt = b.type & 0x7
    if (at !== bt) return (at - bt) * groupDir
    if (at !== CardType.MONSTER) {
      const ar = a.type & ~0x7
      const br = b.type & ~0x7
      if (ar !== br) return (ar - br) * groupDir
      return (a.id ?? 0) - (b.id ?? 0)
    }
    for (const step of monsterSteps) {
      const av = stepValue(a, step)
      const bv = stepValue(b, step)
      if (av !== bv) return (av - bv) * keyDir
    }
    return (a.id ?? 0) - (b.id ?? 0)
  }
}

export function compareCards(params: CardSearchParams): (a: CdbCard, b: CdbCard) => number {
  const dir = params.sortOrder === 'ASC' ? 1 : -1
  switch (params.sortField) {
    case 'atk':
      return deckSortComparator(params, ['atk', 'def', 'level', 'sub'])
    case 'def':
      return deckSortComparator(params, ['def', 'atk', 'level', 'sub'])
    case 'name':
      return (a, b) => {
        const res = String(a.name ?? '').localeCompare(String(b.name ?? ''))
        if (res !== 0) return res * dir
        return (a.id ?? 0) - (b.id ?? 0)
      }
    default:
      return deckSortComparator(params, ['sub', 'level', 'atk', 'def'])
  }
}

interface CdbConnection {
  path: string
  db: Database.Database
  role: CdbLibraryRole
  /** 该连接上已 ATTACH 的文本库别名，供文本覆盖用（仅数据连接有值） */
  overlayAliases: string[]
  /** 该连接的 __covered 临时表是否已就绪 */
  coveredReady: boolean
}

/** 卡密有该比例以上已被其它库覆盖时，自动判定为文本库（语言包） */
const AUTO_TEXT_OVERLAP_RATIO = 0.9

export class CdbService {
  private connections: CdbConnection[] = []
  private currentPath: string | null = null
  private setnameMap: Map<number, string> = new Map()
  private systemStringMap: Map<number, string> = new Map()
  private limitMap: Map<number, 1 | 2 | 3> = new Map()
  private gameDirectory: string | undefined

  private readIdSet(db: Database.Database): Set<number> {
    const ids = new Set<number>()
    try {
      for (const row of db.prepare('SELECT id FROM datas').iterate() as Iterable<{ id: number }>) {
        ids.add(row.id)
      }
    } catch (err) {
      console.error('[CdbService] Failed to read card ids:', err)
    }
    return ids
  }

  private writeCoveredIds(conn: CdbConnection, ids: Set<number>): void {
    try {
      conn.db.exec('DROP TABLE IF EXISTS temp.__covered')
      conn.db.exec('CREATE TEMP TABLE __covered(id INTEGER PRIMARY KEY)')
      const stmt = conn.db.prepare('INSERT OR IGNORE INTO __covered(id) VALUES (?)')
      const insertAll = conn.db.transaction((list: number[]) => {
        for (const id of list) stmt.run(id)
      })
      insertAll([...ids])
      conn.coveredReady = true
    } catch (err) {
      console.error('[CdbService] Failed to build covered-id table:', err)
    }
  }

  /**
   * 计算各库角色、把文本库排到最后，并把文本库 ATTACH 到数据连接上做文本覆盖。
   * 文本库只提供卡名与效果文；卡密在数据连接里完全找不到时才回退用文本库自己的 datas。
   */
  private finalizeConnections(): void {
    if (this.connections.length === 0) return

    for (const conn of this.connections) {
      for (const alias of conn.overlayAliases) {
        try {
          conn.db.exec(`DETACH DATABASE ${alias}`)
        } catch {
          /* 连接已关闭时忽略 */
        }
      }
      conn.overlayAliases = []
      conn.coveredReady = false
    }

    const idSets = new Map<string, Set<number>>()
    for (const conn of this.connections) idSets.set(conn.path, this.readIdSet(conn.db))

    const othersUnion = new Map<string, Set<number>>()
    for (const conn of this.connections) {
      const union = new Set<number>()
      for (const other of this.connections) {
        if (other === conn) continue
        for (const id of idSets.get(other.path) ?? []) union.add(id)
      }
      othersUnion.set(conn.path, union)
    }

    this.connections.forEach((conn, index) => {
      if (index === 0) {
        conn.role = 'data'
        return
      }
      const own = idSets.get(conn.path) ?? new Set<number>()
      const covered = othersUnion.get(conn.path) ?? new Set<number>()
      let hit = 0
      for (const id of own) if (covered.has(id)) hit++
      conn.role = own.size > 0 && hit / own.size >= AUTO_TEXT_OVERLAP_RATIO ? 'text' : 'data'
    })

    const dataConns = this.connections.filter((conn) => conn.role === 'data')
    const textConns = this.connections.filter((conn) => conn.role === 'text')
    this.connections = [...dataConns, ...textConns]

    textConns.forEach((textConn, index) => {
      const alias = `ov${index}`
      const literal = textConn.path.replace(/'/g, "''")
      for (const conn of dataConns) {
        try {
          conn.db.exec(`ATTACH DATABASE '${literal}' AS ${alias}`)
          conn.overlayAliases.push(alias)
        } catch (err) {
          console.error(`[CdbService] Failed to attach text library ${textConn.path}:`, err)
        }
      }
    })

    // 每个库都排除「前面已加载的库」已有的卡密，保证同一个卡密只由第一个命中的库提供
    const coveredSoFar = new Set<number>()
    for (const conn of this.connections) {
      if (coveredSoFar.size > 0) this.writeCoveredIds(conn, coveredSoFar)
      for (const id of idSets.get(conn.path) ?? []) coveredSoFar.add(id)
    }

    console.log(
      `[CdbService] Library roles: ${this.connections
        .map((conn) => `${path.basename(conn.path)}=${conn.role}`)
        .join(', ')}`
    )
  }

  /** 卡库加载后需要重新探测 lflists 的目录（游戏根目录未必与 cdb 同级） */
  /** 游戏目录与各卡库可能存放 strings.conf / lflists 的候选目录（含 cdb 的父目录，兼容 EDOPro 根目录结构） */
  private collectConfigDirs(cdbPaths: string[]): string[] {
    const dirs: string[] = []
    for (const cdbPath of cdbPaths) {
      const dir = path.dirname(cdbPath)
      dirs.push(dir, path.dirname(dir))
    }
    if (this.gameDirectory) dirs.push(this.gameDirectory)
    return [...new Set(dirs.filter((d) => d && d.length > 0))]
  }

  public setGameDirectory(gameDirectory: string | undefined): void {
    this.gameDirectory = gameDirectory
    if (!gameDirectory || this.connections.length === 0) return
    this.loadLflists(this.collectConfigDirs(this.connections.map((c) => c.path)))
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
    const searchDirs = this.collectConfigDirs(cdbPaths)
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
              if (!isNaN(id) && label) this.systemStringMap.set(id, label)
            }
          }
          console.log(
            `[CdbService] Loaded ${this.setnameMap.size} setnames and ${this.systemStringMap.size} system strings from ${p}`
          )
        } catch (err) {
          console.error(`[CdbService] Failed to parse ${p}:`, err)
        }
      }
    }
  }

  public getEffectDescription(descCode: number, defaultCode?: number): string {
    if (descCode <= 10000) {
      const sys = this.systemStringMap.get(descCode)
      if (sys) return sys
      return '发动效果'
    }
    const cardCode = (descCode >> 4) & 0x0fffffff
    const offset = descCode & 0xf
    const strIndex = offset + 1
    const targetCode = cardCode || defaultCode
    if (targetCode) {
      for (const conn of this.connections) {
        try {
          const row = conn.db
            .prepare(`SELECT str${strIndex} as str FROM texts WHERE id = ?`)
            .get(targetCode) as { str?: string } | undefined
          if (row?.str && row.str.trim()) {
            return row.str.trim()
          }
        } catch (err) {
          void err
        }
      }
      const card = this.getCardById(targetCode)
      if (card?.desc) {
        const lines = card.desc
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        const prefix = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][offset]
        if (prefix) {
          const found = lines.find((l) => l.startsWith(prefix))
          if (found) return found
        }
      }
    }
    return `效果 (${offset + 1})`
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

      return { path: cdbPath, db, role: 'data', overlayAliases: [], coveredReady: false }
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
    this.finalizeConnections()
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
    this.finalizeConnections()
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
      this.finalizeConnections()
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

  /** 附加库卡池：按卡片 ot 的扩展池位判定（与 EDOPro 一致），与卡库无关 */
  private applyCardPools(cards: CdbCard[]): void {
    for (const card of cards) {
      const pools = cardPoolIdsFromOt(card.ot)
      if (pools.length > 0) card.pools = pools
      else delete card.pools
    }
  }

  private hasPoolMask(db: Database.Database, mask: number): boolean {
    try {
      const row = db.prepare('SELECT 1 FROM datas WHERE (ot & ?) != 0 LIMIT 1').get(mask)
      return row !== undefined
    } catch (err) {
      console.error('[CdbService] Pool mask probe error:', err)
      return false
    }
  }

  public getSearchFilterOptions(): CardSearchFilterOptions {
    const effectCategories: CardSearchFilterOptions['effectCategories'] = []
    for (let index = 0; index < 32; index++) {
      const label = this.systemStringMap.get(1100 + index)
      if (label) effectCategories.push({ mask: 2 ** index, label })
    }
    const availablePools: string[] = []
    for (const pool of CARD_POOL_OT_MASKS) {
      if (this.connections.some((conn) => this.hasPoolMask(conn.db, pool.mask))) {
        availablePools.push(pool.id)
      }
    }
    return { effectCategories, availablePools }
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
    let collected: CdbCard[] = []
    const seen = new Set<number>()

    for (const conn of this.connections) {
      const result = this.searchOne(conn, params, perDbLimit)
      total += result.total
      for (const card of result.cards) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        collected.push(card)
      }
    }

    const keyword = (params.keyword ?? '').trim()
    if (keyword.length > 0) {
      const exact: CdbCard[] = []
      const rest: CdbCard[] = []
      for (const card of collected) {
        if (card.name === keyword) exact.push(card)
        else rest.push(card)
      }
      exact.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      rest.sort(compareCards(params))
      collected = [...exact, ...rest]
    } else {
      collected.sort(compareCards(params))
    }

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
    this.applyCardPools(collected)

    return { cards: collected.slice(offset, offset + limit), total }
  }

  /** 文本字段的取值表达式与文本覆盖表的 JOIN 片段（无覆盖库时退化为 t.<列>） */
  private textSource(conn: CdbConnection): {
    pick: (column: string) => string
    join: string
  } {
    const overlays = conn.overlayAliases
    return {
      pick: (column) =>
        overlays.length > 0
          ? `COALESCE(${[...overlays.map((alias) => `${alias}.${column}`), `t.${column}`].join(', ')})`
          : `t.${column}`,
      join: overlays
        .map((alias) => ` LEFT JOIN ${alias}.texts ${alias} ON ${alias}.id = d.id`)
        .join('')
    }
  }

  private searchOne(
    conn: CdbConnection,
    params: CardSearchParams,
    fetchLimit: number
  ): CardSearchResult {
    const db = conn.db
    const { pick, join: overlayJoin } = this.textSource(conn)
    const nameExpr = pick('name')
    const descExpr = pick('desc')

    let baseWhere =
      ` FROM datas d JOIN texts t ON d.id = t.id${overlayJoin} WHERE 1=1` +
      ' AND (d.type & 16384) = 0' +
      ` AND ${nameExpr} NOT LIKE '%占位符%'` +
      ' AND NOT (' +
      ' (d.type & 7) = 0 AND d.atk = 0 AND d.def = 0 AND (d.level & 255) = 0' +
      ` AND (${descExpr} IS NULL OR trim(${descExpr}) = ''` +
      ` OR ${descExpr} LIKE '%战斗包%' OR ${descExpr} LIKE '%Battle Pack%'` +
      ` OR ${descExpr} LIKE '%列表%' OR ${descExpr} LIKE '%常见%' OR ${descExpr} LIKE '%Common%')` +
      ' )'
    // 只补充前面各库都没有的卡密，避免同一张卡被多个库重复计数
    if (conn.coveredReady) {
      baseWhere += ' AND d.id NOT IN (SELECT id FROM __covered)'
    }
    const args: (string | number)[] = []
    const relevanceArgs: (string | number)[] = []
    const relevanceTokens: string[] = []

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
        baseWhere += ` AND (d.id = ? OR ${nameExpr} LIKE ?)`
        args.push(parseInt(keyword, 10), `%${keyword}%`)
        relevanceTokens.push(keyword)
      } else {
        for (const token of parseSearchTokens(keyword)) {
          const clauses: string[] = []
          const like = `%${token.text}%`
          if (token.mode !== 'set') {
            clauses.push(`${nameExpr} LIKE ?`)
            args.push(like)
          }
          if (token.mode === 'any' && params.searchDesc !== false) {
            clauses.push(`${descExpr} LIKE ?`)
            args.push(like)
          }
          if (token.mode !== 'name') {
            const setcodes = this.getSetcodesForKeyword(token.text)
            if (setcodes.length > 0) clauses.push(getSetcodeClause(setcodes))
            else if (token.mode === 'set') clauses.push('0=1')
          }
          if (clauses.length === 0) continue
          if (!token.excluded) relevanceTokens.push(token.text)
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

    // ocg/tcg 判「可用」，ocgOnly/tcgOnly 判「独有」，anime/rush/tf 按 ot 池位判定
    const poolMask = cardPoolOtMask(params.cardPool)
    if (params.cardPool === 'ocg') baseWhere += ' AND (d.ot & 1) != 0'
    else if (params.cardPool === 'tcg') baseWhere += ' AND (d.ot & 2) != 0'
    else if (params.cardPool === 'ocgOnly') baseWhere += ' AND (d.ot & 1) != 0 AND (d.ot & 2) = 0'
    else if (params.cardPool === 'tcgOnly') baseWhere += ' AND (d.ot & 2) != 0 AND (d.ot & 1) = 0'
    else if (poolMask !== undefined) {
      baseWhere += ' AND (d.ot & ?) != 0'
      args.push(poolMask)
    }

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
      const groupDir = orderDir === 'ASC' ? 'DESC' : 'ASC'
      const monsterKey = (column: string): string =>
        `CASE WHEN (d.type & 7) = 1 THEN ${column} ELSE 0 END ${orderDir}`
      const typeGroupSql = `(d.type & 7) ${groupDir}`
      const subtypeSql =
        `CASE WHEN (d.type & 7) = 1 THEN` +
        ` CASE WHEN (d.type & 0x48020c0) != 0 THEN (d.type & 0x48020c1) ELSE (d.type & 0x31) END` +
        ` ELSE (d.type & 4294967288) END ${groupDir}`
      const levelKeySql = monsterKey('(d.level & 255)')
      const atkKeySql = monsterKey('d.atk')
      const defKeySql = monsterKey('d.def')
      const idTailSql = `d.id ${groupDir}`
      let orderBy: string
      if (params.sortField === 'atk') {
        orderBy = [typeGroupSql, atkKeySql, defKeySql, levelKeySql, subtypeSql, idTailSql].join(
          ', '
        )
      } else if (params.sortField === 'def') {
        orderBy = [typeGroupSql, defKeySql, atkKeySql, levelKeySql, subtypeSql, idTailSql].join(
          ', '
        )
      } else if (params.sortField === 'name') {
        orderBy = `${nameExpr} ${orderDir}, d.id ASC`
      } else {
        orderBy = [typeGroupSql, subtypeSql, levelKeySql, atkKeySql, defKeySql, idTailSql].join(
          ', '
        )
      }

      if (relevanceTokens.length > 0) {
        const cases = relevanceTokens.map((text) => {
          relevanceArgs.push(text, `${text}%`, `%${text}%`)
          return `CASE WHEN ${nameExpr} = ? THEN 0 WHEN ${nameExpr} LIKE ? THEN 1 WHEN ${nameExpr} LIKE ? THEN 2 ELSE 3 END`
        })
        const relevance = cases.length === 1 ? cases[0] : `MAX(${cases.join(', ')})`
        orderBy = `${relevance}, ${orderBy}`
      }

      const dataSql = `
        SELECT
          d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
          ${nameExpr} AS name, ${descExpr} AS desc
        ${baseWhere}
        ORDER BY ${orderBy}
        LIMIT ?
      `
      const rows = db.prepare(dataSql).all(...args, ...relevanceArgs, fetchLimit) as CdbCard[]

      return { cards: rows, total }
    } catch (err) {
      console.error('[CdbService] Search error:', err)
      return { cards: [], total: 0 }
    }
  }

  public getCardsByIds(ids: number[]): Record<number, CdbCard> {
    if (this.connections.length === 0 || ids.length === 0) return {}

    const placeholders = ids.map(() => '?').join(',')

    const result: Record<number, CdbCard> = {}
    for (const conn of this.connections) {
      try {
        const { pick, join } = this.textSource(conn)
        const sql = `
          SELECT
            d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
            ${pick('name')} AS name, ${pick('desc')} AS desc
          FROM datas d
          JOIN texts t ON d.id = t.id${join}
          WHERE d.id IN (${placeholders})
        `
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
    this.applyCardPools(Object.values(result))
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
