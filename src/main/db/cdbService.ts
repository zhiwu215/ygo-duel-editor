import {
  CdbCard,
  CardPoolSchema,
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  CardType,
  CdbLibraryInfo,
  cardPoolIdsFromOt,
  cardScopeBadge,
  cardScopeText,
  isArtworkVariant,
  officialOtMask,
  searchPoolOption
} from '@shared/index'
import { CdbConnection, CdbConnections } from './cdbConnections'
import { buildSearchSql, textSource } from './cdbSearchSql'
import { sortCards, stripSortKeys, CardSortRow } from './cardSort'
import { loadLfLists, LfList, selectActiveLimitList } from './lflistParser'
import { readSystemConf } from './systemConfParser'
import { collectConfigDirs, loadCdbStringsConf } from './stringsConfParser'
import { splitSetcode } from './setcode'

const KCG_POOL_STRING_IDS = [1265, 1266, 1267, 1268, 1900, 1901, 1902, 1903, 1906, 1910, 1911, 1912]
const CLASSIC_POOL_STRING_IDS = [1481, 1482, 1483, 1484, 1485, 1487, 1488]
const KCG_EXTENDED_OT_MASK = 0x10 | 0x40 | 0x200 | 0x400 | 0x2000
const HAN_NAME = /\p{Script=Han}/u
const INITIAL_SEARCH_WINDOW = 400

export interface SearchExtraRows {
  rows: CardSortRow[]
  total: number
  revision?: number
}

interface SearchCacheEntry {
  key: string
  rows: CardSortRow[]
  total: number
  window: number
}

export class CdbService {
  private connections = new CdbConnections((paths, languagePaths) =>
    this.loadStringsConf(paths, languagePaths)
  )
  private setnameMap: Map<number, string> = new Map()
  private systemStringMap: Map<number, string> = new Map()
  private limitMap: Map<number, 1 | 2 | 3> = new Map()
  private gameDirectory: string | undefined
  private poolSchema: CardPoolSchema | null = null
  private lfLists: LfList[] = []
  private clientBanlist: string | null = null
  private preferredBanlist: string | undefined
  private activeBanlist: string | null = null
  private searchCache: SearchCacheEntry | null = null

  public invalidateSearchCache(): void {
    this.searchCache = null
  }

  public setGameDirectory(gameDirectory: string | undefined): void {
    this.gameDirectory = gameDirectory
    this.poolSchema = null
    this.invalidateSearchCache()
    if (!gameDirectory || this.connections.list().length === 0) return
    this.reloadLimitMap(
      collectConfigDirs(
        this.connections.searchableList().map((c) => c.path),
        [],
        this.gameDirectory
      )
    )
  }

  public setPreferredBanlist(name: string | undefined): void {
    this.preferredBanlist = name
    this.invalidateSearchCache()
    this.applyActiveBanlist()
  }

  private reloadLimitMap(searchDirs: string[]): void {
    this.lfLists = loadLfLists(searchDirs)
    this.clientBanlist =
      selectActiveLimitList(this.lfLists, readSystemConf(searchDirs))?.name ?? null
    this.applyActiveBanlist()
  }

  private applyActiveBanlist(): void {
    const byName = (name: string | null | undefined): LfList | undefined =>
      name ? this.lfLists.find((list) => list.name === name) : undefined
    const active =
      byName(this.preferredBanlist) ??
      byName(this.clientBanlist) ??
      this.lfLists[this.lfLists.length - 1] ??
      null
    this.activeBanlist = active?.name ?? null
    this.limitMap = active?.content ?? new Map()
    console.log(
      `[CdbService] LFList: ${this.activeBanlist ?? 'none'} (${this.limitMap.size} entries)`
    )
  }

  private ensurePoolSchema(): CardPoolSchema {
    if (this.poolSchema) return this.poolSchema
    const kcgStringCount = KCG_POOL_STRING_IDS.filter((id) => this.systemStringMap.has(id)).length
    if (kcgStringCount >= 2) {
      this.poolSchema = 'kcg'
      console.log('[CdbService] Card pool schema: kcg (strings.conf)')
      return this.poolSchema
    }
    const classicStringCount = CLASSIC_POOL_STRING_IDS.filter((id) =>
      this.systemStringMap.has(id)
    ).length
    if (classicStringCount >= 2) {
      this.poolSchema = 'classic'
      console.log('[CdbService] Card pool schema: classic (strings.conf)')
      return this.poolSchema
    }
    const extended = this.connections.searchableList().some((conn) => {
      try {
        const row = conn.db
          .prepare(`SELECT 1 FROM datas WHERE (ot & ${KCG_EXTENDED_OT_MASK}) != 0 LIMIT 1`)
          .get()
        return row !== undefined
      } catch (err) {
        console.error('[CdbService] Pool schema probe error:', err)
        return false
      }
    })
    this.poolSchema = extended ? 'kcg' : 'classic'
    console.log(`[CdbService] Card pool schema: ${this.poolSchema}`)
    return this.poolSchema
  }

