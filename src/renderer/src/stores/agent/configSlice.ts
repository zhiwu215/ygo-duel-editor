import type { StateCreator } from 'zustand'
import {
  AgentHandoffRequest,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderPreset,
  AgentReasoningEffort,
  agentReasoningLevels,
  applyAgentProviderDefaults,
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
  systemPrompt: ''
}

let configUpdatedSubscribed = false
let handoffSubscribed = false

function applyHandoff(get: () => AgentStore, request: AgentHandoffRequest): void {
  const store = get()
  if (store.isGenerating) return
  void store.sendMessage(request.prompt, undefined, undefined, undefined, request.textSource)
}

export interface ConfigSlice {
  config: AgentModelConfig
  presets: AgentProviderPreset[]
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<boolean>
  loadPresets: () => Promise<AgentProviderPreset[]>
  upsertProvider: (provider: AgentProviderConfig) => void
  removeProvider: (providerId: string) => void
  selectModel: (providerId: string, modelId: string) => void
  setReasoningEffort: (effort: AgentReasoningEffort) => void
}

export const createConfigSlice: StateCreator<AgentStore, [], [], ConfigSlice> = (set, get) => ({
  config: { ...DEFAULT_CONFIG },
  presets: [],

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
      const normalized = applyAgentProviderDefaults(
        normalizeAgentConfig({ ...DEFAULT_CONFIG, ...raw }),
        presets
      )
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
    const exists = providers.some((item) => item.id === provider.id)
    const nextProviders = exists
      ? providers.map((item) => (item.id === provider.id ? provider : item))
      : [...providers, provider]
    const next = syncActiveFields({ ...config, providers: nextProviders })
    set({ config: next })
    void get().saveConfig()
  },

  removeProvider: (providerId) => {
    const { config } = get()
    const nextProviders = (config.providers ?? []).filter((item) => item.id !== providerId)
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

  setReasoningEffort: (effort) => {
    const { config } = get()
    const provider = (config.providers ?? []).find((item) => item.id === config.provider)
    const model = provider?.models.find((item) => item.id === config.model)
    if (!agentReasoningLevels(model?.reasoningEfforts).includes(effort)) return
    set({ config: { ...config, reasoningEffort: effort } })
    void get().saveConfig()
  }
})
