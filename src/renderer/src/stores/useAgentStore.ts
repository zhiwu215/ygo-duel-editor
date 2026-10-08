import { create } from 'zustand'
import {
  AGENT_BOARD_FACING_TO_POSITION,
  AGENT_BOARD_ZONE_TO_LOCATION,
  AgentBoardCardPlacement,
  AgentBoardSetupProposal,
  AgentCardSwapProposal,
  AgentContextCompactionState,
  AgentHandoffRequest,
  AgentModelConfig,
  AgentTextSourceRef,
  AgentProviderConfig,
  AgentProviderPreset,
  AgentStepProposal,
  AgentStreamEvent,
  AgentTaskMode,
  CdbCard,
  CardLocation,
  CardPosition,
  DuelPuzzleState,
  EngineDuelStep,
  LightweightCardSnapshot,
  ResolvedBoardPlacement,
  createProviderFromPreset,
  normalizeAgentApiFormat,
  normalizeAgentConfig,
  syncActiveFields
} from '@shared/index'
import { useDuelStore } from './useDuelStore'

export type AgentContextCompaction = AgentContextCompactionState

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

  cardSwap?: AgentCardSwapProposal

  engineSteps?: EngineDuelStep[]
  engineWinner?: 0 | 1 | null
  engineInitialCards?: LightweightCardSnapshot[]

  compaction?: AgentContextCompaction

  error?: string

  boardSetupApplied?: boolean

  attachedCards?: { id: number; name: string }[]

  textSource?: { title: string; wordCount?: number; textId?: string; chapterIds?: string[] }
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

  sendMessage: (
    prompt: string,
    boardState?: DuelPuzzleState,
    injectedPrompt?: string,
    attachedCards?: { id: number; name: string }[],
    textSource?: AgentTextSourceRef,
    mode?: AgentTaskMode
  ) => Promise<void>
  abort: () => Promise<void>

  resetSession: () => Promise<void>

  applyDuelProposal: (
    setup: AgentBoardSetupProposal | null,
    proposals: AgentStepProposal[]
  ) => Promise<{ ok: boolean; error?: string }>

  applyCardSwap: (proposal: AgentCardSwapProposal) => Promise<{ ok: boolean; error?: string }>

  applyEngineSteps: (
    steps: EngineDuelStep[],
    initialCards?: LightweightCardSnapshot[]
  ) => Promise<{ ok: boolean; error?: string }>
}

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

let configUpdatedSubscribed = false
let handoffSubscribed = false

