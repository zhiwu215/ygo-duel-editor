import type {
  AgentApiFormat,
  AgentModelConfig,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset
} from '../types/ipc'

export const DEFAULT_AGENT_API_FORMAT: AgentApiFormat = 'openai-chat-completions'

/**
 * API 协议展示名。格式对齐 ZCode：`名称 (路径)`，且**路径不带 `/v1` 前缀**
 * —— 带 `/v1` 会让 Chat Completions 被读成「OpenAI 官方专属接口」。
 *
 * 这里刻意**不设**「OpenAI 兼容」选项：Chat Completions 本身就是 OpenAI 兼容协议，
 * DeepSeek / 通义千问 / Kimi / Ollama 等走的都是它，多一个同名选项只会让人选错。
 */
export const AGENT_API_FORMAT_LABELS: Record<AgentApiFormat, string> = {
  'anthropic-messages': 'Anthropic Messages (/v1/messages)',
  'openai-chat-completions': 'Chat Completions (/chat/completions)',
  'openai-responses': 'Responses (/responses)'
}

/** 下拉展示顺序，与 ZCode 的 PROVIDER_CONNECTION_API_FORMATS 保持一致 */
export const AGENT_API_FORMAT_VALUES: AgentApiFormat[] = [
  'anthropic-messages',
  'openai-chat-completions',
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
  /** 是否接受图片输入（pi models.json 的 input 数组） */
  supportsVision?: boolean
  /** 以下两个开关只在显式开启时才写进 pi 的 compat，避免覆盖 Pi 的默认能力 */
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
    // 模型自带的上限优先，没配才回落到全局的「单次回复上限」
    maxTokens: model?.maxTokens ?? config.maxTokens,
    supportsVision: model?.supportsVision,
    supportsStructuredOutput: model?.supportsStructuredOutput,
    supportsMidConversationSystem: model?.supportsMidConversationSystem
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
  return Boolean(
    provider.enabled &&
    (provider.apiKey.trim() || isLocalEndpoint(provider.baseUrl)) &&
    hasEnabledModel(provider)
  )
}

/**
 * 判断接口地址是否指向本机（Ollama / LM Studio 等本地推理服务），这类服务无需 API Key
 * 解析失败时按远端处理，避免把畸形地址误当成本地端点而放行空密钥
 */
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
