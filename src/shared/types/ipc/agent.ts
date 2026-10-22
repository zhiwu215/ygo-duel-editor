import { DuelPuzzleState } from '../duel'
import { AgentBoardSetupProposal, AgentStepProposal } from './agentProposal'
import type { AgentReasoningEffort, AgentReasoningEfforts } from '../../constants/reasoningEffort'
import type { AgentModelInput } from '../../constants/modelInput'

export type AgentApiFormat =
  | 'openai-chat-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'
  | 'google-vertex'
  | 'azure-openai-responses'
  | 'bedrock-converse-stream'
  | 'openai-codex-responses'
  | 'mistral-conversations'
  | 'pi-messages'

export interface AgentProviderModelConfig {
  id: string
  name?: string
  input?: AgentModelInput[]
  contextWindow?: number
  maxTokens?: number
  reasoningEfforts?: AgentReasoningEfforts
  supportsStructuredOutput?: boolean
  supportsMidConversationSystem?: boolean
}

export interface AgentProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  apiKey: string
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
  reasoningEffort?: AgentReasoningEffort

  defaultsVersion?: number
}

export interface AgentProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: AgentApiFormat
  note?: string

  models?: AgentProviderModelConfig[]
}

export type AgentStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; toolName: string; params: Record<string, unknown> }
  | {
      type: 'tool_call_end'
      id: string
      toolName: string
      resultSummary: string
      details?: AgentWebToolDetails
    }
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

  question?: string

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
  contextWindow?: number
  maxTokens?: number
  input?: AgentModelInput[]
}

export interface AgentWebSource {
  url: string
  title?: string
  snippet?: string
  publishedAt?: string
}

export interface AgentWebSearchDetails {
  kind: 'search'
  answer?: string
  sources: AgentWebSource[]
  truncated: boolean
}

export interface AgentWebFetchDetails {
  kind: 'fetch'
  url: string
  statusCode: number
  truncated: boolean
}

export type AgentWebToolDetails = AgentWebSearchDetails | AgentWebFetchDetails

export interface AgentFetchModelsParams {
  baseUrl: string
  apiKey: string
}

export interface AgentFetchModelsResult {
  success: boolean
  models?: AgentModelInfo[]
  error?: string
}
