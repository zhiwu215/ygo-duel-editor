import type { StateCreator } from 'zustand'
import { AgentTextSourceRef, DuelPuzzleState } from '@shared/index'
import type { AgentChatMessage, AgentStore } from './types'

export interface ChatSlice {
  messages: AgentChatMessage[]
  isGenerating: boolean
  sendMessage: (
    prompt: string,
    boardState?: DuelPuzzleState,
    injectedPrompt?: string,
    attachedCards?: { id: number; name: string; type?: number }[],
    textSource?: AgentTextSourceRef
  ) => Promise<void>
  abort: () => Promise<void>
  resetSession: () => Promise<void>
}

export const createChatSlice: StateCreator<AgentStore, [], [], ChatSlice> = (set, get) => ({
  messages: [],
  isGenerating: false,

  sendMessage: async (prompt, boardState, injectedPrompt, attachedCards, textSource) => {
    if (!prompt.trim() && !injectedPrompt?.trim()) return
    if (get().isGenerating) return

    const userMessage: AgentChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      attachedCards,
      textSource: textSource
        ? {
            title: textSource.title,
            wordCount: textSource.wordCount,
            textId: textSource.textId,
            chapterIds: textSource.chapterIds
          }
        : undefined,
      createdAt: Date.now()
    }

    const assistantMessage: AgentChatMessage = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      thought: '',
      toolCalls: [],
      createdAt: Date.now()
    }

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isGenerating: true
    }))

    let streamedText = ''
    let streamedThought = ''
    let flushedText = ''
    let flushedThought = ''
    let flushTimer: number | null = null

    const updateAssistant = (patch: Partial<AgentChatMessage>): void => {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantMessage.id ? { ...message, ...patch } : message
        )
      }))
    }

    const flushStream = (): void => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer)
        flushTimer = null
      }
      if (streamedText === flushedText && streamedThought === flushedThought) return
      flushedText = streamedText
      flushedThought = streamedThought
      updateAssistant({ content: streamedText, thought: streamedThought })
    }

    const scheduleFlush = (): void => {
      if (flushTimer !== null) return
      flushTimer = window.setTimeout(flushStream, 32)
    }

    const unsubscribe = window.api?.onAgentEvent?.((event) => {
      switch (event.type) {
        case 'text_delta':
          streamedText += event.delta
          scheduleFlush()
          break
        case 'thinking_delta':
          streamedThought += event.delta
          scheduleFlush()
          break
        case 'status':
          flushStream()
          updateAssistant({ status: event.message })
          break
        case 'tool_call_start':
          flushStream()
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    toolCalls: [
                      ...(message.toolCalls ?? []),
                      {
                        id: event.id,
                        toolName: event.toolName,
                        params: event.params
                      }
                    ]
                  }
                : message
            )
          }))
          break
        case 'tool_call_end':
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    toolCalls: (message.toolCalls ?? []).map((call) =>
                      call.id === event.id
                        ? { ...call, resultSummary: event.resultSummary, details: event.details }
                        : call
                    )
                  }
                : message
            )
          }))
          break
        case 'done':
          flushStream()
          updateAssistant({
            content: event.fullText,
            status: undefined,
            error: undefined
          })
          break
        case 'error':
          flushStream()
          updateAssistant({ error: event.message, status: undefined })
          break
      }
    })

    try {
      if (!window.api?.agentSendMessage) {
        throw new Error('当前环境不支持 AI 顾问调用')
      }

      const res = await window.api.agentSendMessage({
        prompt: injectedPrompt?.trim() || prompt.trim(),
        question: prompt.trim(),
        boardState,
        textSource,
        configOverride: get().config
      })

      if (!res.success) {
        set((state) => ({
          isGenerating: false,
          messages: state.messages.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  error: res.error || '未知错误',
                  status: undefined
                }
              : m
          )
        }))
      } else {
        set((state) => ({
          isGenerating: false,
          messages: state.messages.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: res.content || m.content,
                  thought: res.thought || m.thought,
                  status: undefined,
                  error: undefined
                }
              : m
          )
        }))
      }
    } catch (err: unknown) {
      set((state) => ({
        isGenerating: false,
        messages: state.messages.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                error: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
                status: undefined
              }
            : m
        )
      }))
    } finally {
      unsubscribe?.()
      flushStream()
    }
  },

  abort: async () => {
    if (window.api?.agentAbort) {
      await window.api.agentAbort()
    }
    set({ isGenerating: false })
  },

  resetSession: async () => {
    try {
      await window.api?.agentResetSession?.()
    } catch (err) {
      console.error('[useAgentStore] resetSession failed:', err)
    }
    set({ messages: [], isGenerating: false })
  }
})
