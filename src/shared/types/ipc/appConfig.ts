import { AgentModelConfig } from './agent'
import { TimingPolicy } from '../../engine/protocol'
import type { FontSizes } from '../../constants/fontSize'
import type { WebSearchConfig } from '../../engine/webSearch'
import type { FavoriteCategory } from '../favorites'

export interface DataDirectoryResult {
  directory: string
  migrated: boolean
  error?: string
}

export interface GamePathStatus {
  gameDirectory?: string
  directoryExists: boolean
  cdbExists: boolean
}

export interface Mdpro3DirectoryResult {
  success: boolean
  canceled?: boolean
  directory?: string
  error?: string
}

export interface AppConfig {
  gameDirectory?: string

  gameType?: 'ygopro' | 'mdpro3'

  mdpro3Directory?: string

  gameLanguage?: string

  preferredLanguage?: string

  gameLanguageByDirectory?: Record<string, string>

  cdbPath?: string

  banlistName?: string

  extraCdbPaths?: string[]

  disabledCdbPaths?: string[]

  theme: 'dark' | 'light' | 'system'

  fontSizes: FontSizes

  favorites?: number[]

  favoriteCategories?: FavoriteCategory[]

  cardImageOverrides?: Record<string, number>

  agentConfig?: AgentModelConfig

  webSearch?: WebSearchConfig

  recentProjectPaths?: string[]

  dataDirectory?: string

  cardImageDirectory?: string

  duelTestSettings?: DuelTestSettings

  cardNameWrapper?: string

  timingPolicy?: TimingPolicy
}

export type DuelTestDeckOrder = 'fixed' | 'random'

export interface DuelTestSettings {
  deckOrder: DuelTestDeckOrder
}

export const DEFAULT_DUEL_TEST_SETTINGS: DuelTestSettings = {
  deckOrder: 'fixed'
}

export type SettingsSectionId = 'general' | 'paths' | 'duel-test' | 'model-settings' | 'web-search'
