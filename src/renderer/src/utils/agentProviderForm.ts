import {
  AgentProviderConfig,
  AgentProviderModelConfig,
  cleanAgentApiKey,
  isAgentModelInput,
  isValidAgentReasoningEfforts,
  normalizeAgentApiFormat
} from '@shared/index'

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export interface AgentProviderModelError {
  index: number
  message: string
}

export type AgentProviderBuildResult =
  { ok: true; provider: AgentProviderConfig } | { ok: false; error: string }

export function validateProviderId(id: string, taken: string[]): string | undefined {
  const trimmed = id.trim()
  if (trimmed.length === 0) return '请填写 Provider ID。'
  if (!PROVIDER_ID_PATTERN.test(trimmed)) {
    return '需以小写字母开头，之后可用小写字母、数字和短横线。'
  }
  if (taken.includes(trimmed)) return '已有提供商使用了这个 ID。'
  return undefined
}

export function validateBaseUrl(url: string): string | undefined {
  const trimmed = url.trim()
  if (trimmed.length === 0) return '请填写 API 地址。'
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return undefined
  } catch {
    void 0
  }
  return '请输入有效的 HTTP 或 HTTPS 地址。'
}

export function validateProviderModels(
  models: AgentProviderModelConfig[]
): AgentProviderModelError | undefined {
  const seen = new Set<string>()
  for (const [index, model] of models.entries()) {
    const id = model.id.trim()
    if (id.length === 0) return { index, message: '模型 ID 不能为空。' }
    if (seen.has(id)) return { index, message: '模型 ID 不能重复。' }
    seen.add(id)
    if (
      model.contextWindow !== undefined &&
      (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)
    ) {
      return { index, message: '上下文窗口必须是正数，例如 131072、256K 或 1M。' }
    }
    if (
      model.maxTokens !== undefined &&
      (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)
    ) {
      return { index, message: '最大输出 token 数必须是正数，例如 8192、64K 或 1M。' }
    }
    if (model.input !== undefined && !model.input.some((input) => isAgentModelInput(input))) {
      return { index, message: '输入类型至少保留一种。' }
    }
    if (model.reasoningEfforts !== undefined) {
      if (!isValidAgentReasoningEfforts(model.reasoningEfforts)) {
        const levels = Object.keys(model.reasoningEfforts)
        return {
          index,
          message: levels.some((level) => level !== 'off')
            ? 'Off 以外的档位都需要填写 API 参数值，且参数值不能为空字符串。'
            : '至少添加一个 Off 以外的档位；不需要思考请关闭推理等级。'
        }
      }
    }
  }
  return undefined
}

export function buildAgentProvider(provider: AgentProviderConfig): AgentProviderBuildResult {
  const baseUrlError = validateBaseUrl(provider.baseUrl)
  if (baseUrlError) return { ok: false, error: baseUrlError }
  const modelError = validateProviderModels(provider.models)
  if (modelError) return { ok: false, error: `模型 ${modelError.index + 1}：${modelError.message}` }

  const models = provider.models.map((model) => ({
    ...model,
    id: model.id.trim(),
    ...(model.name?.trim() ? { name: model.name.trim() } : { name: undefined })
  }))

  return {
    ok: true,
    provider: {
      ...provider,
      id: provider.id.trim(),
      name: provider.name.trim() || provider.id.trim(),
      baseUrl: provider.baseUrl.trim(),
      apiFormat: normalizeAgentApiFormat(provider.apiFormat),
      apiKey: cleanAgentApiKey(provider.apiKey),
      models: models.map((model) => {
        const { name, ...rest } = model
        return name ? { ...rest, name } : rest
      })
    }
  }
}
