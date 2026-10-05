import { create } from 'zustand'
import {
  AGENT_BOARD_FACING_TO_POSITION,
  AGENT_BOARD_ZONE_TO_LOCATION,
  AgentBoardCardPlacement,
  AgentBoardSetupProposal,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderPreset,
  AgentStepProposal,
  AgentStreamEvent,
  CdbCard,
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
  /** AI 复盘出的场面布局提案，待用户在预览卡中确认后才写入决斗场 */
  boardSetup?: AgentBoardSetupProposal
  /** 该条布局提案是否已被用户确认应用 */
  boardSetupApplied?: boolean
  /** 该条消息引用过的卡片（仅用于在记录中还原「AI 当时看到了什么」，不拼进 content） */
  attachedCards?: { id: number; name: string }[]
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
  reorderProviders: (fromId: string, toId: string) => void
  selectModel: (providerId: string, modelId: string) => void
  /**
   * 发送消息。`prompt` 是用户原始输入（用于对话记录展示），
   * `injectedPrompt` 是拼入引用卡片等上下文后真正发给模型的内容；
   * `attachedCards` 仅记录引用了哪些卡，供回看时展示，不进入正文。
   */
  sendMessage: (
    prompt: string,
    boardState?: DuelPuzzleState,
    injectedPrompt?: string,
    attachedCards?: { id: number; name: string }[]
  ) => Promise<void>
  abort: () => Promise<void>
  /** 丢弃 AI 会话并重开（同时清空本地消息） */
  resetSession: () => Promise<void>
  applyProposalsToDuel: (proposals: AgentStepProposal[]) => void
  /** 把预览卡中确认过的场面布局写入决斗场 */
  applyBoardSetup: (setup: AgentBoardSetupProposal) => Promise<{ ok: boolean; error?: string }>
  /** 把某条消息的布局提案标记为已应用（预览卡按钮态） */
  markBoardSetupApplied: (messageId: string) => void
  /** 丢弃某条消息的布局提案（用户点「放弃」） */
  dismissBoardSetup: (messageId: string) => void
}

/**
 * 模型没给表示形式时的区域惯例。
 *
 * 与 `useDuelStore.addCardToZone` 的默认值保持一致，避免同一次布局里
 * 「显式填了的卡」和「没填的卡」表现规则不一致。
 */
