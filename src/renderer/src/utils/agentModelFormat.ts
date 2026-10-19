import {
  AgentModelInfo,
  AgentProviderConfig,
  AgentProviderModelConfig,
  isProviderReady
} from '@shared/index'

export type ProviderStatus = 'ready' | 'unavailable' | 'disabled'

export function resolveProviderStatus(provider: AgentProviderConfig): ProviderStatus {
  if (!provider.enabled) return 'disabled'
  return isProviderReady(provider) ? 'ready' : 'unavailable'
}

export function formatContextWindow(tokens?: number): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`
  return String(tokens)
}

export function mergeFetchedModels(
  existing: AgentProviderModelConfig[],
  fetched: AgentModelInfo[]
): AgentProviderModelConfig[] {
  const known = new Set(existing.map((m) => m.id))
  const added = fetched
    .filter((m) => !known.has(m.id))
    .map<AgentProviderModelConfig>((m) => ({
      id: m.id,
      name: m.name,
      supportsReasoning: m.supportsReasoning,
      supportsVision: m.supportsVision,
      contextWindow: m.contextWindow,
      enabled: true,
      custom: true
    }))
  return [...existing, ...added]
}
