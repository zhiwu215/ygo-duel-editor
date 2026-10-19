import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import path from 'path'
import { CdbLibraryRole } from '@shared/index'

export interface CdbConnection {
  path: string
  db: Database.Database
  role: CdbLibraryRole
  overlayAliases: string[]
  coveredReady: boolean
}

const AUTO_TEXT_OVERLAP_RATIO = 0.9

function openConnection(cdbPath: string): CdbConnection | null {
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

export class CdbConnections {
  private connections: CdbConnection[] = []
  private currentPath: string | null = null

  constructor(private readonly loadTexts: (paths: string[]) => void) {}

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

  private finalizeConnections(): void {
    if (this.connections.length === 0) return

    for (const conn of this.connections) {
      for (const alias of conn.overlayAliases) {
        try {
          conn.db.exec(`DETACH DATABASE ${alias}`)
        } catch {}
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

  public list(): CdbConnection[] {
    return this.connections
  }

  public getCurrentPath(): string | null {
    return this.currentPath
  }

  public getLoadedPaths(): string[] {
    return this.connections.map((c) => c.path)
  }

  public open(cdbPath: string, extraPaths: string[] = []): boolean {
    const primary = openConnection(cdbPath)
    if (!primary) return false

    this.closeConnections()
    this.connections = [primary]

    for (const extraPath of extraPaths) {
      if (extraPath === cdbPath) continue
      const conn = openConnection(extraPath)
      if (conn) this.connections.push(conn)
      else console.warn(`[CdbService] Skipped invalid extra cdb: ${extraPath}`)
    }

    this.currentPath = cdbPath
    this.finalizeConnections()
    this.loadTexts(this.connections.map((c) => c.path))
    console.log(
      `[CdbService] Loaded ${this.connections.length} database(s): ${this.connections.map((c) => c.path).join(', ')}`
    )
    return true
  }

  public addExtra(extraPaths: string[]): string[] {
    const loaded: string[] = []
    for (const extraPath of extraPaths) {
      if (this.connections.some((c) => c.path === extraPath)) {
        loaded.push(extraPath)
        continue
      }
      const conn = openConnection(extraPath)
      if (!conn) continue
      this.connections.push(conn)
      loaded.push(extraPath)
    }
    this.finalizeConnections()
    this.loadTexts(this.connections.map((c) => c.path))
    console.log(`[CdbService] Extra cdb loaded: ${loaded.join(', ') || '(none)'}`)
    return loaded
  }

  public reloadAll(primaryPath: string | undefined, extraPaths: string[]): void {
    this.closeConnections()
    this.currentPath = null
    if (primaryPath) {
      this.open(primaryPath, extraPaths)
      return
    }
    for (const extraPath of extraPaths) {
      const conn = openConnection(extraPath)
      if (!conn) continue
      this.connections = [conn]
      this.currentPath = conn.path
      this.finalizeConnections()
      this.loadTexts([conn.path])
      return
    }
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