function defaultFacingForZone(zone: AgentBoardCardPlacement['location']): number {
  switch (zone) {
    case 'SZONE':
    case 'HAND':
    case 'DECK':
    case 'EXTRA':
      return AGENT_BOARD_FACING_TO_POSITION.FACEDOWN
    case 'GRAVE':
    case 'REMOVED':
      return AGENT_BOARD_FACING_TO_POSITION.FACEUP
    default:
      return AGENT_BOARD_FACING_TO_POSITION.FACEUP_ATTACK
  }
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

/**
 * 首次使用时预置的常用供应商。
 * 只预置「空壳」（预设的 baseUrl + API 格式，没有 Key 和模型），
 * 用户填上 API Key 才算配置完成；删掉后由 providersSeeded 兜住，不会再自动补回。
 */
const DEFAULT_PROVIDER_PRESET_IDS = ['deepseek', 'moonshot', 'dashscope']

function seedDefaultProviders(
  providers: AgentProviderConfig[],
  presets: AgentProviderPreset[]
): AgentProviderConfig[] {
  const known = new Set(providers.map((p) => p.presetId ?? p.id))
  const added = DEFAULT_PROVIDER_PRESET_IDS.flatMap((id) => {
    if (known.has(id)) return []
    const preset = presets.find((p) => p.id === id)
    return preset ? [createProviderFromPreset(preset)] : []
  })
  return added.length > 0 ? [...providers, ...added] : providers
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
        } else if (event.type === 'board_setup_ready') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, boardSetup: event.setup, boardSetupApplied: false } : m
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
                    boardSetup: event.boardSetup || m.boardSetup,
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

      const base = { ...DEFAULT_CONFIG, ...raw }
      let providers =
        base.providers && base.providers.length > 0
          ? base.providers
          : buildProvidersFromLegacy(base, presets)

      // 预置常用供应商：只在拿到预设列表后执行一次。
      // 没有 providersSeeded 标记 = 老配置或全新安装，补上缺的那几家；
      // 标记置位后就不再插手，用户删掉的不会自己回来。
      const canSeed = presets.length > 0
      if (canSeed && !base.providersSeeded) {
        providers = seedDefaultProviders(providers, presets)
      }

      const normalized = normalizeAgentConfig({
        ...base,
        providers,
        providersSeeded: base.providersSeeded || canSeed
      })
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

  reorderProviders: (fromId: string, toId: string) => {
    const { config } = get()
    const providers = config.providers ?? []
    const fromIndex = providers.findIndex((p) => p.id === fromId)
    const toIndex = providers.findIndex((p) => p.id === toId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    const nextProviders = [...providers]
    const [moved] = nextProviders.splice(fromIndex, 1)
    nextProviders.splice(toIndex, 0, moved)
    const next = syncActiveFields({ ...config, providers: nextProviders })
    set({ config: next })
    void get().saveConfig()
  },

  selectModel: (providerId, modelId) => {
    const { config } = get()
    const next = syncActiveFields(config, { providerId, modelId })
    set({ config: next })
    void get().saveConfig()
  },

  sendMessage: async (prompt, boardState, injectedPrompt, attachedCards) => {
    if (!prompt.trim() && !injectedPrompt?.trim()) return
    if (get().isGenerating) return

    // 对话记录只留用户原始输入，注入的上下文不污染记录（发给模型时才拼）
    const userMessage: AgentChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      attachedCards,
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
        prompt: injectedPrompt?.trim() || prompt.trim(),
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
  },

  /**
   * 把预览卡中确认过的场面布局写入决斗场
   *
   * 卡密 → CdbCard 的解析放在这里而不是主进程：`addCardToZone` 体系要的是
   * 完整卡对象（卡名、攻防、卡图都靠它），而主进程那边的布局提案刻意只带卡密，
   * 避免把整张卡库塞进事件载荷。渲染层已有 `getCardsByIds` 通道，直接复用。
   */
  applyBoardSetup: async (setup) => {
    const placements: AgentBoardCardPlacement[] = setup.cards ?? []
    if (placements.length === 0 && (setup.lp ?? []).length === 0) {
      return { ok: false, error: '该布局提案没有任何可落位的内容' }
    }

    let dict: Record<number, CdbCard> = {}
    const knownCodes = placements.filter((p) => !p.isUnknown).map((p) => p.code)
    if (knownCodes.length > 0) {
      try {
        dict = await window.api.getCardsByIds(knownCodes)
      } catch (err) {
        console.error('[useAgentStore] applyBoardSetup 解析卡密失败:', err)
        return { ok: false, error: '卡库查询失败，未能读取卡片数据' }
      }
    }

    const resolved = placements
      .map((p) => {
        // 未知盖卡：没有卡面数据，构造一个只有 code:0 的空壳交给 store，
        // 渲染层会按卡背显示。不走 getCardsByIds（查了也查不到）。
        if (p.isUnknown) {
          return {
            card: { id: 0, name: p.cardName || '未知盖卡' } as CdbCard,
            controller: p.side,
            location: AGENT_BOARD_ZONE_TO_LOCATION[p.location],
            sequence: p.sequence ?? 0,
            position: p.position
              ? AGENT_BOARD_FACING_TO_POSITION[p.position]
              : defaultFacingForZone(p.location),
            duelistName: p.duelistName
          }
        }
        const card = dict[p.code]
        if (!card) return null
        return {
          card,
          controller: p.side,
          location: AGENT_BOARD_ZONE_TO_LOCATION[p.location],
          sequence: p.sequence ?? 0,
          position: p.position
            ? AGENT_BOARD_FACING_TO_POSITION[p.position]
            : defaultFacingForZone(p.location),
          duelistName: p.duelistName,
          customAtk: p.customAtk,
          customDef: p.customDef
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (placements.length > 0 && resolved.length === 0) {
      return { ok: false, error: '提案中的卡密在当前卡库里都查不到，无法落位' }
    }

    useDuelStore.getState().applyBoardSetup({
      lp: setup.lp ?? [],
      cards: resolved,
      clearExisting: setup.clearExisting
    })
    return { ok: true }
  },

  markBoardSetupApplied: (messageId) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, boardSetupApplied: true } : m
      )
    }))
  },

  dismissBoardSetup: (messageId) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, boardSetup: undefined } : m
      )
    }))
  }
}))