  private loadStringsConf(cdbPaths: string[], languageDirs: string[] = []): void {
    const searchDirs = collectConfigDirs(cdbPaths, languageDirs, this.gameDirectory)
    this.reloadLimitMap(searchDirs)
    const conf = loadCdbStringsConf(searchDirs)
    this.setnameMap = conf.setnameMap
    this.systemStringMap = conf.systemStringMap
    this.poolSchema = null
    this.invalidateSearchCache()
  }

  public getSetnames(setcode: number | bigint): string[] {
    if (!setcode || this.setnameMap.size === 0) return []
    const names: string[] = []
    for (const chunk of splitSetcode(setcode)) {
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
    return names
  }

  public open(
    cdbPath: string,
    bundledPaths: string[] = [],
    extraPaths: string[] = [],
    languagePack: { id: string; dir?: string; cdbPaths: string[] } | null = null
  ): boolean {
    this.invalidateSearchCache()
    return this.connections.open(cdbPath, bundledPaths, extraPaths, languagePack)
  }

  public addExtra(extraPaths: string[]): string[] {
    this.invalidateSearchCache()
    return this.connections.addExtra(extraPaths)
  }

  public reloadAll(
    primaryPath: string | undefined,
    bundledPaths: string[],
    extraPaths: string[],
    languagePack: { id: string; dir?: string; cdbPaths: string[] } | null = null
  ): void {
    this.invalidateSearchCache()
    this.connections.reloadAll(primaryPath, bundledPaths, extraPaths, languagePack)
  }

  public getCurrentPath(): string | null {
    return this.connections.getCurrentPath()
  }

  public getLoadedPaths(): string[] {
    return this.connections.getLoadedPaths()
  }

  public listLibraries(): CdbLibraryInfo[] {
    return this.connections.listLibraries()
  }

  private applyCardPools(cards: CdbCard[]): void {
    const schema = this.ensurePoolSchema()
    for (const card of cards) {
      const pools = cardPoolIdsFromOt(card.ot, schema)
      if (pools.length > 0) card.pools = pools
      else delete card.pools
      const scopeBadge = cardScopeBadge(card.ot, schema)
      if (scopeBadge) card.scopeBadge = scopeBadge
      else delete card.scopeBadge
      const scopeText = cardScopeText(card.ot, schema)
      if (scopeText) card.scopeText = scopeText
      else delete card.scopeText
    }
  }

  private applyArtworkNames(cards: CdbCard[]): void {
    const nameById = new Map(cards.map((card) => [card.id, card.name]))
    const missing = new Set<number>()
    for (const card of cards) {
      if (HAN_NAME.test(card.name) || !isArtworkVariant(card.id, card.alias)) continue
      if (!nameById.has(card.alias)) missing.add(card.alias)
    }
    if (missing.size > 0) {
      const placeholders = Array.from(missing, () => '?').join(',')
      for (const conn of this.connections.searchableList()) {
        try {
          const { pick, join } = textSource(conn)
          const rows = conn.db
            .prepare(
              `SELECT d.id, ${pick('name')} AS name FROM datas d JOIN texts t ON d.id = t.id${join} WHERE d.id IN (${placeholders})`
            )
            .all(...missing) as Array<{ id: number; name: string }>
          for (const row of rows) {
            if (!nameById.has(row.id)) nameById.set(row.id, row.name)
          }
        } catch (err) {
          console.error('[CdbService] Artwork name lookup error:', err)
        }
      }
    }
    for (const card of cards) {
      if (HAN_NAME.test(card.name) || !isArtworkVariant(card.id, card.alias)) continue
      const baseName = nameById.get(card.alias)
      if (baseName && HAN_NAME.test(baseName)) card.name = baseName
    }
  }

  public getSearchFilterOptions(): CardSearchFilterOptions {
    const effectCategories: CardSearchFilterOptions['effectCategories'] = []
    for (let index = 0; index < 32; index++) {
      const label = this.systemStringMap.get(1100 + index)
      if (label) effectCategories.push({ mask: 2 ** index, label })
    }
    return {
      effectCategories,
      poolSchema: this.ensurePoolSchema(),
      banlists: this.lfLists.map((list) => list.name),
      banlist: this.activeBanlist
    }
  }

  public isReady(): boolean {
    return this.connections.list().length > 0
  }

  public search(
    params: CardSearchParams,
    favorites?: number[],
    extra?: SearchExtraRows
  ): CardSearchResult {
    const connections = this.connections.searchableList()
    if (connections.length === 0 && (extra?.rows.length ?? 0) === 0) return { cards: [], total: 0 }

    if (params.onlyFavorites && (!favorites || favorites.length === 0)) {
      return { cards: [], total: 0 }
    }

    const limit = params.limit || 50
    const offset = params.offset || 0
    const key = this.searchCacheKey(params, favorites, extra)
    const cached = this.searchCache
    const reusable = cached !== null && cached.key === key

    if (!reusable || cached.window < offset + limit) {
      const window = reusable
        ? Math.max(offset + limit, cached.window * 2)
        : Math.max(offset + limit, INITIAL_SEARCH_WINDOW)
      this.searchCache = this.collectSearchRows(key, params, favorites, extra, window, connections)
    }

    const entry = this.searchCache
    if (!entry) return { cards: [], total: 0 }

    const page = entry.rows.slice(offset, offset + limit).map((row) => {
      const card: CdbCard = { ...row }
      stripSortKeys(card)
      return card
    })

    return { cards: page, total: entry.total }
  }

  private searchCacheKey(
    params: CardSearchParams,
    favorites: number[] | undefined,
    extra: SearchExtraRows | undefined
  ): string {
    const filters: CardSearchParams = { ...params }
    delete filters.limit
    delete filters.offset
    return JSON.stringify([
      filters,
      favorites ?? null,
      this.connections.getLoadedPaths(),
      this.ensurePoolSchema(),
      this.activeBanlist,
      extra?.revision ?? 0
    ])
  }

  private collectSearchRows(
    key: string,
    params: CardSearchParams,
    favorites: number[] | undefined,
    extra: SearchExtraRows | undefined,
    fetchLimit: number,
    connections: CdbConnection[]
  ): SearchCacheEntry {
    let total = 0
    const collected: CardSortRow[] = []
    const seen = new Set<number>()

    for (const conn of connections) {
      const result = this.searchOne(conn, params, fetchLimit, favorites)
      total += result.total
      for (const card of result.cards) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        collected.push(card as CardSortRow)
      }
    }

    for (const row of extra?.rows ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      collected.push(row)
    }

    this.applyArtworkNames(collected)
    const rows = sortCards(collected, params) as CardSortRow[]

    for (const card of rows) {
      if (card.setcode) {
        const setnames = this.getSetnames(card.setcode)
        if (setnames.length > 0) card.setnames = setnames
      }
      if ((card.type & CardType.LINK) !== 0 && card.def > 0) {
        card.markers = card.def
      }
      const limit = this.limitMap.get(card.alias || card.id) ?? this.limitMap.get(card.id)
      if (limit) card.limit = limit
    }
    this.applyCardPools(rows)

    return { key, rows, total: total + (extra?.total ?? 0), window: fetchLimit }
  }

