import { DuelPuzzleState } from '../duel'
import { AgentBoardSetupProposal, AgentStepProposal } from './agentProposal'

export type AgentApiFormat = 'openai-chat-completions' | 'anthropic-messages' | 'openai-responses'

export interface AgentProviderModelConfig {
  id: string
  name?: string
  supportsReasoning?: boolean
  supportsVision?: boolean
  contextWindow?: number

  maxTokens?: number

  supportsStructuredOutput?: boolean

  supportsMidConversationSystem?: boolean
  enabled: boolean
  custom?: boolean
}

export interface AgentProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKey: string
  enabled: boolean
  presetId?: string
  models: AgentProviderModelConfig[]
}

export interface AgentModelConfig {
  providers?: AgentProviderConfig[]
  provider?: string
  baseUrl: string
  apiKey: string
  model: string
  apiFormat?: AgentApiFormat
  systemPrompt?: string
  enableReasoning?: boolean
  contextWindow?: number
  maxTokens?: number

  providersSeeded?: boolean
}

export type AgentProviderCategory = 'cn' | 'global' | 'local'

export interface AgentProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKeyUrl?: string

  category?: AgentProviderCategory
}

export type AgentStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; toolName: string; params: Record<string, unknown> }
  | { type: 'tool_call_end'; id: string; toolName: string; resultSummary: string }
  | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
  | { type: 'board_setup_ready'; setup: AgentBoardSetupProposal }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string }
  | {
      type: 'done'
      fullText: string
      proposals: AgentStepProposal[]

      boardSetup?: AgentBoardSetupProposal
    }

export interface AgentTextSourceRef {
  textId?: string

  chapterId?: string

  chapterIds?: string[]

  title: string

  wordCount?: number

  content?: string
}

export interface AgentHandoffRequest {
  prompt: string

  textSource?: AgentTextSourceRef
}

export interface AgentSendMessageParams {
  prompt: string

  boardState?: DuelPuzzleState

  textSource?: AgentTextSourceRef

  configOverride?: Partial<AgentModelConfig>
}

export interface AgentSendMessageResult {
  success: boolean

  content?: string

  thought?: string

  proposals?: AgentStepProposal[]

  boardSetup?: AgentBoardSetupProposal

  error?: string
}

export interface AgentModelInfo {
  id: string
  ownedBy?: string
  name?: string
  supportsReasoning?: boolean
  supportsVision?: boolean
  contextWindow?: number
}

export interface AgentFetchModelsParams {
  baseUrl: string
  apiKey: string
}

export interface AgentFetchModelsResult {
  success: boolean
  models?: AgentModelInfo[]
  error?: string
}
