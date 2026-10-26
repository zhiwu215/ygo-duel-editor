import {
  AgentModelInfo,
  AgentModelInput,
  cleanAgentApiKey,
  isLocalEndpoint,
  normalizeAgentModelInputs
} from '@shared/index'

const MODEL_LIST_TIMEOUT_MS = 15_000

interface RawModel {
  [key: string]: unknown
}

function textField(model: RawModel, key: string): string | undefined {
  const value = model[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function numberField(model: RawModel, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = model[key]
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  }
  return undefined
}

function inputField(model: RawModel): AgentModelInput[] | undefined {
  const direct = normalizeAgentModelInputs(model.input)
  if (direct) return direct
  const modalities = normalizeAgentModelInputs(model.input_modalities)
  if (modalities) return modalities
  const capabilities = model.capabilities
  if (capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)) {
    const vision = (capabilities as Record<string, unknown>).vision
    if (vision === true) return ['text', 'image']
  }
  return undefined
}

function objectField(model: RawModel, key: string): RawModel | undefined {
  const value = model[key]
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as RawModel
}

function toModelInfo(model: RawModel): AgentModelInfo | null {
  const id = textField(model, 'id') ?? textField(model, 'name')
  if (!id) return null
  const rawName = textField(model, 'display_name') ?? textField(model, 'name')
  const info: AgentModelInfo = { id }
  if (rawName && rawName !== id) info.name = rawName
  const limit = objectField(model, 'limit')
  const topProvider = objectField(model, 'top_provider')
  const contextWindow =
    numberField(model, [
      'contextWindow',
      'context_window',
      'context_length',
      'max_input_tokens',
      'input_token_limit'
    ]) ?? (limit ? numberField(limit, ['context']) : undefined)
  if (contextWindow) info.contextWindow = contextWindow
  const maxTokens =
    numberField(model, [
      'maxOutputTokens',
      'max_output_tokens',
      'maxTokens',
      'max_tokens',
      'output_token_limit'
    ]) ??
    (limit ? numberField(limit, ['output']) : undefined) ??
    (topProvider ? numberField(topProvider, ['max_completion_tokens']) : undefined)
  if (maxTokens) info.maxTokens = maxTokens
  const input = inputField(model)
  if (input) info.input = input
  return info
}

export async function fetchModels(
  baseUrl: string,
  apiKey: string
): Promise<{ success: boolean; models?: AgentModelInfo[]; error?: string }> {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return { success: false, error: '接口地址不能为空' }
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { success: false, error: '接口地址必须以 http:// 或 https:// 开头' }
  }
  try {
    const cleanKey = cleanAgentApiKey(apiKey)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS)
    const res = await fetch(`${trimmed}/models`, {
      headers: cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {},
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      let errorDetail = ''
      try {
        const json = (await res.json()) as { error?: { message?: string } }
        if (json?.error?.message) {
          errorDetail = json.error.message
        }
      } catch {
        void 0
      }
      if (!errorDetail) {
        errorDetail = (await res.text()).slice(0, 300) || res.statusText
      }

      const msg =
        res.status === 401
          ? cleanKey
            ? `身份验证失败 (HTTP 401): ${errorDetail}（请检查 API Key 是否有效）`
            : isLocalEndpoint(trimmed)
              ? `接口要求 API Key (HTTP 401): ${errorDetail}（该本地接口启用了鉴权，请填写它的 API Key）`
              : `接口要求 API Key (HTTP 401): ${errorDetail}（请填写该接口的 API Key）`
          : `HTTP ${res.status}: ${errorDetail}`
      return { success: false, error: msg }
    }
    const json = (await res.json()) as {
      data?: unknown[]
      models?: unknown[]
    }
    const rawList = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.models)
        ? json.models
        : []
    const models = rawList
      .map((entry) =>
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? toModelInfo(entry as RawModel)
          : null
      )
      .filter((model): model is AgentModelInfo => model !== null)
      .sort((a, b) => a.id.localeCompare(b.id))
    return { success: true, models }
  } catch (err) {
    const message = err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err)
    return { success: false, error: `连接失败: ${message}（请检查接口地址与网络）` }
  }
}
