import { MAX_WEB_FETCH_CHARS } from '@shared/index'
import { WebError, type WebFetchResult, type WebSearchResult, type WebSearchSource } from './types'

const SEARCH_TIMEOUT_MS = 60_000

const FETCH_TIMEOUT_MS = 30_000

const USER_AGENT = 'ygo-duel-editor/0.1'

interface DeepSeekWebOptions {
  baseUrl: string
  apiKey: string
  count: number
  originalQuestion?: string
}

interface RawSearchItem {
  url?: unknown
  title?: unknown
  snippet?: unknown
  date?: unknown
}

interface RawSearchResponse {
  results?: unknown
}

interface RawFetchResponse {
  content?: unknown
}

function boundedQuestion(question: string | undefined): string | undefined {
  const collapsed = question?.replace(/\s+/gu, ' ').trim() ?? ''
  if (collapsed.length === 0) return undefined
  return Array.from(collapsed).slice(0, 128).join('')
}

function toSource(item: RawSearchItem): WebSearchSource | null {
  if (typeof item.url !== 'string' || item.url.length === 0) return null
  const source: WebSearchSource = { url: item.url }
  if (typeof item.title === 'string' && item.title.length > 0) source.title = item.title
  if (typeof item.snippet === 'string' && item.snippet.length > 0) source.snippet = item.snippet
  if (typeof item.date === 'string' && item.date.length > 0) source.publishedAt = item.date
  return source
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string
      message?: string
    }
    const error = payload.error
    if (typeof error === 'string' && error.length > 0) return error
    if (
      error &&
      typeof error === 'object' &&
      typeof error.message === 'string' &&
      error.message.length > 0
    ) {
      return error.message
    }
    if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message
  } catch {
    void 0
  }
  try {
    const text = (await response.text()).slice(0, 300)
    if (text.length > 0) return text
  } catch {
    void 0
  }
  return response.statusText || `HTTP ${response.status}`
}

async function postJson(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  signal: AbortSignal | undefined
): Promise<unknown> {
  if (signal?.aborted) {
    throw new WebError('网页请求已取消', 'WEB_ABORTED')
  }
  const controller = new AbortController()
  let timedOut = false
  let aborted = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = (): void => {
    aborted = true
    controller.abort()
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': USER_AGENT
      },
      body: JSON.stringify(body)
    })
    if (!response.ok) {
      throw new WebError(await errorMessage(response), `WEB_HTTP_${response.status}`)
    }
    return (await response.json()) as unknown
  } catch (error: unknown) {
    if (error instanceof WebError) throw error
    if (timedOut) throw new WebError('网页请求超时，请稍后重试', 'WEB_TIMEOUT')
    if (aborted) throw new WebError('网页请求已取消', 'WEB_ABORTED')
    const message = error instanceof Error ? error.message : String(error)
    throw new WebError(`连接网页服务失败：${message}`, 'WEB_PROVIDER_ERROR')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function searchDeepSeekWeb(
  options: DeepSeekWebOptions,
  query: string,
  signal?: AbortSignal
): Promise<WebSearchResult> {
  const endpoint = `${options.baseUrl}/search`
  const question = boundedQuestion(options.originalQuestion)
  const payload = (await postJson(
    endpoint,
    options.apiKey,
    {
      query,
      count: options.count,
      need_content: false,
      ...(question === undefined ? {} : { ori_question: question })
    },
    SEARCH_TIMEOUT_MS,
    signal
  )) as RawSearchResponse

  if (!Array.isArray(payload.results)) {
    throw new WebError('网页搜索返回了无法识别的数据', 'WEB_PROVIDER_ERROR')
  }
  const sources = payload.results
    .map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? toSource(item as RawSearchItem)
        : null
    )
    .filter((source): source is WebSearchSource => source !== null)
  return { sources, truncated: false }
}

export async function fetchDeepSeekWeb(
  options: Pick<DeepSeekWebOptions, 'baseUrl' | 'apiKey'>,
  url: string,
  signal?: AbortSignal
): Promise<WebFetchResult> {
  const payload = (await postJson(
    `${options.baseUrl}/fetch`,
    options.apiKey,
    { url },
    FETCH_TIMEOUT_MS,
    signal
  )) as RawFetchResponse

  if (typeof payload.content !== 'string') {
    throw new WebError('网页抓取返回了无法识别的数据', 'WEB_PROVIDER_ERROR')
  }
  const truncated = payload.content.length > MAX_WEB_FETCH_CHARS
  return {
    url,
    statusCode: 200,
    content: truncated ? payload.content.slice(0, MAX_WEB_FETCH_CHARS) : payload.content,
    truncated
  }
}
