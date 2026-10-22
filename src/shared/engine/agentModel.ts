import type {
  AgentApiFormat,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset
} from '../types/ipc'
import { normalizeAgentModelInputs, type AgentModelInput } from '../constants/modelInput'
import {
  normalizeAgentReasoningEffort,
  normalizeAgentReasoningEfforts,
  resolveAgentReasoningEffort,
  type AgentReasoningEffort,
  type AgentReasoningEfforts
} from '../constants/reasoningEffort'

export const DEFAULT_AGENT_API_FORMAT: AgentApiFormat = 'openai-chat-completions'

const AGENT_DEFAULTS_VERSION = 3

const DEFAULT_AGENT_PROVIDER_PRESET_ID = 'deepseek'

const LEGACY_DEFAULT_MODEL_IDS = new Set(['deepseek-chat', 'deepseek-reasoner'])

const LEGACY_REASONING_EFFORTS: AgentReasoningEfforts = {
  off: null,
  low: 'low',
  medium: 'medium',
  high: 'high',
  max: 'max'
}

export const AGENT_API_FORMAT_LABELS: Record<AgentApiFormat, string> = {
  'anthropic-messages': 'Anthropic Messages',
  'openai-chat-completions': 'OpenAI Chat Completions',
  'openai-responses': 'OpenAI Responses',
  'google-generative-ai': 'Google Generative AI',
  'google-vertex': 'Google Vertex AI',
  'azure-openai-responses': 'Azure OpenAI Responses',
  'bedrock-converse-stream': 'Amazon Bedrock',
  'openai-codex-responses': 'OpenAI Codex Responses',
  'mistral-conversations': 'Mistral Conversations',
  'pi-messages': 'Pi Messages'
}

export const AGENT_API_FORMAT_VALUES: AgentApiFormat[] = [
  'anthropic-messages',
  'openai-chat-completions',
  'openai-responses',
  'google-generative-ai',
  'google-vertex',
  'azure-openai-responses',
  'bedrock-converse-stream',
  'openai-codex-responses',
  'mistral-conversations',
  'pi-messages'
]

export const AGENT_CUSTOM_API_FORMAT_VALUES: AgentApiFormat[] = [
  'openai-chat-completions',
  'openai-responses',
  'anthropic-messages'
]

interface LegacyModelFields {
  enabled?: unknown
  custom?: unknown
  supportsReasoning?: unknown
  supportsVision?: unknown
}

export function toPiApiType(format?: AgentApiFormat): string {
  switch (format) {
    case 'anthropic-messages':
      return 'anthropic-messages'
    case 'openai-responses':
      return 'openai-responses'
    case 'google-generative-ai':
      return 'google-generative-ai'
    case 'google-vertex':
      return 'google-vertex'
    case 'azure-openai-responses':
      return 'azure-openai-responses'
    case 'bedrock-converse-stream':
      return 'bedrock-converse-stream'
    case 'openai-codex-responses':
      return 'openai-codex-responses'
    case 'mistral-conversations':
      return 'mistral-conversations'
    case 'pi-messages':
      return 'pi-messages'
    default:
      return 'openai-completions'
  }
}

export function normalizeAgentApiFormat(format?: string | null): AgentApiFormat {
  return AGENT_API_FORMAT_VALUES.find((value) => value === format) ?? DEFAULT_AGENT_API_FORMAT
}

export function createProviderFromPreset(preset: AgentProviderPreset): AgentProviderConfig {
  return {
    id: preset.id,
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiFormat: preset.apiFormat ?? DEFAULT_AGENT_API_FORMAT,
    apiKey: '',
    presetId: preset.id,
    models: (preset.models ?? []).map((model) => cloneModel(model))
  }
}

function cloneModel(model: AgentProviderModelConfig): AgentProviderModelConfig {
  return {
    ...model,
    ...(model.input ? { input: [...model.input] } : {}),
    ...(model.reasoningEfforts ? { reasoningEfforts: { ...model.reasoningEfforts } } : {})
  }
}

