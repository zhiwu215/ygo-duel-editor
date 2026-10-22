export const AGENT_MODEL_INPUTS = ['text', 'image'] as const

export type AgentModelInput = (typeof AGENT_MODEL_INPUTS)[number]

export const AGENT_MODEL_INPUT_LABELS: Record<AgentModelInput, string> = {
  text: '文本',
  image: '图片'
}

export function isAgentModelInput(value: unknown): value is AgentModelInput {
  return AGENT_MODEL_INPUTS.some((input) => input === value)
}

export function normalizeAgentModelInputs(value: unknown): AgentModelInput[] | undefined {
  if (!Array.isArray(value)) return undefined
  const inputs = AGENT_MODEL_INPUTS.filter((input) => value.includes(input))
  return inputs.length > 0 ? inputs : undefined
}
