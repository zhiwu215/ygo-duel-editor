import type { AgentModelConfig } from '../types/ipc'
import { cleanAgentApiKey } from './agentModel'

export const WEB_SEARCH_PROVIDER = 'deepseek-search-api'

export const DEFAULT_WEB_SEARCH_BASE_URL = 'https://api.deepseek.com/v1/tools'

export const DEFAULT_WEB_SEARCH_COUNT = 10

export const MAX_WEB_SEARCH_COUNT = 50

export const MAX_WEB_SEARCH_RESULTS = 8

export const MAX_WEB_SEARCH_QUERIES = 4

export const MAX_WEB_FETCH_CHARS = 200_000

export interface WebSearchConfig {
  enabled: boolean
  provider: typeof WEB_SEARCH_PROVIDER
  apiKey: string
  reuseProviderKey: boolean
  count: number
}

export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  enabled: true,
  provider: WEB_SEARCH_PROVIDER,
  apiKey: '',
  reuseProviderKey: true,
  count: DEFAULT_WEB_SEARCH_COUNT
}

export function normalizeWebSearchConfig(value: unknown): WebSearchConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_WEB_SEARCH_CONFIG }
  }
  const raw = value as Partial<WebSearchConfig>
  const count =
    typeof raw.count === 'number' && Number.isInteger(raw.count)
      ? Math.min(MAX_WEB_SEARCH_COUNT, Math.max(1, raw.count))
      : DEFAULT_WEB_SEARCH_COUNT
  return {
    enabled: raw.enabled !== false,
    provider: WEB_SEARCH_PROVIDER,
    apiKey: cleanAgentApiKey(typeof raw.apiKey === 'string' ? raw.apiKey : ''),
    reuseProviderKey: raw.reuseProviderKey !== false,
    count
  }
}

export function findDeepSeekProviderKey(config: AgentModelConfig): string {
  const provider = (config.providers ?? []).find(
    (item) => item.presetId === 'deepseek' || item.id === 'deepseek'
  )
  return cleanAgentApiKey(provider?.apiKey)
}

export function resolveWebSearchApiKey(
  webSearch: WebSearchConfig,
  agentConfig: AgentModelConfig
): string {
  const stored = cleanAgentApiKey(webSearch.apiKey)
  if (!webSearch.reuseProviderKey) return stored
  return findDeepSeekProviderKey(agentConfig) || stored
}

export function isWebSearchReady(
  webSearch: WebSearchConfig,
  agentConfig: AgentModelConfig
): boolean {
  return webSearch.enabled && resolveWebSearchApiKey(webSearch, agentConfig).length > 0
}