function normalizeModel(
  value: AgentProviderModelConfig & LegacyModelFields
): AgentProviderModelConfig {
  const model: AgentProviderModelConfig = {
    id: typeof value.id === 'string' ? value.id.trim() : ''
  }
  if (typeof value.name === 'string' && value.name.trim().length > 0) model.name = value.name.trim()
  const input =
    normalizeAgentModelInputs(value.input) ??
    (value.supportsVision === true ? (['text', 'image'] as AgentModelInput[]) : undefined)
  if (input) model.input = input
  if (
    typeof value.contextWindow === 'number' &&
    Number.isInteger(value.contextWindow) &&
    value.contextWindow > 0
  ) {
    model.contextWindow = value.contextWindow
  }
  if (
    typeof value.maxTokens === 'number' &&
    Number.isInteger(value.maxTokens) &&
    value.maxTokens > 0
  ) {
    model.maxTokens = value.maxTokens
  }
  const efforts =
    normalizeAgentReasoningEfforts(value.reasoningEfforts) ??
    (value.supportsReasoning === true ? { ...LEGACY_REASONING_EFFORTS } : undefined)
  if (efforts) model.reasoningEfforts = efforts
  if (value.supportsStructuredOutput === true) model.supportsStructuredOutput = true
  if (value.supportsMidConversationSystem === true) model.supportsMidConversationSystem = true
  return model
}

function normalizeProvider(value: AgentProviderConfig): AgentProviderConfig {
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : id,
    baseUrl: (value.baseUrl || '').trim(),
    apiFormat: normalizeAgentApiFormat(value.apiFormat),
    apiKey: cleanAgentApiKey(value.apiKey),
    ...(typeof value.presetId === 'string' && value.presetId.length > 0
      ? { presetId: value.presetId }
      : {}),
    models: (value.models ?? [])
      .map((model) => normalizeModel(model as AgentProviderModelConfig & LegacyModelFields))
      .filter((model) => model.id.length > 0)
  }
}

function findAgentProvider(
  config: Pick<AgentModelConfig, 'providers'>,
  providerId?: string | null
): AgentProviderConfig | null {
  if (!providerId || !config.providers) return null
  return config.providers.find((provider) => provider.id === providerId) ?? null
}

function hasModels(provider: AgentProviderConfig): boolean {
  return provider.models.length > 0
}

export interface AgentRuntimeConfig {
  providerId: string
  baseUrl: string
  apiKey: string
  model: string
  apiFormat: AgentApiFormat
  reasoningEffort?: AgentReasoningEffort
  reasoningEfforts?: AgentReasoningEfforts
  contextWindow?: number
  maxTokens?: number
  input: AgentModelInput[]
  supportsStructuredOutput?: boolean
  supportsMidConversationSystem?: boolean
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
      input: ['text']
    }
  }

  const requestedModel = override?.modelId ?? (provider.id === config.provider ? config.model : '')
  const model =
    provider.models.find((item) => item.id === requestedModel) ?? provider.models[0] ?? null
  const reasoningEfforts = normalizeAgentReasoningEfforts(model?.reasoningEfforts)
  const reasoningEffort = resolveAgentReasoningEffort(reasoningEfforts, config.reasoningEffort)

  return {
    providerId: provider.id,
    baseUrl: (provider.baseUrl || '').trim(),
    apiKey: (provider.apiKey || '').trim(),
    model: model?.id ?? '',
    apiFormat: normalizeAgentApiFormat(provider.apiFormat),
    reasoningEffort,
    reasoningEfforts,
    contextWindow: model?.contextWindow,
    maxTokens: model?.maxTokens,
    input: model?.input ?? ['text'],
    supportsStructuredOutput: model?.supportsStructuredOutput,
    supportsMidConversationSystem: model?.supportsMidConversationSystem
  }
}

function firstRunnableProvider(config: AgentModelConfig): AgentProviderConfig | null {
  if (!config.providers) return null
  return (
    config.providers.find(
      (provider) =>
        hasModels(provider) &&
        (provider.apiKey.trim().length > 0 || isLocalEndpoint(provider.baseUrl))
    ) ??
    config.providers.find((provider) => hasModels(provider)) ??
    config.providers[0] ??
    null
  )
}

