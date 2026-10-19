import { AgentFetchModelsParams, AgentFetchModelsResult } from '@shared/index'

export function useAgentModelFetch(): {
  supported: boolean
  fetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>
} {
  const supported = Boolean(window.api?.agentFetchModels)

  const fetchModels = async (params: AgentFetchModelsParams): Promise<AgentFetchModelsResult> => {
    if (!window.api?.agentFetchModels) return { success: false, error: '模型接口不可用' }
    return window.api.agentFetchModels(params)
  }

  return { supported, fetchModels }
}