  private searchOne(
    conn: CdbConnection,
    params: CardSearchParams,
    fetchLimit: number,
    favorites?: number[]
  ): CardSearchResult {
    const db = conn.db
    try {
      const schema = this.ensurePoolSchema()
      const pool = searchPoolOption(params.cardPool, schema)
      const plan = buildSearchSql(
        conn,
        params,
        fetchLimit,
        this.setnameMap,
        this.limitMap,
        pool,
        officialOtMask(schema),
        schema === 'kcg',
        favorites
      )
      const countRow = db.prepare(plan.countSql).get(...plan.args) as { total: number } | undefined
      const total = countRow?.total ?? 0

      const rows = db.prepare(plan.dataSql).all(...plan.dataArgs, plan.fetchLimit) as CdbCard[]

      return { cards: rows, total }
    } catch (err) {
      console.error('[CdbService] Search error:', err)
      return { cards: [], total: 0 }
    }
  }

  public getCardsByIds(ids: number[]): Record<number, CdbCard> {
    const connections = this.connections.searchableList()
    if (connections.length === 0 || ids.length === 0) return {}

    const placeholders = ids.map(() => '?').join(',')

    const result: Record<number, CdbCard> = {}
    for (const conn of connections) {
      try {
        const { pick, join } = textSource(conn)
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
          if ((card.type & CardType.LINK) !== 0 && card.def > 0) {
            card.markers = card.def
          }
          const lv = this.limitMap.get(card.alias || card.id) ?? this.limitMap.get(card.id)
          if (lv) card.limit = lv
          result[card.id] = card
        }
      } catch (err) {
        console.error(`[CdbService] getCardsByIds error on ${conn.path}:`, err)
      }
    }
    const cards = Object.values(result)
    this.applyCardPools(cards)
    this.applyArtworkNames(cards)
    return result
  }

  public getCardById(id: number): CdbCard | null {
    const map = this.getCardsByIds([id])
    return map[id] ?? null
  }

  public getAliasGroupIds(id: number): number[] {
    const connections = this.connections.searchableList()
    if (connections.length === 0) return [id]
    const ids = new Set<number>([id])
    try {
      for (const conn of connections) {
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

  public close(): void {
    this.connections.close()
  }
}

export const cdbService = new CdbService()
