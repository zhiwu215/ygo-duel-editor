import {
  AGENT_REASONING_EFFORTS,
  AgentModelInfo,
  AgentProviderConfig,
  AgentProviderModelConfig,
  isLocalEndpoint
} from '@shared/index'

export type ProviderStatus = 'ready' | 'unavailable'

export function resolveProviderStatus(provider: AgentProviderConfig): ProviderStatus {
  return provider.apiKey.trim().length > 0 || isLocalEndpoint(provider.baseUrl)
    ? 'ready'
    : 'unavailable'
}

export function providerLabel(provider: AgentProviderConfig): string {
  return provider.name === provider.id ? provider.name : `${provider.name} (${provider.id})`
}

export function adoptFetchedModel(info: AgentModelInfo): AgentProviderModelConfig {
  return {
    id: info.id,
    ...(info.name ? { name: info.name } : {}),
    ...(info.input ? { input: [...info.input] } : {}),
    ...(info.contextWindow ? { contextWindow: info.contextWindow } : {}),
    ...(info.maxTokens ? { maxTokens: info.maxTokens } : {})
  }
}

export function mergeFetchedModels(
  existing: AgentProviderModelConfig[],
  fetched: AgentModelInfo[]
): AgentProviderModelConfig[] {
  const known = new Set(existing.map((model) => model.id))
  const added = fetched
    .filter((model) => !known.has(model.id))
    .map((model) => adoptFetchedModel(model))
  return [...existing, ...added]
}

export function modelSignature(model: AgentProviderModelConfig): string {
  return JSON.stringify([
    model.id,
    model.name ?? '',
    model.input ?? [],
    model.contextWindow ?? null,
    model.maxTokens ?? null,
    AGENT_REASONING_EFFORTS.map((level) => [level, model.reasoningEfforts?.[level] ?? null]),
    Boolean(model.supportsStructuredOutput),
    Boolean(model.supportsMidConversationSystem)
  ])
}

export function providerModelsEqual(
  left: AgentProviderModelConfig[],
  right: AgentProviderModelConfig[]
): boolean {
  return (
    left.length === right.length &&
    left.every((model, index) => {
      const other = right[index]
      return other !== undefined && modelSignature(model) === modelSignature(other)
    })
  )
}

export function cloneProviderModels(
  models: AgentProviderModelConfig[]
): AgentProviderModelConfig[] {
  return models.map((model) => ({
    ...model,
    ...(model.input ? { input: [...model.input] } : {}),
    ...(model.reasoningEfforts ? { reasoningEfforts: { ...model.reasoningEfforts } } : {})
  }))
}
