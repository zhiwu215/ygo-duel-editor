export const AGENT_REASONING_EFFORTS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
] as const

export type AgentReasoningEffort = (typeof AGENT_REASONING_EFFORTS)[number]

export type AgentReasoningEfforts = Partial<Record<AgentReasoningEffort, string | null>>

export const DEFAULT_AGENT_REASONING_EFFORT: AgentReasoningEffort = 'medium'

export const AGENT_REASONING_EFFORT_LABELS: Record<AgentReasoningEffort, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max'
}

export function isAgentReasoningEffort(value: unknown): value is AgentReasoningEffort {
  return AGENT_REASONING_EFFORTS.some((effort) => effort === value)
}

export function normalizeAgentReasoningEffort(value: unknown): AgentReasoningEffort | undefined {
  return isAgentReasoningEffort(value) ? value : undefined
}

export function normalizeAgentReasoningEfforts(value: unknown): AgentReasoningEfforts | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const efforts: AgentReasoningEfforts = {}
  for (const level of AGENT_REASONING_EFFORTS) {
    if (!(level in record)) continue
    const wire = record[level]
    if (level === 'off') {
      efforts.off = typeof wire === 'string' && wire.trim().length > 0 ? wire.trim() : null
      continue
    }
    if (typeof wire !== 'string' || wire.trim().length === 0) continue
    efforts[level] = wire.trim()
  }
  return Object.keys(efforts).length > 0 ? efforts : undefined
}

export function agentReasoningLevels(
  efforts: AgentReasoningEfforts | undefined
): AgentReasoningEffort[] {
  if (!efforts) return []
  return AGENT_REASONING_EFFORTS.filter((level) => level in efforts)
}

export function hasAgentReasoning(efforts: AgentReasoningEfforts | undefined): boolean {
  return agentReasoningLevels(efforts).some((level) => level !== 'off')
}

export function defaultAgentReasoningEffort(
  efforts: AgentReasoningEfforts | undefined
): AgentReasoningEffort | undefined {
  const levels = agentReasoningLevels(efforts)
  if (levels.length === 0) return undefined
  if (levels.includes(DEFAULT_AGENT_REASONING_EFFORT)) return DEFAULT_AGENT_REASONING_EFFORT
  return levels.find((level) => level !== 'off') ?? 'off'
}

export function resolveAgentReasoningEffort(
  efforts: AgentReasoningEfforts | undefined,
  preferred: AgentReasoningEffort | undefined
): AgentReasoningEffort | undefined {
  const levels = agentReasoningLevels(efforts)
  if (levels.length === 0) return undefined
  if (preferred !== undefined && levels.includes(preferred)) return preferred
  return defaultAgentReasoningEffort(efforts)
}

export function isValidAgentReasoningEfforts(efforts: AgentReasoningEfforts | undefined): boolean {
  const levels = agentReasoningLevels(efforts)
  if (!levels.some((level) => level !== 'off')) return false
  return levels.every((level) => {
    if (level === 'off') return true
    const wire = efforts?.[level]
    return typeof wire === 'string' && wire.trim().length > 0
  })
}
