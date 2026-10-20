import {
  CdbCard,
  CardSearchFilterOptions,
  CardSearchParams,
  CardSearchResult,
  CardType,
  CdbLibraryInfo,
  cardPoolIdsFromOt,
  SEARCH_POOLS
} from '@shared/index'
import { CdbConnection, CdbConnections } from './cdbConnections'
import { buildSearchSql, textSource } from './cdbSearchSql'
import { sortCards, stripSortKeys, CardSortRow } from './cardSort'
import { loadLflists } from './lflistParser'
import { collectConfigDirs, loadCdbStringsConf } from './stringsConfParser'
import { splitSetcode } from './setcode'

export class CdbService {
  private connections = new CdbConnections((paths, languagePaths) =>
    this.loadStringsConf(paths, languagePaths)
  )
  private setnameMap: Map<number, string> = new Map()
  private systemStringMap: Map<number, string> = new Map()
  private limitMap: Map<number, 1 | 2 | 3> = new Map()
  private gameDirectory: string | undefined

  public setGameDirectory(gameDirectory: string | undefined): void {
    this.gameDirectory = gameDirectory
    if (!gameDirectory || this.connections.list().length === 0) return
    this.limitMap = loadLflists(
      collectConfigDirs(
        this.connections.searchableList().map((c) => c.path),
        [],
        this.gameDirectory
      )
    )
  }

  private loadStringsConf(cdbPaths: string[], languageDirs: string[] = []): void {
    const searchDirs = collectConfigDirs(cdbPaths, languageDirs, this.gameDirectory)
    this.limitMap = loadLflists(searchDirs)
    const conf = loadCdbStringsConf(searchDirs)
    this.setnameMap = conf.setnameMap
    this.systemStringMap = conf.systemStringMap
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
    return this.connections.open(cdbPath, bundledPaths, extraPaths, languagePack)
  }

  public addExtra(extraPaths: string[]): string[] {
    return this.connections.addExtra(extraPaths)
  }

  public reloadAll(
    primaryPath: string | undefined,
    bundledPaths: string[],
    extraPaths: string[],
    languagePack: { id: string; dir?: string; cdbPaths: string[] } | null = null
  ): void {
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
    for (const card of cards) {
      const pools = cardPoolIdsFromOt(card.ot)
      if (pools.length > 0) card.pools = pools
      else delete card.pools
    }
  }

  private hasPoolMask(db: CdbConnection['db'], mask: number, exact?: boolean): boolean {
    const sql = exact
      ? 'SELECT 1 FROM datas WHERE ot = ? LIMIT 1'
      : 'SELECT 1 FROM datas WHERE (ot & ?) != 0 LIMIT 1'
    try {
      const row = db.prepare(sql).get(mask)
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
    for (const pool of SEARCH_POOLS) {
      if (
        this.connections
          .searchableList()
          .some((conn) => this.hasPoolMask(conn.db, pool.mask, pool.exact))
      ) {
        availablePools.push(pool.id)
      }
    }
    return { effectCategories, availablePools }
  }

  public isReady(): boolean {
    return this.connections.list().length > 0
  }

  public search(params: CardSearchParams, favorites?: number[]): CardSearchResult {
    const connections = this.connections.searchableList()
    if (connections.length === 0) return { cards: [], total: 0 }

    if (params.onlyFavorites && (!favorites || favorites.length === 0)) {
      return { cards: [], total: 0 }
    }

    const limit = params.limit || 50
    const offset = params.offset || 0
    const perDbLimit = offset + limit

    let total = 0
    const collected: CdbCard[] = []
    const seen = new Set<number>()

    for (const conn of connections) {
      const result = this.searchOne(conn, params, perDbLimit, favorites)
      total += result.total
      for (const card of result.cards) {
        if (seen.has(card.id)) continue
        seen.add(card.id)
        collected.push(card)
      }
    }

    const page = sortCards(collected as CardSortRow[], params).slice(offset, offset + limit)
    for (const card of page) stripSortKeys(card)

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

    return { cards: page, total }
  }

  private searchOne(
    conn: CdbConnection,
    params: CardSearchParams,
    fetchLimit: number,
    favorites?: number[]
  ): CardSearchResult {
    const db = conn.db
    try {
      const plan = buildSearchSql(
        conn,
        params,
        fetchLimit,
        this.setnameMap,
        this.limitMap,
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
