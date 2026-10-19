import type { AgentStreamEvent } from '@shared/index'
import type { AgentStore } from './types'

type SetFn = (partial: Partial<AgentStore>) => void
type GetFn = () => AgentStore

export function applyAgentStreamEvent(event: AgentStreamEvent, set: SetFn, get: GetFn): void {
  const { messages } = get()
  const lastMsg = messages[messages.length - 1]

  if (!lastMsg || lastMsg.role !== 'assistant') return

  if (event.type === 'text_delta') {
    set({
      messages: messages.map((m) =>
        m.id === lastMsg.id ? { ...m, content: m.content + event.delta } : m
      )
    })
  } else if (event.type === 'thinking_delta') {
    set({
      messages: messages.map((m) =>
        m.id === lastMsg.id ? { ...m, thought: (m.thought || '') + event.delta } : m
      )
    })
  } else if (event.type === 'status') {
    set({
      messages: messages.map((m) => (m.id === lastMsg.id ? { ...m, status: event.message } : m))
    })
  } else if (event.type === 'tool_call_start') {
    const currentTools = lastMsg.toolCalls || []
    const existing = currentTools.find((t) => t.id === event.id)
    const updated = existing
      ? currentTools.map((t) => (t.id === event.id ? { ...t, ...event } : t))
      : [...currentTools, { id: event.id, toolName: event.toolName, params: event.params }]
    set({
      messages: messages.map((m) => (m.id === lastMsg.id ? { ...m, toolCalls: updated } : m))
    })
  } else if (event.type === 'tool_call_end') {
    const currentTools = lastMsg.toolCalls || []
    const updated = currentTools.map((t) =>
      t.id === event.id ? { ...t, resultSummary: event.resultSummary } : t
    )
    set({
      messages: messages.map((m) => (m.id === lastMsg.id ? { ...m, toolCalls: updated } : m))
    })
  } else if (event.type === 'proposals_ready') {
    set({
      messages: messages.map((m) =>
        m.id === lastMsg.id ? { ...m, proposals: event.proposals } : m
      )
    })
  } else if (event.type === 'board_setup_ready') {
    set({
      messages: messages.map((m) =>
        m.id === lastMsg.id ? { ...m, boardSetup: event.setup, boardSetupApplied: false } : m
      )
    })
  } else if (event.type === 'done') {
    set({
      isGenerating: false,
      messages: messages.map((m) =>
        m.id === lastMsg.id
          ? {
              ...m,
              content: event.fullText || m.content,
              proposals: event.proposals || m.proposals,
              boardSetup: event.boardSetup || m.boardSetup,
              status: undefined
            }
          : m
      )
    })
  } else if (event.type === 'error') {
    set({
      isGenerating: false,
      messages: messages.map((m) =>
        m.id === lastMsg.id
          ? {
              ...m,
              status: undefined,
              error: event.message
            }
          : m
      )
    })
  }
}
