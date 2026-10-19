import type { StateCreator } from 'zustand'
import {
  AgentHandoffRequest,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset,
  createProviderFromPreset,
  normalizeAgentApiFormat,
  normalizeAgentConfig,
  syncActiveFields
} from '@shared/index'
import type { AgentStore } from './types'

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

function applyHandoff(get: () => AgentStore, request: AgentHandoffRequest): void {
  const store = get()
  if (store.isGenerating) return
  store.setOpen(true)
  void store.sendMessage(request.prompt, undefined, undefined, undefined, request.textSource)
}

export interface ConfigSlice {
  config: AgentModelConfig
  presets: AgentProviderPreset[]
  updateConfig: (patch: Partial<AgentModelConfig>) => void
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<boolean>
  loadPresets: () => Promise<AgentProviderPreset[]>
  upsertProvider: (provider: AgentProviderConfig) => void
  removeProvider: (providerId: string) => void
  reorderProviders: (fromId: string, toId: string) => void
  selectModel: (providerId: string, modelId: string) => void
  upsertProviderModel: (providerId: string, model: AgentProviderModelConfig) => void
  removeProviderModel: (providerId: string, modelId: string) => void
  setProviderModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void
}

export const createConfigSlice: StateCreator<AgentStore, [], [], ConfigSlice> = (set, get) => ({
  config: { ...DEFAULT_CONFIG },
  presets: [],

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
      window.api.onAgentHandoff((request) => applyHandoff(get, request))
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

  upsertProviderModel: (providerId, model) => {
    const { config } = get()
    const provider = (config.providers ?? []).find((p) => p.id === providerId)
    if (!provider) return
    const exists = provider.models.some((m) => m.id === model.id)
    const models = exists
      ? provider.models.map((m) => (m.id === model.id ? model : m))
      : [...provider.models, model]
    get().upsertProvider({ ...provider, models })
    get().selectModel(providerId, model.id)
  },

  removeProviderModel: (providerId, modelId) => {
    const { config } = get()
    const provider = (config.providers ?? []).find((p) => p.id === providerId)
    if (!provider) return
    const wasActive = config.provider === providerId && config.model === modelId
    const models = provider.models.filter((m) => m.id !== modelId)
    get().upsertProvider({ ...provider, models })
    const nextModelId = wasActive ? models.find((m) => m.enabled)?.id : undefined
    if (nextModelId) get().selectModel(providerId, nextModelId)
  },

  setProviderModelEnabled: (providerId, modelId, enabled) => {
    const { config } = get()
    const provider = (config.providers ?? []).find((p) => p.id === providerId)
    if (!provider) return
    const models = provider.models.map((m) => (m.id === modelId ? { ...m, enabled } : m))
    const wasActive = config.provider === providerId && config.model === modelId
    get().upsertProvider({ ...provider, models })
    const nextModelId = !enabled && wasActive ? models.find((m) => m.enabled)?.id : undefined
    if (nextModelId) get().selectModel(providerId, nextModelId)
  }
})
