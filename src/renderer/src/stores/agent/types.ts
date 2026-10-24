import type { AgentWebToolDetails } from '@shared/index'
import type { ChatSlice } from './chatSlice'
import type { ConfigSlice } from './configSlice'

export interface AgentToolCallItem {
  id: string
  toolName: string
  params: Record<string, unknown>
  resultSummary?: string
  details?: AgentWebToolDetails
}

export interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thought?: string

  status?: string
  error?: string
  toolCalls?: AgentToolCallItem[]

  attachedCards?: { id: number; name: string; type?: number }[]

  textSource?: { title: string; wordCount?: number; textId?: string; chapterIds?: string[] }
  createdAt: number
}

export type AgentStore = ConfigSlice & ChatSlice
