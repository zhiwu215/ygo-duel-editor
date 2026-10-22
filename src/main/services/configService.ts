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

export class ConfigService {
  private configPath: string
  private config: AppConfig = {
    theme: 'system',
    fontSizes: DEFAULT_FONT_SIZES,
    webSearch: { ...DEFAULT_WEB_SEARCH_CONFIG }
  }

  constructor() {
    this.configPath = join(app.getPath('userData'), 'ygo-duel-editor-config.json')
    this.load()
  }

  private load(): void {
    try {
      if (existsSync(this.configPath)) {
        const raw = readFileSync(this.configPath, 'utf-8')
        this.config = { ...this.config, ...JSON.parse(raw) }
        this.config.fontSizes = normalizeFontSizes(this.config.fontSizes)
        this.config.webSearch = normalizeWebSearchConfig(this.config.webSearch)
      }
    } catch (err) {
      console.error('[ConfigService] Failed to load config:', err)
    }
  }

  public get(): AppConfig {
    return { ...this.config }
  }

  public save(partial: Partial<AppConfig>): boolean {
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
}

export const configService = new ConfigService()
