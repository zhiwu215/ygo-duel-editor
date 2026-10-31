import Database from 'better-sqlite3'
import { existsSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { CdbLibraryRole, CdbLibrarySource } from '@shared/index'
import { CUSTOM_CDB_NAME, type GameLanguagePack } from '../services/gameContent'

export interface CdbConnection {
  path: string
  db: Database.Database
  role: CdbLibraryRole
  source: CdbLibrarySource
  customLibrary: boolean
  overlayAliases: string[]
  coveredReady: boolean
  searchable: boolean
}

interface OverlayTextRow {
  id: number
  name: string | null
  desc: string | null
}

const AUTO_TEXT_OVERLAP_RATIO = 0.9
const OVERLAY_ALIAS = 'ov'
const OVERLAY_FILE_PREFIX = 'yde-text-overlay-'
const OVERLAY_TABLE_SQL = 'CREATE TABLE texts (id INTEGER PRIMARY KEY, name TEXT, desc TEXT)'
const OVERLAY_UPSERT_SQL = `
  INSERT INTO texts (id, name, desc) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = COALESCE(texts.name, excluded.name),
    desc = COALESCE(texts.desc, excluded.desc)
`

function openConnection(cdbPath: string, source: CdbLibrarySource): CdbConnection | null {
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

    return {
      path: cdbPath,
      db,
      role: 'data',
      source,
      customLibrary: path.basename(cdbPath).toLowerCase() === CUSTOM_CDB_NAME,
      overlayAliases: [],
      coveredReady: false,
      searchable: true
    }
  } catch (err) {
    console.error('[CdbService] Failed to open cdb:', err)
    return null
  }
}

