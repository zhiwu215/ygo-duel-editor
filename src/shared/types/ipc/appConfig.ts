import { AgentModelConfig } from './agent'
import { TimingPolicy } from '../../engine/protocol'

export interface DataDirectoryResult {
  directory: string
  migrated: boolean
  error?: string
}

export interface AppConfig {
  gameDirectory?: string

  gameType?: 'ygopro' | 'mdpro3'

  gameLanguage?: string

  preferredLanguage?: string

  cdbPath?: string

  banlistName?: string

  extraCdbPaths?: string[]

  disabledCdbPaths?: string[]

  theme: 'dark' | 'light' | 'system'

  favorites?: number[]

  cardImageOverrides?: Record<string, number>

  agentConfig?: AgentModelConfig

  recentProjectPaths?: string[]

  dataDirectory?: string

  cardImageDirectory?: string

  duelTestSettings?: DuelTestSettings

  projectSeries?: string[]

  timingPolicy?: TimingPolicy
}

export type DuelTestDeckOrder = 'fixed' | 'random'

export interface DuelTestSettings {
  deckOrder: DuelTestDeckOrder
}

export const DEFAULT_DUEL_TEST_SETTINGS: DuelTestSettings = {
  deckOrder: 'fixed'
}

export type SettingsSectionId = 'appearance' | 'paths' | 'duel-test' | 'model-settings' | 'chat'
