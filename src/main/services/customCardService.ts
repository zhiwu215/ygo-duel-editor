import { app, BrowserWindow, dialog } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { extname, join } from 'path'
import {
  CardSearchParams,
  CardSearchResult,
  CardType,
  CustomCard,
  CustomCardInput,
  CustomCardPickImageResult,
  CdbCard,
  customCardToCdbCard,
  CUSTOM_CARD_ID_MIN,
  CUSTOM_CARD_ID_MAX
} from '@shared/index'
import { cdbService, compareCards, parseSearchTokens } from '../db/cdbService'

const LIBRARY_FILE = 'custom_cards.json'
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

export class CustomCardService {
  private cards: CustomCard[] = []
  private loaded = false

  private get filePath(): string {
    return join(app.getPath('userData'), LIBRARY_FILE)
  }

  private get imageDir(): string {
    return join(app.getPath('userData'), 'pics', 'custom')
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
    try {
      if (!existsSync(this.imageDir)) return null
      for (const name of readdirSync(this.imageDir)) {
        const ext = extname(name).toLocaleLowerCase()
        if (!IMAGE_EXTENSIONS.includes(ext)) continue
        const base = name.slice(0, name.length - ext.length)
        if (base === String(id)) return join(this.imageDir, name)
      }
    } catch (err) {
      console.error('[CustomCardService] find image error:', err)
    }
    return null
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
    this.applyImage(card.id, input.imageSourcePath)
    this.broadcast()
    return card
  }

  private applyImage(id: number, imageSourcePath: string | undefined): void {
    if (!imageSourcePath) return
    try {
      if (!existsSync(imageSourcePath)) {
        console.warn(`[CustomCardService] picked image not found: ${imageSourcePath}`)
        return
      }
      mkdirSync(this.imageDir, { recursive: true })
      for (const name of readdirSync(this.imageDir)) {
        const ext = extname(name).toLocaleLowerCase()
        if (!IMAGE_EXTENSIONS.includes(ext)) continue
        if (name.slice(0, name.length - ext.length) === String(id)) {
          rmSync(join(this.imageDir, name))
        }
      }
      const targetExt = extname(imageSourcePath).toLocaleLowerCase() || '.jpg'
      copyFileSync(imageSourcePath, join(this.imageDir, `${id}${targetExt}`))
    } catch (err) {
      console.error('[CustomCardService] apply image error:', err)
    }
  }

  public remove(id: number): void {
    this.ensureLoaded()
    const before = this.cards.length
    this.cards = this.cards.filter((c) => c.id !== id)
    if (this.cards.length === before) return
    try {
      if (existsSync(this.imageDir)) {
        for (const name of readdirSync(this.imageDir)) {
          const ext = extname(name).toLocaleLowerCase()
          if (!IMAGE_EXTENSIONS.includes(ext)) continue
          if (name.slice(0, name.length - ext.length) === String(id)) {
            rmSync(join(this.imageDir, name))
          }
        }
      }
    } catch (err) {
      console.error('[CustomCardService] Failed to remove card image:', err)
    }
    this.persist()
    this.broadcast()
  }

