import type {
  AgentApiFormat,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset
} from '../types/ipc'

export const DEFAULT_AGENT_API_FORMAT: AgentApiFormat = 'openai-chat-completions'

export const AGENT_API_FORMAT_LABELS: Record<AgentApiFormat, string> = {
  'openai-chat-completions': 'Chat Completions (/v1/chat/completions)',
  'anthropic-messages': 'Anthropic Messages (/v1/messages)',
  'openai-responses': 'Responses (/v1/responses)'
}

export const AGENT_API_FORMAT_VALUES: AgentApiFormat[] = [
  'openai-chat-completions',
  'anthropic-messages',
  'openai-responses'
]

export function toPiApiType(format?: AgentApiFormat): string {
  switch (format) {
    case 'anthropic-messages':
      return 'anthropic-messages'
    case 'openai-responses':
      return 'openai-responses'
    default:
      return 'openai-completions'
  }
}

export function normalizeAgentApiFormat(format?: string | null): AgentApiFormat {
  return format === 'anthropic-messages' || format === 'openai-responses'
    ? format
    : DEFAULT_AGENT_API_FORMAT
}

export function createProviderFromPreset(preset: AgentProviderPreset): AgentProviderConfig {
  return {
    id: preset.id,
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiFormat: preset.apiFormat ?? DEFAULT_AGENT_API_FORMAT,
    apiKey: '',
    enabled: true,
    presetId: preset.id,
    models: []
  }
}

function findAgentProvider(
  config: Pick<AgentModelConfig, 'providers'>,
  providerId?: string | null
): AgentProviderConfig | null {
  if (!providerId || !config.providers) return null
  return config.providers.find((p) => p.id === providerId) ?? null
}

function firstEnabledModel(
  provider: AgentProviderConfig | null | undefined
): AgentProviderModelConfig | null {
  if (!provider) return null
  return provider.models.find((m) => m.enabled) ?? null
}

function hasEnabledModel(provider: AgentProviderConfig): boolean {
  return provider.models.some((m) => m.enabled)
}

export interface AgentRuntimeConfig {
  providerId: string
  baseUrl: string
  apiKey: string
  model: string
  apiFormat: AgentApiFormat
  enableReasoning: boolean
  contextWindow?: number
  maxTokens?: number
}

export function resolveActiveRuntime(
  config: AgentModelConfig,
  override?: { providerId?: string; modelId?: string }
): AgentRuntimeConfig {
  const providerId = override?.providerId ?? config.provider
  const provider = findAgentProvider(config, providerId) ?? firstRunnableProvider(config)

  if (!provider) {
    return {
      providerId: config.provider || 'custom-openai',
      baseUrl: (config.baseUrl || '').trim(),
      apiKey: (config.apiKey || '').trim(),
      model: (config.model || '').trim(),
      apiFormat: normalizeAgentApiFormat(config.apiFormat),
      enableReasoning: Boolean(config.enableReasoning),
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens
    }
  }

  const requestedModel = override?.modelId ?? (providerId === config.provider ? config.model : '')
  const model =
    provider.models.find((m) => m.id === requestedModel && m.enabled) ?? firstEnabledModel(provider)

  const enableReasoning =
    providerId === config.provider && requestedModel === config.model
      ? Boolean(config.enableReasoning)
      : Boolean(model?.supportsReasoning)

  return {
    providerId: provider.id,
    baseUrl: (provider.baseUrl || '').trim(),
    apiKey: (provider.apiKey || '').trim(),
    model: model?.id ?? '',
    apiFormat: normalizeAgentApiFormat(provider.apiFormat),
    enableReasoning,
    contextWindow: model?.contextWindow ?? config.contextWindow,
    maxTokens: config.maxTokens
  }
}

function firstRunnableProvider(config: AgentModelConfig): AgentProviderConfig | null {
  if (!config.providers) return null
  return (
    config.providers.find((p) => p.enabled && p.apiKey.trim() && hasEnabledModel(p)) ??
    config.providers.find((p) => p.enabled && hasEnabledModel(p)) ??
    config.providers[0] ??
    null
  )
}

export function isProviderReady(provider: AgentProviderConfig): boolean {
  return Boolean(provider.enabled && provider.apiKey.trim() && hasEnabledModel(provider))
}

export function syncActiveFields(
  config: AgentModelConfig,
  selection?: { providerId?: string; modelId?: string }
): AgentModelConfig {
  const runtime = resolveActiveRuntime(config, selection)
  return {
    ...config,
    provider: runtime.providerId,
    baseUrl: runtime.baseUrl,
    apiKey: runtime.apiKey,
    model: runtime.model,
    apiFormat: runtime.apiFormat,
    enableReasoning: runtime.enableReasoning,
    contextWindow: runtime.contextWindow
  }
}

export function normalizeAgentConfig(config: AgentModelConfig): AgentModelConfig {
  const providers = (config.providers ?? []).map((provider) => ({
    ...provider,
    apiFormat: normalizeAgentApiFormat(provider.apiFormat),
    apiKey: cleanAgentApiKey(provider.apiKey),
    baseUrl: (provider.baseUrl || '').trim(),
    enabled: provider.enabled !== false,
    models: (provider.models ?? [])
      .filter((model) => model.custom === true)
      .map((model) => ({
        ...model,
        id: model.id.trim(),
        enabled: model.enabled !== false
      }))
  }))

  return syncActiveFields({ ...config, providers })
}

export function cleanAgentApiKey(key: string | undefined): string {
  return (key || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}
