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

  extraCdbPaths?: string[]

  disabledCdbPaths?: string[]

  theme: 'dark' | 'light' | 'system'

  favorites?: number[]

  cardImageOverrides?: Record<string, number>

  agentConfig?: AgentModelConfig

  recentProjectPaths?: string[]

  dataDirectory?: string

  projectSeries?: string[]

  timingPolicy?: TimingPolicy
}

export type SettingsSectionId = 'appearance' | 'paths' | 'model-settings' | 'chat'
