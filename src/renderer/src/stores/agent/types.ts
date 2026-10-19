import type { AgentBoardSetupProposal, AgentStepProposal } from '@shared/index'
import type { ChatSlice } from './chatSlice'
import type { ConfigSlice } from './configSlice'
import type { PanelSlice } from './panelSlice'

export interface AgentToolCallItem {
  id: string
  toolName: string
  params: Record<string, unknown>
  resultSummary?: string
}

export interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thought?: string

  status?: string
  toolCalls?: AgentToolCallItem[]
  proposals?: AgentStepProposal[]

  boardSetup?: AgentBoardSetupProposal

  error?: string

  boardSetupApplied?: boolean

  attachedCards?: { id: number; name: string }[]

  textSource?: { title: string; wordCount?: number; textId?: string; chapterIds?: string[] }
  createdAt: number
}

export type AgentStore = PanelSlice & ConfigSlice & ChatSlice
