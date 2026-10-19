import { AgentModelConfig } from './agent'
import { TimingPolicy } from '../../engine/protocol'

export interface DataDirectoryResult {
  directory: string
  migrated: boolean
  error?: string
}

export interface AppConfig {
  gameDirectory?: string

  cdbPath?: string

  extraCdbPaths?: string[]

  disabledCdbPaths?: string[]

  theme: 'dark' | 'light' | 'system'

  favorites?: number[]

  cardImageOverrides?: Record<string, number>

  agentConfig?: AgentModelConfig

  recentProjectPaths?: string[]

  dataDirectory?: string

  projectsDirectory?: string

  deckLoadDrawCount?: 0 | 5

  projectSeries?: string[]

  ruleCheckEnabled?: boolean

  timingPolicy?: TimingPolicy
}

export type SettingsSectionId = 'appearance' | 'paths' | 'duel' | 'model-settings' | 'chat'
