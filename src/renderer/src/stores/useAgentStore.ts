import { create } from 'zustand'
import {
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderPreset,
  AgentStepProposal,
  AgentStreamEvent,
  DuelPuzzleState,
  createProviderFromPreset,
  normalizeAgentApiFormat,
  normalizeAgentConfig,
  syncActiveFields
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
  /** 过程状态提示（重试、超时、会话重置等非正文信息） */
  status?: string
  toolCalls?: AgentToolCallItem[]
  proposals?: AgentStepProposal[]
  createdAt: number
}

interface AgentStoreState {
  isOpen: boolean
  isGenerating: boolean
  config: AgentModelConfig
  presets: AgentProviderPreset[]
  messages: AgentChatMessage[]
  cleanupListener: (() => void) | null
  width: number

  // Actions
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
  updateConfig: (patch: Partial<AgentModelConfig>) => void
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<boolean>
  loadPresets: () => Promise<AgentProviderPreset[]>
  upsertProvider: (provider: AgentProviderConfig) => void
  removeProvider: (providerId: string) => void
  selectModel: (providerId: string, modelId: string) => void
  sendMessage: (prompt: string, boardState?: DuelPuzzleState) => Promise<void>
  abort: () => Promise<void>
  /** 丢弃 AI 会话并重开（同时清空本地消息） */
  resetSession: () => Promise<void>
  applyProposalsToDuel: (proposals: AgentStepProposal[]) => void
}

const DEFAULT_CONFIG: AgentModelConfig = {
  providers: [],
  provider: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  apiFormat: 'openai-chat-completions',
  systemPrompt: '',
  enableReasoning: false
}

function buildProvidersFromLegacy(
  raw: AgentModelConfig,
  presets: AgentProviderPreset[]
): AgentProviderConfig[] {
  const baseUrl = (raw.baseUrl || '').trim()
  if (!baseUrl) return []
  const preset =
    presets.find((p) => p.baseUrl === baseUrl) ?? presets.find((p) => p.id === raw.provider)
  const model = (raw.model || '').trim()

  if (preset) {
    const provider = createProviderFromPreset(preset)
    provider.apiKey = raw.apiKey || ''
    provider.baseUrl = baseUrl
    provider.enabled = true
    if (model && !provider.models.some((m) => m.id === model)) {
      provider.models.push({ id: model, enabled: true, custom: true })
    }
    return [provider]
  }

  return [
    {
      id: raw.provider || `custom-${Date.now().toString(36)}`,
      name: raw.provider === 'custom-openai' ? '自定义供应商' : raw.provider || '自定义供应商',
      baseUrl,
      apiFormat: normalizeAgentApiFormat(raw.apiFormat),
      apiKey: raw.apiKey || '',
      enabled: true,
      models: model ? [{ id: model, enabled: true, custom: true }] : []
    }
  ]
}

/** 跨窗口配置广播只订阅一次（设置窗口改配置后，主窗口会话面板同步刷新） */
let configUpdatedSubscribed = false

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  isOpen: false,
  width: 440,
  isGenerating: false,
  config: { ...DEFAULT_CONFIG },
  presets: [],
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
        } else if (event.type === 'status') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, status: event.message } : m
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
                    proposals: event.proposals || m.proposals,
                    status: undefined
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
                    status: undefined,
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

  updateConfig: (patch) => {
    set((state) => ({ config: { ...state.config, ...patch } }))
  },

  loadPresets: async () => {
    try {
      if (!window.api?.agentGetProviderPresets) return get().presets
      const presets = await window.api.agentGetProviderPresets()
      set({ presets })
      return presets
    } catch (err) {
      console.error('[useAgentStore] loadPresets failed:', err)
      return get().presets
    }
  },

  loadConfig: async () => {
    if (!window.api?.getConfig) return
    if (!configUpdatedSubscribed && window.api.onConfigUpdated) {
      configUpdatedSubscribed = true
      window.api.onConfigUpdated(() => {
        void get().loadConfig()
      })
    }
    try {
      const presets = await get().loadPresets()
      const cfg = await window.api.getConfig()
      const raw = cfg.agentConfig
      if (!raw) return

      const base = { ...DEFAULT_CONFIG, ...raw }
      const providers =
        base.providers && base.providers.length > 0
          ? base.providers
          : buildProvidersFromLegacy(base, presets)

      const normalized = normalizeAgentConfig({ ...base, providers })
      set({ config: normalized })

      // 自愈历史脏配置：迁移或清洗后与磁盘不一致时立即回写
      if (JSON.stringify(normalized) !== JSON.stringify(raw)) {
        void get().saveConfig()
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

  upsertProvider: (provider) => {
    const { config } = get()
    const providers = config.providers ?? []
    const exists = providers.some((p) => p.id === provider.id)
    const nextProviders = exists
      ? providers.map((p) => (p.id === provider.id ? provider : p))
      : [...providers, provider]
    const next = syncActiveFields({ ...config, providers: nextProviders })
    set({ config: next })
    void get().saveConfig()
  },

  removeProvider: (providerId) => {
    const { config } = get()
    const nextProviders = (config.providers ?? []).filter((p) => p.id !== providerId)
    const next = syncActiveFields({
      ...config,
      providers: nextProviders,
      provider: config.provider === providerId ? undefined : config.provider
    })
    set({ config: next })
    void get().saveConfig()
  },

  selectModel: (providerId, modelId) => {
    const { config } = get()
    const next = syncActiveFields(config, { providerId, modelId })
    set({ config: next })
    void get().saveConfig()
  },

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

  resetSession: async () => {
    try {
      await window.api?.agentResetSession?.()
    } catch (err) {
      console.error('[useAgentStore] resetSession failed:', err)
    }
    set({ messages: [], isGenerating: false })
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
