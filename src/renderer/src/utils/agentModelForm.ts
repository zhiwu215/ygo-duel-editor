import { AgentProviderModelConfig } from '@shared/index'

export interface AgentModelFormValues {
  id: string
  name: string
  contextWindow: string
  maxTokens: string
  supportsReasoning: boolean
  supportsVision: boolean
  supportsStructuredOutput: boolean
  supportsMidConversationSystem: boolean
}

export function buildAgentModelFormModel(
  values: AgentModelFormValues,
  existingIds: string[],
  initialEnabled?: boolean
): { ok: true; model: AgentProviderModelConfig } | { ok: false; error: string } {
  const id = values.id.trim()
  if (!id) {
    return { ok: false, error: '请填写模型 ID' }
  }
  if (existingIds.includes(id)) {
    return { ok: false, error: `模型「${id}」已存在` }
  }
  const contextWindow = values.contextWindow.trim() ? Number(values.contextWindow) : undefined
  if (contextWindow !== undefined && (!Number.isFinite(contextWindow) || contextWindow <= 0)) {
    return { ok: false, error: '上下文窗口需填写正整数' }
  }
  const maxTokens = values.maxTokens.trim() ? Number(values.maxTokens) : undefined
  if (maxTokens !== undefined && (!Number.isFinite(maxTokens) || maxTokens <= 0)) {
    return { ok: false, error: '最大输出 Token 需填写正整数' }
  }
  return {
    ok: true,
    model: {
      id,
      name: values.name.trim() || undefined,
      contextWindow,
      maxTokens,
      supportsReasoning: values.supportsReasoning,
      supportsVision: values.supportsVision,
      supportsStructuredOutput: values.supportsStructuredOutput,
      supportsMidConversationSystem: values.supportsMidConversationSystem,
      enabled: initialEnabled ?? true,
      custom: true
    }
  }
}
