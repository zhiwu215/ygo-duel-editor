import {
  MAX_WEB_SEARCH_RESULTS,
  normalizeWebSearchConfig,
  resolveWebSearchApiKey,
  type AgentModelConfig,
  type WebSearchConfig
} from '@shared/index'
import { configService } from '../configService'
import { fetchDeepSeekWeb, searchDeepSeekWeb } from './deepseekWebApi'
import { WebError, type WebFetchResult, type WebSearchResult, type WebSearchSource } from './types'

interface ResolvedWebSettings {
  settings: WebSearchConfig
  apiKey: string
}

function resolveSettings(): ResolvedWebSettings {
  const config = configService.get()
  const settings = normalizeWebSearchConfig(config.webSearch)
  const agentConfig: AgentModelConfig = config.agentConfig ?? {
    baseUrl: '',
    apiKey: '',
    model: ''
  }
  return {
    settings,
    apiKey: resolveWebSearchApiKey(settings, agentConfig)
  }
}

function requireProvider(settings: WebSearchConfig, apiKey: string): void {
  if (!settings.enabled) {
    throw new WebError('网页搜索已在「设置 → 网页搜索」中关闭', 'WEB_DISABLED')
  }
  if (apiKey.length === 0) {
    throw new WebError(
      '请先在「设置 → 网页搜索」配置 DeepSeek API Key，或在模型设置中配置 DeepSeek 供应商',
      'WEB_NOT_CONFIGURED'
    )
  }
}

function mergeSources(groups: WebSearchSource[][]): WebSearchSource[] {
  const merged: WebSearchSource[] = []
  const seen = new Set<string>()
  const longest = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < longest; index++) {
    for (const group of groups) {
      const source = group[index]
      if (!source || seen.has(source.url)) continue
      seen.add(source.url)
      merged.push(source)
    }
  }
  return merged
}

export async function searchWeb(
  queries: string[],
  originalQuestion: string | undefined,
  signal?: AbortSignal
): Promise<WebSearchResult> {
  const { settings, apiKey } = resolveSettings()
  requireProvider(settings, apiKey)
  const count = Math.min(settings.count, MAX_WEB_SEARCH_RESULTS)
  const results = await Promise.all(
    queries.map((query) =>
      searchDeepSeekWeb(
        {
          baseUrl: settings.baseUrl,
          apiKey,
          count,
          originalQuestion
        },
        query,
        signal
      )
    )
  )
  const merged = mergeSources(results.map((result) => result.sources))
  const content = results
    .map((result) => result.content)
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n')
  const truncated =
    merged.length > MAX_WEB_SEARCH_RESULTS || results.some((result) => result.truncated)
  return {
    ...(content.length > 0 ? { content } : {}),
    sources: merged.slice(0, MAX_WEB_SEARCH_RESULTS),
    truncated
  }
}

export async function fetchWeb(url: string, signal?: AbortSignal): Promise<WebFetchResult> {
  const { settings, apiKey } = resolveSettings()
  requireProvider(settings, apiKey)
  return fetchDeepSeekWeb({ baseUrl: settings.baseUrl, apiKey }, url, signal)
}