function applyHandoff(request: AgentHandoffRequest): void {
  const store = useAgentStore.getState()
  if (store.isGenerating) return
  store.setOpen(true)
  void useAgentStore
    .getState()
    .sendMessage(request.prompt, undefined, undefined, undefined, request.textSource, request.mode)
}

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
        } else if (event.type === 'card_swap_ready') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, cardSwap: event.proposal } : m
            )
          })
        } else if (event.type === 'compaction') {
          set({
            messages: messages.map((m) =>
              m.id === lastMsg.id ? { ...m, compaction: event.compaction } : m
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
                    error: event.message
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
    if (!handoffSubscribed && window.api.onAgentHandoff) {
      handoffSubscribed = true
      window.api.onAgentHandoff(applyHandoff)
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

  sendMessage: async (prompt, boardState, injectedPrompt, attachedCards, textSource, mode) => {
    if (!prompt.trim() && !injectedPrompt?.trim()) return
    if (get().isGenerating) return

    const userMessage: AgentChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      attachedCards,
      textSource: textSource
        ? {
            title: textSource.title,
            wordCount: textSource.wordCount,
            textId: textSource.textId,
            chapterIds: textSource.chapterIds
          }
        : undefined,
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
        textSource,
        mode,
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

  applyDuelProposal: async (setup, proposals) => {
    const placements: AgentBoardCardPlacement[] = setup?.cards ?? []
    const lpTargets = setup?.lp ?? []
    if (placements.length === 0 && lpTargets.length === 0 && proposals.length === 0) {
      return { ok: false, error: '该提案没有任何可应用的内容' }
    }

    let dict: Record<number, CdbCard> = {}
    const knownCodes = placements.filter((p) => !p.isUnknown).map((p) => p.code)
    if (knownCodes.length > 0) {
      try {
        dict = await window.api.getCardsByIds(knownCodes)
      } catch (err) {
        console.error('[useAgentStore] applyDuelProposal 解析卡密失败:', err)
        return { ok: false, error: '卡库查询失败，未能读取卡片数据' }
      }
    }

    const resolved = placements
      .map((p) => {
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

    if (placements.length > 0 && resolved.length === 0 && proposals.length === 0) {
      return { ok: false, error: '提案中的卡密在当前卡库里都查不到，无法应用' }
    }

    const nameToCode = new Map<string, number>()
    Object.values(dict).forEach((c) => nameToCode.set(c.name, c.id))
    resolved.forEach((r) => nameToCode.set(r.card.name, r.card.id))

    const { applyDuelScreenplay } = useDuelStore.getState()
    applyDuelScreenplay({
      lp: lpTargets,
      cards: resolved,
      clearExisting: Boolean(setup?.clearExisting),
      steps: proposals.map((p) => ({
        turn: p.turn || 1,
        phase: p.phase,
        turnPlayer: p.actionPlayer ?? 0,
        actionPlayer: p.actionPlayer ?? 0,
        actionType: p.actionType,
        cardCode: p.cardCode ?? (p.cardName ? nameToCode.get(p.cardName) : undefined),
        cardName: p.cardName,
        speaker: p.speaker,
        dialogue: p.dialogue,
        innerThoughts: p.innerThoughts,
        description: p.description,
        chainIndex: p.chainIndex,
        fromLocation: p.fromLocation,
        toLocation: p.toLocation,
        toSequence: p.toSequence,
        sourceQuote: p.sourceQuote,
        lpChange: p.lpChange
      }))
    })
    return { ok: true }
  },

  applyCardSwap: async (proposal) => {
    const placements = proposal.placements
    if (placements.length === 0) return { ok: false, error: '提案里没有任何落位' }

    const codes = placements.map((p) => p.code)
    let dict: Record<number, CdbCard> = {}
    try {
      dict = await window.api.getCardsByIds(codes)
    } catch (err) {
      console.error('[useAgentStore] applyCardSwap 解析卡密失败:', err)
      return { ok: false, error: '卡库查询失败，未能读取卡片数据' }
    }

    const missing = placements.filter((p) => !dict[p.code])
    if (missing.length > 0) {
      return {
        ok: false,
        error: `卡密 ${missing.map((m) => m.code).join('、')} 在卡库里查不到，未做替换`
      }
    }

    useDuelStore.setState((prev) => {
      const cards = [...prev.state.cards]
      for (const p of placements) {
        const card = dict[p.code]
        const slot = p.slot === 'HAND' ? CardLocation.HAND : CardLocation.SZONE
        let targetIndex = cards.findIndex(
          (c) => c.controller === p.side && c.location === slot && c.sequence === p.index
        )
        if (targetIndex === -1) {
          targetIndex = cards.findIndex(
            (c) =>
              c.controller === p.side &&
              c.location === slot &&
              !cards
                .slice(0, targetIndex)
                .some((x) => x.sequence === p.index && x.location === slot)
          )
        }
        if (targetIndex === -1) {
          cards.push({
            instanceId: `agent_swap_${p.side}_${p.slot}_${p.index}_${p.code}`,
            code: p.code,
            card,
            controller: p.side,
            owner: p.side,
            location: slot,
            sequence: p.index,
            position: CardPosition.FACEDOWN,
            overlayMaterials: []
          })
          continue
        }
        cards[targetIndex] = {
          ...cards[targetIndex],
          code: p.code,
          card,
          position: CardPosition.FACEDOWN
        }
      }
      return { state: { ...prev.state, cards } }
    })

    return { ok: true }
  },

  applyEngineSteps: async (steps, initialCards) => {
    if (steps.length === 0) return { ok: false, error: '引擎没有产出任何步骤' }

    const codes = [
      ...new Set([
        ...steps.map((s) => s.cardCode).filter((c): c is number => typeof c === 'number'),
        ...(initialCards ?? []).map((c) => c.code)
      ])
    ]

    let dict: Record<number, CdbCard> = {}
    if (codes.length > 0) {
      try {
        dict = await window.api.getCardsByIds(codes)
      } catch (err) {
        console.error('[useAgentStore] applyEngineSteps 解析卡密失败:', err)
        return { ok: false, error: '卡库查询失败，未能读取卡片数据' }
      }
    }

    const nameToCode = new Map<string, number>()
    Object.values(dict).forEach((c) => nameToCode.set(c.name, c.id))

    const known = (code: number | undefined): boolean =>
      code !== undefined && dict[code] !== undefined

    const snapshot = initialCards ?? []
    const placements: ResolvedBoardPlacement[] = []
    for (const card of snapshot) {
      if (!known(card.code)) continue
      placements.push({
        card: dict[card.code],
        controller: card.controller,
        location: card.location,
        sequence: card.sequence,
        position: card.position,
        duelistName: undefined
      })
    }

    const { applyDuelScreenplay } = useDuelStore.getState()
    applyDuelScreenplay({
      lp: [],
      cards: placements,
      clearExisting: true,
      steps: steps.map((s) => ({
        ...s,
        cardCode: known(s.cardCode)
          ? s.cardCode
          : s.cardName
            ? nameToCode.get(s.cardName)
            : undefined
      }))
    })
    return { ok: true }
  }
}))
