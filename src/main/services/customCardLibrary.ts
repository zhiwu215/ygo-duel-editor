import { mkdirSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import * as sqlJsNamespace from 'sql.js'
import type { SqlJsStatic } from 'sql.js'
import { CardDataEntry, YGOProCdb } from 'ygopro-cdb-encode'
import { CustomCard, customCardToCdbCard } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { CUSTOM_CDB_NAME, currentBundledCdbPaths, currentLanguagePack } from './gameContent'
import { dataDirService } from './dataDirService'
import { broadcastToWindows } from './broadcast'

const LIBRARY_DIR = 'custom'

function customLibraryDir(): string {
  return dataDirService.ensureDirectory(LIBRARY_DIR)
}

export function customCdbPath(): string {
  return join(customLibraryDir(), CUSTOM_CDB_NAME)
}

export function isCustomCdbPath(cdbPath: string): boolean {
  return (
    basename(cdbPath).toLowerCase() === CUSTOM_CDB_NAME &&
    basename(dirname(cdbPath)).toLowerCase() === LIBRARY_DIR
  )
}

let sqlPromise: Promise<SqlJsStatic> | null = null

function resolveInitSqlJs(): (config?: unknown) => Promise<SqlJsStatic> {
  const ns = sqlJsNamespace as unknown as {
    initSqlJs?: (config?: unknown) => Promise<SqlJsStatic>
    default?: (config?: unknown) => Promise<SqlJsStatic>
  }
  const init = ns.initSqlJs ?? ns.default
  if (!init) {
    throw new Error('sql.js 模块加载失败：找不到初始化入口。')
  }
  return init
}

function loadSqlJs(): Promise<SqlJsStatic> {
  const existing = sqlPromise
  if (existing) return existing
  const created = resolveInitSqlJs()()
  sqlPromise = created
  return created
}

function toCardEntry(card: CustomCard, customOtMask = 0): CardDataEntry {
  const cdbCard = customCardToCdbCard(card)
  return new CardDataEntry().fromPartial({
    code: cdbCard.id,
    ot: cdbCard.ot | customOtMask,
    alias: cdbCard.alias,
    setcode: card.setcode,
    type: cdbCard.type,
    attack: cdbCard.atk,
    defense: card.def,
    level: card.level,
    lscale: card.lscale,
    rscale: card.rscale,
    linkMarker: card.linkMarkers,
    race: cdbCard.race,
    attribute: cdbCard.attribute,
    category: Number(cdbCard.category),
    name: cdbCard.name,
    desc: cdbCard.desc,
    strings: card.strings
  })
}

export async function writeCustomCardsCdb(
  cards: CustomCard[],
  cdbPath: string,
  customOtMask?: number
): Promise<void> {
  mkdirSync(dirname(cdbPath), { recursive: true })
  const SQL = await loadSqlJs()
  const cdb = new YGOProCdb(SQL)
  try {
    for (const card of cards) cdb.addCard(toCardEntry(card, customOtMask))
    writeFileSync(cdbPath, Buffer.from(cdb.export()))
  } finally {
    cdb.finalize()
  }
}

async function writeCdb(cards: CustomCard[]): Promise<void> {
  await writeCustomCardsCdb(cards, customCdbPath())
}

let writeQueue: Promise<void> = Promise.resolve()

export function syncCustomCardLibrary(cards: CustomCard[]): void {
  writeQueue = writeQueue
    .then(async () => {
      try {
        await writeCdb(cards)
      } catch (err) {
        console.error('[CustomCardLibrary] Failed to write custom cdb:', err)
        return
      }
      try {
        registerCustomCdb()
      } catch (err) {
        console.error('[CustomCardLibrary] Failed to register custom cdb:', err)
      }
    })
    .catch(() => undefined)
}

function registerCustomCdb(): void {
  const cdbPath = customCdbPath()
  const cfg = configService.get()
  const extras = (cfg.extraCdbPaths || []).filter((p) => !isCustomCdbPath(p))
  const disabled = (cfg.disabledCdbPaths || []).filter((p) => !isCustomCdbPath(p))
  const nextExtras = [...extras, cdbPath]

  if (
    nextExtras.length !== (cfg.extraCdbPaths || []).length ||
    disabled.length !== (cfg.disabledCdbPaths || []).length
  ) {
    configService.save({ extraCdbPaths: nextExtras, disabledCdbPaths: disabled })
  }

  cdbService.reloadAll(cfg.cdbPath, currentBundledCdbPaths(), nextExtras, currentLanguagePack())
  broadcastToWindows('cdb:updated')
}

export function isCustomCdbLoaded(): boolean {
  const target = customCdbPath().toLowerCase()
  return cdbService.getLoadedPaths().some((p) => p.toLowerCase() === target)
}
