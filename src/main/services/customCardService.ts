import { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  CardSearchParams,
  CustomCard,
  CustomCardInput,
  CustomCardPickImageResult,
  CustomCardScriptInfo,
  CustomCardScriptResult,
  CdbCard,
  CUSTOM_CARD_ID_MAX,
  CUSTOM_CARD_ID_MIN
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
import {
  getCustomScriptInfo,
  importCustomScript,
  removeCustomScript,
  syncCustomCardLibrary
} from './customCardLibrary'

const LIBRARY_FILE = 'custom_cards.json'

export class CustomCardService {
  private cards: CustomCard[] = []
  private loaded = false

  private get filePath(): string {
    return dataDirService.resolve(LIBRARY_FILE)
  }

  private get imageDir(): string {
    return dataDirService.ensureDirectory(join('custom', 'pics'))
  }

  public resetCache(): void {
    this.cards = []
    this.loaded = false
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (!existsSync(this.filePath)) return
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      if (Array.isArray(parsed)) this.cards = parsed.filter((c) => c && Number.isFinite(c.id))
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
    return this.cards.find((c) => c.id === id) ?? null
  }

  public findImagePath(id: number): string | null {
    this.ensureLoaded()
    if (!this.cards.some((c) => c.id === id)) return null
    return findCustomCardImage(this.imageDir, id)
  }

  private generateId(): number {
    const span = CUSTOM_CARD_ID_MAX - CUSTOM_CARD_ID_MIN + 1
    for (let attempt = 0; attempt < 1000; attempt++) {
      const candidate = CUSTOM_CARD_ID_MIN + Math.floor(Math.random() * span)
      if (this.cards.some((c) => c.id === candidate)) continue
      if (cdbService.getCardById(candidate) !== null) continue
      return candidate
    }
    throw new Error('无法生成未冲突的自建卡卡密')
  }

  public save(input: CustomCardInput): CustomCard {
    this.ensureLoaded()
    const name = (input.name || '').trim()
    if (!name) throw new Error('卡名不能为空')

    const now = Date.now()
    const existing = input.id !== undefined ? this.getById(input.id) : null
    const card: CustomCard = {
      id: existing ? existing.id : this.generateId(),
      name,
      desc: (input.desc || '').trim(),
      type: input.type || 0,
      attribute: input.attribute || 0,
      race: input.race || 0,
      level: input.level || 0,
      atk: Number.isFinite(input.atk) ? input.atk : 0,
      def: Number.isFinite(input.def) ? input.def : 0,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    }

    if (existing) {
      const index = this.cards.findIndex((c) => c.id === existing.id)
      this.cards[index] = card
    } else {
      this.cards.push(card)
    }
    this.persist()
    syncCustomCardLibrary(this.cards)
    applyCustomCardImage(card.id, input.imageSourcePath, () => this.imageDir)
    this.broadcast()
    return card
  }

  public remove(id: number): void {
    this.ensureLoaded()
    const before = this.cards.length
    this.cards = this.cards.filter((c) => c.id !== id)
    if (this.cards.length === before) return
    try {
      removeCustomCardImages(() => this.imageDir, id)
    } catch (err) {
      console.error('[CustomCardService] Failed to remove card image:', err)
    }
    this.persist()
    syncCustomCardLibrary(this.cards)
    this.broadcast()
  }

  public async pickImageSource(): Promise<CustomCardPickImageResult> {
    return pickCustomCardImage()
  }

  public async pickAndApplyImage(id: number): Promise<CustomCardPickImageResult> {
    return pickAndApplyCustomCardImage(
      id,
      () => this.imageDir,
      (id) => this.getById(id),
      () => this.broadcast()
    )
  }

  public scriptInfo(code: number): CustomCardScriptInfo {
    return getCustomScriptInfo(code)
  }

  public async pickScript(code: number): Promise<CustomCardScriptResult> {
    this.ensureLoaded()
    if (!this.getById(code)) return { success: false, error: '自建卡不存在' }
    return importCustomScript(code)
  }

  public deleteScript(code: number): CustomCardScriptResult {
    this.ensureLoaded()
    if (!this.getById(code)) return { success: false, error: '自建卡不存在' }
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
