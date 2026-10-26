import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import {
  AppConfig,
  DEFAULT_FONT_SIZES,
  DEFAULT_WEB_SEARCH_CONFIG,
  normalizeFontSizes,
  normalizeWebSearchConfig
} from '@shared/index'
import { broadcastToWindows } from './broadcast'

function defaultConfig(): AppConfig {
  return {
    theme: 'system',
    fontSizes: { ...DEFAULT_FONT_SIZES },
    webSearch: { ...DEFAULT_WEB_SEARCH_CONFIG }
  }
}

export class ConfigService {
  private config: AppConfig = defaultConfig()
  private loaded = false
  private firstRun = false

  private get configPath(): string {
    return join(app.getPath('userData'), 'ygo-duel-editor-config.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    this.firstRun = !existsSync(this.configPath)
    if (this.firstRun) return
    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      this.config = { ...this.config, ...JSON.parse(raw) }
      this.config.fontSizes = normalizeFontSizes(this.config.fontSizes)
      this.config.webSearch = normalizeWebSearchConfig(this.config.webSearch)
    } catch (err) {
      console.error('[ConfigService] Failed to load config:', err)
    }
  }

  public isFirstRun(): boolean {
    this.ensureLoaded()
    return this.firstRun
  }

  public get(): AppConfig {
    this.ensureLoaded()
    return { ...this.config }
  }

  public save(partial: Partial<AppConfig>): boolean {
    this.ensureLoaded()
    try {
      this.config = { ...this.config, ...partial }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
      broadcastToWindows('config:updated')
      return true
    } catch (err) {
      console.error('[ConfigService] Failed to save config:', err)
      return false
    }
  }

  public reset(): boolean {
    this.ensureLoaded()
    this.config = { ...defaultConfig(), dataDirectory: this.config.dataDirectory }
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (err) {
      console.error('[ConfigService] Failed to reset config:', err)
      return false
    }
    this.firstRun = false
    broadcastToWindows('config:updated')
    return true
  }
}

export const configService = new ConfigService()
