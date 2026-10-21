import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import { configService } from './configService'
import { cdbService } from '../db/cdbService'
import { customCardService } from './customCardService'
import { isGameProgramName } from './gameContent'

const NEGATIVE_PATH_TTL_MS = 5_000
const MAX_PATH_CACHE_ENTRIES = 60_000
const DOWNLOAD_MISS_TTL_MS = 5 * 60_000
const DOWNLOAD_TIMEOUT_MS = 8_000
const DOWNLOAD_URLS = [
  (code: number) => `http://1.15.14.207:3000/knight/pics/raw/branch/main/${code}.jpg`,
  (code: number) => `http://1.15.14.207:3000/knight/pics/raw/branch/main/${code}.png`,
  (code: number) => `http://1.15.14.207:3000/knight/hdpics/raw/branch/main/${code}.jpg`,
  (code: number) => `http://1.15.14.207:3000/knight/hdpics/raw/branch/main/${code}.png`,
  (code: number) =>
    `http://1.15.14.207:3000/knight/Rush-HD-Pictures/raw/branch/main/pics/${code}.png`
]

export class ImageService {
  private configSignature = ''
  private picsDirs: string[] | null = null
  private pathCache = new Map<string, { path: string | null; at: number }>()
  private downloadCacheDirPath: string | null = null
  private downloadMisses = new Map<number, number>()
  private downloads = new Map<number, Promise<string | null>>()

  public invalidateCardImageCache(): void {
    this.picsDirs = null
    this.pathCache.clear()
  }

  private downloadCacheDir(): string {
    if (!this.downloadCacheDirPath) {
      this.downloadCacheDirPath = join(app.getPath('userData'), 'card-images')
    }
    return this.downloadCacheDirPath
  }

  private findDownloadedImage(code: number): string | null {
    const dir = this.downloadCacheDir()
    for (const ext of ['.jpg', '.png']) {
      const file = join(dir, `${code}${ext}`)
      if (existsSync(file)) return file
    }
    return null
  }

  public async downloadCardImage(code: number): Promise<string | null> {
    if (!code || code <= 0) return null
    const cached = this.findDownloadedImage(code)
    if (cached) return cached
    const missedAt = this.downloadMisses.get(code)
    if (missedAt && Date.now() - missedAt < DOWNLOAD_MISS_TTL_MS) return null
    const pending = this.downloads.get(code)
    if (pending) return pending
    const task = this.fetchCardImage(code).finally(() => this.downloads.delete(code))
    this.downloads.set(code, task)
    return task
  }