export function isProviderReady(provider: AgentProviderConfig): boolean {
  return Boolean(
    (provider.apiKey.trim() || isLocalEndpoint(provider.baseUrl)) && hasModels(provider)
  )
}

export function isLocalEndpoint(baseUrl?: string): boolean {
  if (!baseUrl) return false
  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    )
  } catch {
    return false
  }
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
    reasoningEffort: runtime.reasoningEffort
  }
}

export function normalizeAgentConfig(config: AgentModelConfig): AgentModelConfig {
  const providers = (config.providers ?? [])
    .map((provider) => normalizeProvider(provider))
    .filter((provider) => provider.id.length > 0)

  return syncActiveFields({
    providers,
    provider: config.provider,
    baseUrl: (config.baseUrl || '').trim(),
    apiKey: cleanAgentApiKey(config.apiKey),
    model: (config.model || '').trim(),
    apiFormat: normalizeAgentApiFormat(config.apiFormat),
    systemPrompt: config.systemPrompt,
    reasoningEffort: normalizeAgentReasoningEffort(config.reasoningEffort),
    defaultsVersion: config.defaultsVersion
  })
}

function mergePresetModels(
  models: AgentProviderModelConfig[],
  presetModels: AgentProviderModelConfig[] | undefined
): AgentProviderModelConfig[] {
  if (!presetModels || presetModels.length === 0) return models
  const usesLegacyDefaults =
    models.length === 0 || models.every((model) => LEGACY_DEFAULT_MODEL_IDS.has(model.id))
  if (usesLegacyDefaults) return presetModels.map((model) => cloneModel(model))
  return models.map((model) => {
    const presetModel = presetModels.find((item) => item.id === model.id)
    return presetModel ? { ...cloneModel(presetModel), ...model } : model
  })
}

export function applyAgentProviderDefaults(
  config: AgentModelConfig,
  presets: AgentProviderPreset[]
): AgentModelConfig {
  if ((config.defaultsVersion ?? 0) >= AGENT_DEFAULTS_VERSION) return config

  const providers = (config.providers ?? []).map((provider) => {
    const preset = presets.find((item) => item.id === (provider.presetId ?? provider.id))
    if (!preset) return provider
    return {
      ...provider,
      presetId: preset.id,
      models: mergePresetModels(provider.models, preset.models)
    }
  })

  const preset = presets.find((item) => item.id === DEFAULT_AGENT_PROVIDER_PRESET_ID)
  const existingIndex = providers.findIndex(
    (provider) =>
      provider.presetId === DEFAULT_AGENT_PROVIDER_PRESET_ID ||
      provider.id === DEFAULT_AGENT_PROVIDER_PRESET_ID
  )

  let defaultProvider: AgentProviderConfig | null = null
  if (existingIndex >= 0) {
    const existing = providers[existingIndex]
    defaultProvider = existing
    const usesLegacyDefaults =
      existing.models.length === 0 ||
      existing.models.every((model) => LEGACY_DEFAULT_MODEL_IDS.has(model.id))
    if (usesLegacyDefaults && preset?.models?.length) {
      defaultProvider = {
        ...existing,
        models: preset.models.map((model) => cloneModel(model))
      }
      providers[existingIndex] = defaultProvider
    }
  } else if (preset) {
    defaultProvider = createProviderFromPreset(preset)
    providers.unshift(defaultProvider)
  }

  const keepSelection = Boolean(
    config.provider &&
    providers.some(
      (provider) =>
        provider.id === config.provider &&
        provider.models.some((model) => model.id === config.model)
    )
  )
  const nextSelection =
    defaultProvider && !keepSelection
      ? {
          providerId: defaultProvider.id,
          modelId: defaultProvider.models[0]?.id
        }
      : undefined

  return syncActiveFields(
    {
      ...config,
      providers,
      defaultsVersion: AGENT_DEFAULTS_VERSION
    },
    nextSelection
  )
}

export function cleanAgentApiKey(key: string | undefined): string {
  return (key || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}