  public async pickImageSource(): Promise<CustomCardPickImageResult> {
    const picked = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导入自建卡图',
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true }
    const source = picked.filePaths[0]
    if (!existsSync(source)) return { success: false, error: '文件不存在' }
    const ext = extname(source).toLocaleLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg'
    let previewDataUrl: string | undefined
    try {
      previewDataUrl = `data:${mime};base64,${readFileSync(source).toString('base64')}`
    } catch (err) {
      console.error('[CustomCardService] read picked image error:', err)
    }
    return { success: true, filePath: source, previewDataUrl }
  }

  private matchNumeric(
    value: number,
    op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'unknown' | undefined,
    target: number | undefined,
    allowUnknown = false
  ): boolean {
    const compare = op ?? 'eq'
    if (compare === 'unknown') return allowUnknown && value === -2
    if (target === undefined || target < 0) return true
    if (value < 0) return false
    switch (compare) {
      case 'eq':
        return value === target
      case 'gt':
        return value > target
      case 'gte':
        return value >= target
      case 'lt':
        return value < target
      case 'lte':
        return value <= target
      default:
        return true
    }
  }

  private matchKeyword(card: CustomCard, params: CardSearchParams): boolean {
    const keyword = (params.keyword ?? '').trim()
    if (keyword.length === 0) return true
    if (/^\d+$/.test(keyword)) {
      return card.id === parseInt(keyword, 10) || card.name.includes(keyword)
    }
    for (const token of parseSearchTokens(keyword)) {
      const inName = card.name.includes(token.text)
      const inDesc = params.searchDesc !== false && card.desc.includes(token.text)
      const matched =
        token.mode === 'name' ? inName : token.mode === 'set' ? false : inName || inDesc
      if (token.excluded ? matched : !matched) return false
    }
    return true
  }

  private matchFilters(card: CustomCard, params: CardSearchParams): boolean {
    if (params.code !== undefined && params.code > 0 && card.id !== params.code) return false
    if (params.type !== undefined && params.type !== 0 && (card.type & params.type) === 0) {
      return false
    }
    if (params.subType !== undefined && params.subType !== 0) {
      if (params.type === CardType.SPELL || params.type === CardType.TRAP) {
        if (card.type !== params.subType) return false
      } else if ((card.type & params.subType) !== params.subType) {
        return false
      }
    }
    if (params.attribute !== undefined && params.attribute !== 0) {
      if ((card.attribute & params.attribute) === 0) return false
    }
    if (params.race !== undefined && params.race !== 0) {
      if ((card.race & params.race) === 0) return false
    }
    if (params.level !== undefined && params.level > 0) {
      if (!this.matchNumeric(card.level & 255, params.levelOp, params.level)) return false
    }
    if (params.scale !== undefined) {
      if ((card.type & CardType.PENDULUM) === 0) return false
      if (!this.matchNumeric((card.level >>> 24) & 255, params.scaleOp, params.scale)) return false
    }
    if (
      !this.matchNumeric(card.atk, params.atkOp, params.atk, true) ||
      !this.matchNumeric(card.def, params.defOp, params.def, true)
    ) {
      return false
    }
    if (params.atk !== undefined && params.atk >= 0 && card.atk === -2) return false
    if ((params.def !== undefined && params.def >= 0) || params.defOp === 'unknown') {
      if ((card.type & CardType.LINK) !== 0) return false
      if (params.def !== undefined && params.def >= 0 && card.def === -2) return false
    }
    if (params.effectCategoryMask !== undefined && params.effectCategoryMask > 0) return false
    if (params.limitFilter) return false
    if (params.markers !== undefined && params.markers !== 0) {
      if ((card.type & CardType.LINK) === 0) return false
      if ((card.def & params.markers) !== params.markers) return false
    }
    if (params.cardPool !== undefined && params.cardPool !== 'any') return false
    return true
  }

  public search(params: CardSearchParams, fetchLimit: number): CardSearchResult {
    this.ensureLoaded()
    const matched = this.cards
      .filter((card) => this.matchKeyword(card, params) && this.matchFilters(card, params))
      .map(customCardToCdbCard)

    const keyword = (params.keyword ?? '').trim()
    if (keyword.length > 0) {
      const exact = matched.filter((c) => c.name === keyword)
      const rest = matched.filter((c) => c.name !== keyword)
      exact.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      rest.sort(compareCards(params))
      const ordered = [...exact, ...rest]
      return { cards: ordered.slice(0, fetchLimit), total: matched.length }
    }
    matched.sort(compareCards(params))
    return { cards: matched.slice(0, fetchLimit), total: matched.length }
  }

  public mergeSearchResults(
    cdbResult: CardSearchResult,
    params: CardSearchParams
  ): CardSearchResult {
    const limit = params.limit || 50
    const offset = params.offset || 0
    const custom = this.search(params, offset + limit)
    if (custom.cards.length === 0) return cdbResult

    const keyword = (params.keyword ?? '').trim()
    if (keyword.length > 0) {
      const combined = [...cdbResult.cards, ...custom.cards]
      const exact = combined.filter((c) => c.name === keyword)
      const rest = combined.filter((c) => c.name !== keyword)
      exact.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      rest.sort(compareCards(params))
      return {
        cards: [...exact, ...rest].slice(offset, offset + limit),
        total: cdbResult.total + custom.total
      }
    }
    return {
      cards: [...cdbResult.cards, ...custom.cards].slice(offset, offset + limit),
      total: cdbResult.total + custom.total
    }
  }

  public mergeCardsByIds(map: Record<number, CdbCard>, ids: number[]): Record<number, CdbCard> {
    this.ensureLoaded()
    for (const id of ids) {
      if (map[id]) continue
      const card = this.getById(id)
      if (card) map[id] = customCardToCdbCard(card)
    }
    return map
  }
}

export const customCardService = new CustomCardService()
