import type { CustomCardScriptGenerateEvent } from '@shared/index'

export interface AiScriptTraceState {
  status: string
  startedAt: number
  thinking: string
  script: string
}

export function createAiScriptTrace(startedAt: number): AiScriptTraceState {
  return { status: '正在准备…', startedAt, thinking: '', script: '' }
}

export function applyAiScriptTraceEvent(
  trace: AiScriptTraceState,
  event: CustomCardScriptGenerateEvent
): AiScriptTraceState {
  switch (event.type) {
    case 'status':
      return { ...trace, status: event.message }
    case 'attempt_start':
      return { ...trace, thinking: '', script: '' }
    case 'thinking_delta':
      return { ...trace, thinking: trace.thinking + event.delta }
    case 'script_delta':
      return { ...trace, script: trace.script + event.delta }
  }
}