  private async fetchCardImage(code: number): Promise<string | null> {
    for (const url of DOWNLOAD_URLS) {
      try {
        const response = await fetch(url(code), {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length < 16) continue
        const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        const isPng =
          buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
        if (!isJpeg && !isPng) continue
        const dir = this.downloadCacheDir()
        mkdirSync(dir, { recursive: true })
        const file = join(dir, `${code}${isJpeg ? '.jpg' : '.png'}`)
        writeFileSync(file, buffer)
        this.downloadMisses.delete(code)
        this.invalidateCardImageCache()
        return file
      } catch {}
    }
    this.downloadMisses.set(code, Date.now())
    return null
  }

  private syncConfigSignature(): void {
    const cfg = configService.get()
    const signature = JSON.stringify([
      cfg.gameType ?? '',
      cfg.cardImageDirectory ?? '',
      cfg.gameDirectory ?? '',
      cfg.cdbPath ?? '',
      cfg.extraCdbPaths ?? [],
      cfg.disabledCdbPaths ?? []
    ])
    if (signature === this.configSignature) return
    this.configSignature = signature
    this.invalidateCardImageCache()
  }

  public detectGameDirectory(targetPath: string): string | null {
    if (!targetPath) return null

    let dir = targetPath
    try {
      if (targetPath.endsWith('.cdb') || targetPath.endsWith('.exe')) {
        dir = dirname(targetPath)
      }

      if (existsSync(join(dir, 'pics'))) {
        return dir
      }

      const parentDir = dirname(dir)
      if (parentDir && parentDir !== dir && existsSync(join(parentDir, 'pics'))) {
        return parentDir
      }

      if (existsSync(join(dir, 'cards.cdb')) || existsSync(join(dir, 'MDPro3.exe'))) {
        return dir
      }

      try {
        for (const entry of readdirSync(dir)) {
          if (isGameProgramName(entry)) {
            return dir
          }
        }
      } catch {
        return null
      }
    } catch (err) {
      console.error('[ImageService] detectGameDirectory error:', err)
    }

    return null
  }

  private collectPicsDirs(baseDir: string | undefined, out: string[]): void {
    if (!baseDir) return
    const candidates = [
      join(baseDir, 'pics'),
      join(baseDir, 'expansions', 'pics'),
      join(baseDir, 'Picture', 'Art'),
      join(baseDir, 'hdpics', 'jp')
    ]
    for (const dir of candidates) {
      if (existsSync(dir) && !out.includes(dir)) out.push(dir)
    }
  }

  private hasNumericImages(dir: string): boolean {
    try {
      return readdirSync(dir).some((entry) => /^\d+\.(jpe?g|png)$/i.test(entry))
    } catch {
      return false
    }
  }

  public classifyCardImageDir(dir: string): 'full' | 'art' | 'none' {
    if (existsSync(join(dir, 'pics')) || existsSync(join(dir, 'expansions', 'pics'))) {
      return 'full'
    }
    if (existsSync(join(dir, 'Picture', 'Art'))) return 'art'
    if (this.hasNumericImages(dir)) return 'full'
    return 'none'
  }

  public resolveCardImageDir(dir: string): string | null {
    if (existsSync(join(dir, 'pics'))) return join(dir, 'pics')
    if (existsSync(join(dir, 'expansions', 'pics'))) return join(dir, 'expansions', 'pics')
    if (existsSync(join(dir, 'Picture', 'Art'))) return join(dir, 'Picture', 'Art')
    if (this.hasNumericImages(dir)) return dir
    return null
  }

  public detectPicsDirsFromCdb(cdbPath: string): string[] {
    const dirs: string[] = []
    let dir = dirname(cdbPath)
    for (let depth = 0; depth < 6; depth++) {
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
      this.collectPicsDirs(dir, dirs)
    }
    return dirs
  }

  public getPicsDirectories(): string[] {
    this.syncConfigSignature()
    if (this.picsDirs) return this.picsDirs

    const cfg = configService.get()
    const dirs: string[] = []

    const downloadDir = this.downloadCacheDir()
    if (existsSync(downloadDir)) dirs.push(downloadDir)

    if (cfg.gameType === 'mdpro3' && cfg.cardImageDirectory && existsSync(cfg.cardImageDirectory)) {
      dirs.push(cfg.cardImageDirectory)
    }

    this.collectPicsDirs(cfg.gameDirectory, dirs)

    if (cfg.cdbPath) {
      const cdbDir = dirname(cfg.cdbPath)
      this.collectPicsDirs(cdbDir, dirs)
      this.collectPicsDirs(dirname(cdbDir), dirs)
    }

    const disabled = cfg.disabledCdbPaths || []
    const activeExtras = (cfg.extraCdbPaths || []).filter((p) => !disabled.includes(p))
    for (const extraPath of activeExtras) {
      for (const dir of this.detectPicsDirsFromCdb(extraPath)) {
        if (!dirs.includes(dir)) dirs.push(dir)
      }
    }

    this.picsDirs = dirs
    return dirs
  }

  public findCardImagePath(code: number, small = false): string | null {
    if (!code || code <= 0) return null

    this.syncConfigSignature()
    const cacheKey = `${code}:${small ? 1 : 0}`
    const cached = this.pathCache.get(cacheKey)
    if (cached && (cached.path !== null || Date.now() - cached.at < NEGATIVE_PATH_TTL_MS)) {
      return cached.path
    }

    const path = this.resolveCardImagePath(code, small)
    if (this.pathCache.size >= MAX_PATH_CACHE_ENTRIES) this.pathCache.clear()
    this.pathCache.set(cacheKey, { path, at: Date.now() })
    return path
  }

  private resolveCardImagePath(code: number, small: boolean): string | null {
    const customPath = customCardService.findImagePath(code)
    if (customPath) return customPath

    const picsDirs = this.getPicsDirectories()
    if (picsDirs.length === 0) return null

    const findForCode = (id: number): string | null => {
      for (const dir of picsDirs) {
        const thumbJpg = join(dir, 'thumbnail', `${id}.jpg`)
        const thumbPng = join(dir, 'thumbnail', `${id}.png`)
        const fullJpg = join(dir, `${id}.jpg`)
        const fullPng = join(dir, `${id}.png`)

        if (small) {
          if (existsSync(thumbJpg)) return thumbJpg
          if (existsSync(thumbPng)) return thumbPng
          if (existsSync(fullJpg)) return fullJpg
          if (existsSync(fullPng)) return fullPng
        } else {
          if (existsSync(fullJpg)) return fullJpg
          if (existsSync(fullPng)) return fullPng
          if (existsSync(thumbJpg)) return thumbJpg
          if (existsSync(thumbPng)) return thumbPng
        }
      }
      return null
    }

    const overrideId = configService.get().cardImageOverrides?.[String(code)]
    if (overrideId && overrideId > 0 && overrideId !== code) {
      const overridePath = findForCode(overrideId)
      if (overridePath) return overridePath
    }

    const directPath = findForCode(code)
    if (directPath) return directPath

    const aliasId =
      cdbService.getCardById(code)?.alias ?? configService.get().cardImageOverrides?.[String(code)]
    if (aliasId && aliasId > 0 && aliasId !== code) {
      const aliasPath = findForCode(aliasId)
      if (aliasPath) return aliasPath
    }

    return null
  }

  public setCardImageOverride(code: number, variantCode: number | null): void {
    if (!Number.isFinite(code) || code <= 0) return
    const cfg = configService.get()
    const overrides: Record<string, number> = { ...(cfg.cardImageOverrides ?? {}) }
    if (variantCode === null || variantCode === code) delete overrides[String(code)]
    else overrides[String(code)] = variantCode
    configService.save({ cardImageOverrides: overrides })
  }
}

export const imageService = new ImageService()