export function readCdbCardCount(cdbPath: string): number | null {
  if (!existsSync(cdbPath)) return null
  try {
    const db = new Database(cdbPath, { readonly: true, fileMustExist: true })
    try {
      const probe = db
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('datas','texts')"
        )
        .get() as { n: number } | undefined
      if (!probe || probe.n < 2) return null
      const row = db.prepare('SELECT count(*) AS n FROM datas').get() as { n: number } | undefined
      return row ? row.n : null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

export function isValidCdb(cdbPath: string): boolean {
  return readCdbCardCount(cdbPath) !== null
}

export class CdbConnections {
  private connections: CdbConnection[] = []
  private currentPath: string | null = null
  private languageDirs: string[] = []
  private overlayPath: string | null = null
  private overlaySeq = 0

  constructor(private readonly loadTexts: (paths: string[], languageDirs: string[]) => void) {
    this.clearStaleOverlays()
  }

  private clearStaleOverlays(): void {
    try {
      const current = `${OVERLAY_FILE_PREFIX}${process.pid}-`
      for (const entry of readdirSync(tmpdir())) {
        if (!entry.startsWith(OVERLAY_FILE_PREFIX) || entry.startsWith(current)) continue
        try {
          rmSync(path.join(tmpdir(), entry), { force: true })
        } catch {}
      }
    } catch {}
  }
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
      if (conn.source === 'language') {
        conn.role = 'text'
        return
      }
      const own = idSets.get(conn.path) ?? new Set<number>()
      const covered = othersUnion.get(conn.path) ?? new Set<number>()
      let hit = 0
      for (const id of own) if (covered.has(id)) hit++
      conn.role = own.size > 0 && hit / own.size >= AUTO_TEXT_OVERLAP_RATIO ? 'text' : 'data'
    })

    const dataConns = this.connections.filter((conn) => conn.role === 'data')
    const languageConns = this.connections.filter(
      (conn) => conn.role === 'text' && conn.source === 'language'
    )
    const otherTextConns = this.connections.filter(
      (conn) => conn.role === 'text' && conn.source !== 'language'
    )
    const searchableConns = this.connections.filter((conn) => conn.searchable)
    this.connections = [...dataConns, ...languageConns, ...otherTextConns]

    const attachConns = [...languageConns, ...otherTextConns]
    this.attachTextOverlay(attachConns, searchableConns)

    const coveredSoFar = new Set<number>()
    for (const conn of this.connections) {
      if (!conn.searchable) continue
      if (coveredSoFar.size > 0) this.writeCoveredIds(conn, coveredSoFar)
      for (const id of idSets.get(conn.path) ?? []) coveredSoFar.add(id)
    }

    console.log(
      `[CdbService] Library roles: ${this.connections
        .map((conn) => `${path.basename(conn.path)}=${conn.role}`)
        .join(', ')}`
    )
  }

  private attachTextOverlay(textConns: CdbConnection[], targets: CdbConnection[]): void {
    this.releaseOverlayFile()
    if (textConns.length === 0) return

    const overlayPath = this.buildOverlayDatabase(textConns)
    if (!overlayPath) {
      this.attachTextLibraries(textConns, targets)
      return
    }

    const literal = overlayPath.replace(/'/g, "''")
    for (const conn of targets) {
      try {
        conn.db.exec(`ATTACH DATABASE '${literal}' AS ${OVERLAY_ALIAS}`)
        conn.overlayAliases.push(OVERLAY_ALIAS)
      } catch (err) {
        console.error('[CdbService] Failed to attach text overlay:', err)
      }
    }
    this.overlayPath = overlayPath
  }

  private attachTextLibraries(textConns: CdbConnection[], targets: CdbConnection[]): void {
    textConns.forEach((textConn, index) => {
      const alias = `ov${index}`
      const literal = textConn.path.replace(/'/g, "''")
      for (const conn of targets) {
        try {
          conn.db.exec(`ATTACH DATABASE '${literal}' AS ${alias}`)
          conn.overlayAliases.push(alias)
        } catch (err) {
          console.error(`[CdbService] Failed to attach text library ${textConn.path}:`, err)
        }
      }
    })
  }

  private buildOverlayDatabase(textConns: CdbConnection[]): string | null {
    const file = path.join(tmpdir(), `${OVERLAY_FILE_PREFIX}${process.pid}-${++this.overlaySeq}.db`)
    try {
      rmSync(file, { force: true })
      const db = new Database(file)
      try {
        db.exec(OVERLAY_TABLE_SQL)
        const upsert = db.prepare(OVERLAY_UPSERT_SQL)
        const insertAll = db.transaction((rows: OverlayTextRow[]) => {
          for (const row of rows) upsert.run(row.id, row.name, row.desc)
        })
        textConns.forEach((conn, index) => {
          const alias = `src${index}`
          db.exec(`ATTACH DATABASE '${conn.path.replace(/'/g, "''")}' AS ${alias}`)
          try {
            const rows = db
              .prepare(`SELECT id, name, desc FROM ${alias}.texts`)
              .all() as OverlayTextRow[]
            insertAll(rows)
          } finally {
            db.exec(`DETACH DATABASE ${alias}`)
          }
        })
      } finally {
        db.close()
      }
      return file
    } catch (err) {
      console.error('[CdbService] Failed to build text overlay:', err)
      try {
        rmSync(file, { force: true })
      } catch {}
      return null
    }
  }

  private releaseOverlayFile(): void {
    if (!this.overlayPath) return
    try {
      rmSync(this.overlayPath, { force: true })
    } catch {}
    this.overlayPath = null
  }

  public list(): CdbConnection[] {
    return this.connections
  }

  public searchableList(): CdbConnection[] {
    return this.connections.filter((c) => c.searchable)
  }

  public getCurrentPath(): string | null {
    return this.currentPath
  }

  public getLoadedPaths(): string[] {
    return this.connections.map((c) => c.path)
  }

  public listLibraries(): Array<{ path: string; source: CdbLibrarySource }> {
    return this.connections.map((c) => ({ path: c.path, source: c.source }))
  }

  public open(
    cdbPath: string,
    bundledPaths: string[] = [],
    extraPaths: string[] = [],
    languagePacks: GameLanguagePack[] = []
  ): boolean {
    const primary = openConnection(cdbPath, 'primary')
    if (!primary) return false

    this.closeConnections()
    this.languageDirs = languagePacks.map((pack) => pack.dir).filter((dir): dir is string => !!dir)
    this.connections = [primary]

    this.addConnections(bundledPaths, 'bundled')
    this.addConnections(extraPaths, 'extra')
    for (const pack of languagePacks) this.addConnections(pack.cdbPaths, 'language')

    this.currentPath = cdbPath
    this.finalizeConnections()
    this.notifyTexts()
    console.log(
      `[CdbService] Loaded ${this.connections.length} database(s): ${this.connections.map((c) => c.path).join(', ')}`
    )
    return true
  }

  private addConnections(paths: string[], source: CdbLibrarySource): void {
    for (const cdbPath of paths) {
      if (this.connections.some((c) => c.path === cdbPath)) continue
      const conn = openConnection(cdbPath, source)
      if (conn) {
        conn.searchable = source !== 'language'
        this.connections.push(conn)
      } else console.warn(`[CdbService] Skipped invalid cdb: ${cdbPath}`)
    }
  }

  public reloadAll(
    primaryPath: string | undefined,
    bundledPaths: string[],
    extraPaths: string[],
    languagePacks: GameLanguagePack[] = []
  ): void {
    this.closeConnections()
    this.currentPath = null
    if (primaryPath) {
      this.open(primaryPath, bundledPaths, extraPaths, languagePacks)
      return
    }
    this.languageDirs = languagePacks.map((pack) => pack.dir).filter((dir): dir is string => !!dir)
    for (const cdbPath of [...bundledPaths, ...extraPaths]) {
      const conn = openConnection(cdbPath, 'extra')
      if (!conn) continue
      this.connections = [conn]
      this.currentPath = conn.path
      for (const pack of languagePacks) this.addConnections(pack.cdbPaths, 'language')
      this.finalizeConnections()
      this.notifyTexts()
      return
    }
  }

  private notifyTexts(): void {
    this.loadTexts(
      this.searchableList().map((c) => c.path),
      [...this.languageDirs].reverse()
    )
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
    this.languageDirs = []
    this.releaseOverlayFile()
  }

  public close(): void {
    this.closeConnections()
    this.currentPath = null
  }
}
