import { create } from 'zustand'
import {
  AgentModelConfig,
  AgentStepProposal,
  AgentStreamEvent,
  DuelPuzzleState
} from '@shared/index'
import { useDuelStore } from './useDuelStore'

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
  toolCalls?: AgentToolCallItem[]
  proposals?: AgentStepProposal[]
  createdAt: number
}

interface AgentStoreState {
  isOpen: boolean
  activeTab: 'chat' | 'settings'
  isGenerating: boolean
  config: AgentModelConfig
  messages: AgentChatMessage[]
  cleanupListener: (() => void) | null
  width: number

  // Actions
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
  setActiveTab: (tab: 'chat' | 'settings') => void
  updateConfig: (patch: Partial<AgentModelConfig>) => void
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<boolean>
  clearMessages: () => void
  sendMessage: (prompt: string, boardState?: DuelPuzzleState) => Promise<void>
  abort: () => Promise<void>
  applyProposalsToDuel: (proposals: AgentStepProposal[]) => void
}

const DEFAULT_CONFIG: AgentModelConfig = {
  provider: 'custom-openai',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  systemPrompt: '',
  enableReasoning: false
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  isOpen: false,
  width: 440,
  activeTab: 'chat',
  isGenerating: false,
  config: { ...DEFAULT_CONFIG },
  messages: [],
  cleanupListener: null,

  setOpen: (open) => {
    set({ isOpen: open })
    if (open && !get().cleanupListener && window.api?.onAgentEvent) {
      // 注册事件流监听器
      const cleanup = window.api.onAgentEvent((event: AgentStreamEvent) => {
        const { messages } = get()
        const lastMsg = messages[messages.length - 1]

        if (!lastMsg || lastMsg.role !== 'assistant') return

        if (event.type === 'text_delta') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, content: m.content + event.delta } : m
            )
          })
        } else if (event.type === 'thinking_delta') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, thought: (m.thought || '') + event.delta } : m
            )
          })
        } else if (event.type === 'tool_call_start') {
          const currentTools = lastMsg.toolCalls || []
          const existing = currentTools.find((t) => t.id === event.id)
          const updated = existing
            ? currentTools.map((t) => (t.id === event.id ? { ...t, ...event } : t))
            : [...currentTools, { id: event.id, toolName: event.toolName, params: event.params }]
          set({
            messages: messages.map((m) => (m.id === lastMsg.id ? { ...m, toolCalls: updated } : m))
          })
        } else if (event.type === 'tool_call_end') {
          const currentTools = lastMsg.toolCalls || []
          const updated = currentTools.map((t) =>
            t.id === event.id ? { ...t, resultSummary: event.resultSummary } : t
          )
          set({
            messages: messages.map((m) => (m.id === lastMsg.id ? { ...m, toolCalls: updated } : m))
          })
        } else if (event.type === 'proposals_ready') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, proposals: event.proposals } : m
            )
          })
        } else if (event.type === 'done') {
          set({
            isGenerating: false,
            messages: messages.map((m) =>
              m.id === lastMsg.id
                ? {
                    ...m,
                    content: event.fullText || m.content,
                    proposals: event.proposals || m.proposals
                  }
                : m
            )
          })
        } else if (event.type === 'error') {
          set({
            isGenerating: false,
            messages: messages.map((m) =>
              m.id === lastMsg.id
                ? {
                    ...m,
                    content: m.content
                      ? `${m.content}\n\n[发生错误: ${event.message}]`
                      : `[请求失败: ${event.message}]`
                  }
                : m
            )
          })
        }
      })

      set({ cleanupListener: cleanup })
    }
  },

  setWidth: (width) => {
    set({ width: Math.max(340, Math.min(width, 700)) })
  },

  setActiveTab: (activeTab) => set({ activeTab }),

  updateConfig: (patch) => {
    set((state) => ({ config: { ...state.config, ...patch } }))
  },

  loadConfig: async () => {
    if (!window.api?.getConfig) return
    try {
      const cfg = await window.api.getConfig()
      if (cfg.agentConfig) {
        set({ config: { ...DEFAULT_CONFIG, ...cfg.agentConfig } })
      }
    } catch (err) {
      console.error('[useAgentStore] loadConfig failed:', err)
    }
  },

  saveConfig: async () => {
    if (!window.api?.saveConfig) return false
    try {
      const success = await window.api.saveConfig({ agentConfig: get().config })
      return success
    } catch (err) {
      console.error('[useAgentStore] saveConfig failed:', err)
      return false
    }
  },

  clearMessages: () => set({ messages: [] }),

  sendMessage: async (prompt, boardState) => {
    if (!prompt.trim() || get().isGenerating) return

    const userMessage: AgentChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      createdAt: Date.now()
    }

    const assistantMessage: AgentChatMessage = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      thought: '',
      toolCalls: [],
      proposals: [],
      createdAt: Date.now()
    }

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isGenerating: true
    }))

    try {
      if (!window.api?.agentSendMessage) {
        throw new Error('当前环境不支持 AI 顾问调用')
      }

      const res = await window.api.agentSendMessage({
        prompt,
        boardState,
        configOverride: get().config
      })

      if (!res.success) {
        set((state) => ({
          isGenerating: false,
          messages: state.messages.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: `[调用失败: ${res.error || '未知错误'}]`
                }
              : m
          )
        }))
      } else {
        set((state) => ({
          isGenerating: false,
          messages: state.messages.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: res.content || m.content,
                  thought: res.thought || m.thought,
                  proposals: res.proposals || m.proposals
                }
              : m
          )
        }))
      }
    } catch (err: unknown) {
      set((state) => ({
        isGenerating: false,
        messages: state.messages.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `[连接失败: ${err instanceof Error ? err.message : String(err)}]`
              }
            : m
        )
      }))
    }
  },

  abort: async () => {
    if (window.api?.agentAbort) {
      await window.api.agentAbort()
    }
    set({ isGenerating: false })
  },

  applyProposalsToDuel: (proposals) => {
    if (!proposals || proposals.length === 0) return
    const { addStep, state } = useDuelStore.getState()
    const initialTurnPlayer = state.turnPlayer ?? 0

    for (const p of proposals) {
      const turnPlayer = p.actionPlayer !== undefined ? p.actionPlayer : initialTurnPlayer
      addStep({
        turn: p.turn || 1,
        phase: p.phase,
        turnPlayer,
        actionPlayer: p.actionPlayer,
        actionType: p.actionType,
        cardCode: p.cardCode,
        cardName: p.cardName,
        speaker: p.speaker,
        dialogue: p.dialogue,
        innerThoughts: p.innerThoughts,
        description: p.description,
        chainIndex: p.chainIndex,
        lpChange: p.lpChange
      })
    }
  }
}))
