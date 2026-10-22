import { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  CardSearchParams,
  CardType,
  CustomCard,
  CustomCardInput,
  CustomCardPickImageResult,
  CustomCardScriptInfo,
  CustomCardScriptPickResult,
  CustomCardScriptResult,
  CdbCard,
  CUSTOM_CARD_ID_MAX,
  CUSTOM_CARD_ID_MIN,
  normalizeCardSetcode,
  normalizeCardStrings,
  unpackCardLevel
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import type { CardSortRow } from '../db/cardSort'
import { dataDirService } from './dataDirService'
import {
  applyCustomCardImage,
  findCustomCardImage,
  pickAndApplyCustomCardImage,
  pickCustomCardImage,
  removeCustomCardImages
} from './customCardImage'
import { mergeCardsByIds, searchCustomCardRows } from './customCardSearch'
import { syncCustomCardLibrary } from './customCardLibrary'
import {
  getCustomScriptInfo,
  importCustomScript,
  pickCustomCardScriptFile,
  readCustomScriptContent,
  removeCustomScript,
  writeCustomScriptContent
} from './customCardScript'

const LIBRARY_FILE = 'custom_cards.json'

type LegacyCustomCard = Partial<CustomCard> & {
  level?: number
  def?: number
  schemaVersion?: number
}

function clampInteger(value: unknown, min: number, max: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function normalizeStat(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  if (numeric === -2) return -2
  return Math.max(0, Math.min(99999, Math.trunc(numeric)))
}

function normalizeCard(raw: LegacyCustomCard): CustomCard {
  const type = clampInteger(raw.type, 0, 0xffffffff) || CardType.MONSTER | CardType.EFFECT
  const isMonster = (type & CardType.MONSTER) !== 0
  const isLink = isMonster && (type & CardType.LINK) !== 0
  const isPendulum = isMonster && (type & CardType.PENDULUM) !== 0
  const legacy = raw.schemaVersion !== 2
  const legacyLevel = legacy
    ? unpackCardLevel(Number(raw.level) || 0)
    : {
        level: clampInteger(raw.level, 0, 13),
        lscale: clampInteger(raw.lscale, 0, 13),
        rscale: clampInteger(raw.rscale, 0, 13)
      }
  const linkMarkers = legacy
    ? isLink
      ? clampInteger(raw.def, 0, 0x1ff)
      : 0
    : clampInteger(raw.linkMarkers, 0, 0x1ff)
  const defense = legacy && isLink ? 0 : normalizeStat(raw.def)
  return {
    schemaVersion: 2,
    id: clampInteger(raw.id, 0, 0x7fffffff),
    alias: clampInteger(raw.alias, 0, 0x7fffffff),
    ot: clampInteger(raw.ot, 0, 3),
    setcode: normalizeCardSetcode(raw.setcode),
    type,
    attribute: isMonster ? clampInteger(raw.attribute, 0, 0xff) : 0,
    race: isMonster && Number.isFinite(Number(raw.race)) ? Number(raw.race) : 0,
    level: isMonster ? legacyLevel.level : 0,
    lscale: isPendulum ? legacyLevel.lscale : 0,
    rscale: isPendulum ? legacyLevel.rscale : 0,
    atk: isMonster ? normalizeStat(raw.atk) : 0,
    def: isMonster && !isLink ? defense : 0,
    linkMarkers: isLink ? linkMarkers : 0,
    category: clampInteger(raw.category, 0, 0xffffffff),
    name: typeof raw.name === 'string' ? raw.name : '',
    desc: typeof raw.desc === 'string' ? raw.desc.trim() : '',
    strings: normalizeCardStrings(raw.strings),
    createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : Date.now()
  }
}

export class CustomCardService {
  private cards: CustomCard[] = []
  private loaded = false
  private revision = 0

  public getRevision(): number {
    return this.revision
  }

  private get filePath(): string {
    return dataDirService.resolve(LIBRARY_FILE)
  }

  private get imageDir(): string {
    return dataDirService.ensureDirectory(join('custom', 'pics'))
  }

  public resetCache(): void {
    this.cards = []
    this.loaded = false
    this.revision += 1
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    this.revision += 1
    try {
      if (!existsSync(this.filePath)) return
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      if (!Array.isArray(parsed)) return
      const rawCards = parsed.filter((card) => card && Number.isFinite(Number(card.id)))
      const needsMigration = rawCards.some((card) => card.schemaVersion !== 2)
      this.cards = rawCards.map((card) => normalizeCard(card)).filter((card) => card.id > 0)
      if (needsMigration) this.persist()
    } catch (err) {
      console.error('[CustomCardService] Failed to load custom cards:', err)
    } finally {
      syncCustomCardLibrary(this.cards)
    }
  }

  private persist(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.cards, null, 2), 'utf-8')
    } catch (err) {
      console.error('[CustomCardService] Failed to save custom cards:', err)
      throw err
    }
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('custom-cards:updated')
    }
  }

  public list(): CustomCard[] {
    this.ensureLoaded()
    return [...this.cards]
  }

  public getById(id: number): CustomCard | null {
    this.ensureLoaded()
    return this.cards.find((card) => card.id === id) ?? null
  }

  public findImagePath(id: number): string | null {
    this.ensureLoaded()
    if (!this.cards.some((card) => card.id === id)) return null
    return findCustomCardImage(this.imageDir, id)
  }

  private generateId(): number {
    let next = CUSTOM_CARD_ID_MIN
    for (const card of this.cards) {
      if (card.id >= CUSTOM_CARD_ID_MIN && card.id <= CUSTOM_CARD_ID_MAX) {
        next = Math.max(next, card.id + 1)
      }
    }
    for (let candidate = next; candidate <= CUSTOM_CARD_ID_MAX; candidate++) {
      if (cdbService.getCardById(candidate) === null) return candidate
    }
    for (let candidate = CUSTOM_CARD_ID_MIN; candidate < next; candidate++) {
      if (this.cards.some((card) => card.id === candidate)) continue
      if (cdbService.getCardById(candidate) === null) return candidate
    }
    throw new Error('自定义卡片号段已用完')
  }

  private assertNewIdAvailable(id: number): void {
    if (!Number.isInteger(id) || id <= 0 || id > 0x7fffffff) {
      throw new Error('卡密必须是 1–2147483647 的整数')
    }
    if (this.cards.some((card) => card.id === id)) {
      throw new Error(`卡密 ${id} 已被其他自定义卡片使用`)
    }
    const existing = cdbService.getCardById(id)
    if (existing) {
      throw new Error(`卡密 ${id} 已被现有卡片「${existing.name}」占用`)
    }
  }

  public save(input: CustomCardInput): { card: CustomCard; warning?: string } {
    this.ensureLoaded()
    const name = (input.name || '').trim()
    if (!name) throw new Error('卡名不能为空')

    const mainType = input.type & (CardType.MONSTER | CardType.SPELL | CardType.TRAP)
    if (mainType === 0) throw new Error('卡片种类不能为空')
    if (
      mainType !== CardType.MONSTER &&
      mainType !== CardType.SPELL &&
      mainType !== CardType.TRAP
    ) {
      throw new Error('卡片种类只能选择怪兽、魔法或陷阱')
    }
    const summonMask =
      CardType.RITUAL | CardType.FUSION | CardType.SYNCHRO | CardType.XYZ | CardType.LINK
    const summonBits = input.type & summonMask
    if (summonBits !== 0 && (summonBits & (summonBits - 1)) !== 0) {
      throw new Error('召唤方式只能选择一种')
    }
    if ((input.type & CardType.LINK) !== 0) {
      if ((input.type & CardType.PENDULUM) !== 0) {
        throw new Error('连接怪兽不能是灵摆怪兽')
      }
      if (
        (input.type & (CardType.RITUAL | CardType.FUSION | CardType.SYNCHRO | CardType.XYZ)) !==
        0
      ) {
        throw new Error('连接怪兽不能同时是仪式、融合、同调或超量怪兽')
      }
      if (!input.linkMarkers) throw new Error('连接怪兽至少需要一个连接箭头')
    }

    const existing = input.editingId !== undefined ? this.getById(input.editingId) : null
    if (input.editingId !== undefined && !existing) throw new Error('自定义卡片不存在')

    let id: number
    if (existing) {
      id = existing.id
      if (input.id !== undefined && input.id !== existing.id) {
        throw new Error('卡密保存后不可修改')
      }
    } else {
      id = input.id ?? this.generateId()
      this.assertNewIdAvailable(id)
    }

    const now = Date.now()
    const card = normalizeCard({
      ...input,
      schemaVersion: 2,
      id,
      name,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    })

    if (existing) {
      const index = this.cards.findIndex((item) => item.id === existing.id)
      this.cards[index] = card
    } else {
      this.cards.push(card)
    }
    this.persist()
    syncCustomCardLibrary(this.cards)

    const warnings: string[] = []
    try {
      applyCustomCardImage(card.id, input.imageSourcePath, () => this.imageDir)
    } catch (err) {
      console.error('[CustomCardService] Failed to apply card image:', err)
      warnings.push('卡片已保存，但卡图写入失败')
    }
    if (input.scriptSourcePath) {
      const imported = importCustomScript(card.id, input.scriptSourcePath)
      if (!imported.success) warnings.push(imported.error || '卡片已保存，但脚本导入失败')
      else if (imported.warning) warnings.push(imported.warning)
    }

    this.revision += 1
    this.broadcast()
    return { card, warning: warnings.length > 0 ? warnings.join('；') : undefined }
  }

  public remove(id: number): void {
    this.ensureLoaded()
    const before = this.cards.length
    this.cards = this.cards.filter((card) => card.id !== id)
    if (this.cards.length === before) return
    try {
      removeCustomCardImages(() => this.imageDir, id)
    } catch (err) {
      console.error('[CustomCardService] Failed to remove card image:', err)
    }
    try {
      removeCustomScript(id)
    } catch (err) {
      console.error('[CustomCardService] Failed to remove card script:', err)
    }
    this.persist()
    syncCustomCardLibrary(this.cards)
    this.revision += 1
    this.broadcast()
  }

  public async pickImageSource(): Promise<CustomCardPickImageResult> {
    return pickCustomCardImage()
  }

  public async pickAndApplyImage(id: number): Promise<CustomCardPickImageResult> {
    return pickAndApplyCustomCardImage(
      id,
      () => this.imageDir,
      (cardId) => this.getById(cardId),
      () => this.broadcast()
    )
  }

  public scriptInfo(code: number): CustomCardScriptInfo {
    return getCustomScriptInfo(code)
  }

  public scriptContent(code: number): string | null {
    this.ensureLoaded()
    if (!this.getById(code)) return null
    return readCustomScriptContent(code)
  }

  public allocateId(): number {
    this.ensureLoaded()
    return this.generateId()
  }

  public async pickScriptFile(): Promise<CustomCardScriptPickResult> {
    return pickCustomCardScriptFile()
  }

  public importScript(code: number, filePath: string): CustomCardScriptResult {
    this.ensureLoaded()
    if (!this.getById(code)) return { success: false, error: '自定义卡片不存在' }
    return importCustomScript(code, filePath)
  }

  public saveScriptContent(code: number, content: string): CustomCardScriptResult {
    this.ensureLoaded()
    if (!this.getById(code)) return { success: false, error: '自定义卡片不存在' }
    return writeCustomScriptContent(code, content)
  }

  public deleteScript(code: number): CustomCardScriptResult {
    this.ensureLoaded()
    if (!this.getById(code)) return { success: false, error: '自定义卡片不存在' }
    return removeCustomScript(code)
  }

  public searchRows(
    params: CardSearchParams,
    fetchLimit: number,
    favorites?: number[]
  ): { rows: CardSortRow[]; total: number } {
    this.ensureLoaded()
    return searchCustomCardRows(this.cards, params, fetchLimit, favorites)
  }

  public mergeCardsByIds(map: Record<number, CdbCard>, ids: number[]): Record<number, CdbCard> {
    return mergeCardsByIds(map, ids, () => {
      this.ensureLoaded()
      return this.cards
    })
  }
}

export const customCardService = new CustomCardService()
