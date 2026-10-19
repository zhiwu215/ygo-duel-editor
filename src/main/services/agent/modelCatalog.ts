import { AgentModelInfo, cleanAgentApiKey } from '@shared/index'

const MODEL_LIST_TIMEOUT_MS = 15_000

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
          ? `身份验证失败 (HTTP 401): ${errorDetail}（请检查 API Key 是否有效）`
          : `HTTP ${res.status}: ${errorDetail}`
      return { success: false, error: msg }
    }
    const json = (await res.json()) as {
      data?: { id?: unknown; owned_by?: unknown }[]
      models?: { name?: unknown }[]
    }
    const rawList = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.models)
        ? json.models
        : []
    const models = rawList
      .map((m) => ({
        id:
          typeof m.id === 'string'
            ? m.id
            : typeof (m as { name?: unknown }).name === 'string'
              ? String((m as { name?: unknown }).name)
              : ''
      }))
      .filter((m) => m.id)
      .sort((a, b) => a.id.localeCompare(b.id))
    return { success: true, models }
  } catch (err) {
    const message = err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err)
    return { success: false, error: `连接失败: ${message}（请检查接口地址与网络）` }
  }
}
