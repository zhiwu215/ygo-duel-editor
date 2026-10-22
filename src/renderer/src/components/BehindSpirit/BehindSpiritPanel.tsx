import React, { useState, useEffect, useRef, JSX } from 'react'
import { Send, Square, Trash2, Bot, CircleAlert, Info } from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { DuelProposalSummaryCard } from './DuelProposalSummaryCard'
import { MarkdownContent } from './MarkdownContent'
import { MessageCopyButton } from './MessageCopyButton'
import { ReasoningRow } from './ReasoningRow'
import { StreamingStatus } from './StreamingStatus'
import { ToolCallList } from './ToolCallList'
import { UserMessageAttachments } from './UserMessageAttachments'
import { ModelPickerMenu } from './ModelPickerMenu'
import { AttachmentChips } from './AttachmentChips'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { cn } from '../../lib/utils'
import { buildInjectedPrompt } from '../../utils/agentPrompt'
import { useChatAttachments } from '../../hooks/useChatAttachments'

export function BehindSpiritPanel(): JSX.Element {
  const {
    isGenerating,
    messages,
    loadConfig,
    resetSession,
    sendMessage,
    abort,
    applyDuelProposal
  } = useAgentStore()

  const { state: currentBoardState } = useDuelStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null)

  const [applyingProposalMsgId, setApplyingProposalMsgId] = useState<string | null>(null)
  const [proposalError, setProposalError] = useState<{ msgId: string; text: string } | null>(null)

  const {
    attachedCards,
    attachedText,
    isCardDragOver,
    handleDragOver,
    handleDragLeave,
    handleCardDrop,
    removeAttachedCard,
    removeAttachedText,
    clearAttachments
  } = useChatAttachments()

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const chat = chatScrollRef.current
    if (!chat || !shouldAutoScrollRef.current) return

    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: isGenerating ? 'auto' : 'smooth'
    })
  }, [messages, isGenerating])

  const handleChatScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const chat = event.currentTarget
    shouldAutoScrollRef.current = chat.scrollHeight - chat.scrollTop - chat.clientHeight <= 64
  }

  const handleSend = (): void => {
    if ((!inputPrompt.trim() && attachedCards.length === 0 && !attachedText) || isGenerating) return
    shouldAutoScrollRef.current = true

    sendMessage(
      inputPrompt.trim() || (attachedText ? '请把附加的对局原文整理成可演示的对局流程' : ''),
      currentBoardState,
      buildInjectedPrompt(inputPrompt.trim(), attachedCards, attachedText),
      attachedCards.map((card) => ({ id: card.id, name: card.name, type: card.type })),
      attachedText ?? undefined
    )
    setInputPrompt('')
    clearAttachments()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApplyProposal = async (messageId: string): Promise<void> => {
    const msg = useAgentStore.getState().messages.find((m) => m.id === messageId)
    if (!msg) return
    const fieldCards = useDuelStore.getState().state.cards
    if (fieldCards.length > 0) {
      const confirmed = await confirmDialog({
        title: '应用提案',
        description: `当前决斗盘上已有 ${fieldCards.length} 张卡。\n应用会把盘面清空并按提案重建，已排的步骤也会被替换。继续吗？`,
        confirmText: '继续'
      })
      if (!confirmed) return
    }
    setApplyingProposalMsgId(messageId)
    setProposalError(null)
    const sourceRef = msg.textSource?.textId
      ? {
          textId: msg.textSource.textId,
          textTitle: msg.textSource.title,
          chapterIds: msg.textSource.chapterIds ?? []
        }
      : undefined
    const res = await applyDuelProposal(msg.boardSetup ?? null, msg.proposals ?? [], sourceRef)
    setApplyingProposalMsgId(null)
    if (res.ok) {
      setAppliedMessageId(messageId)
      setTimeout(() => setAppliedMessageId(null), 3000)
    } else {
      setProposalError({ msgId: messageId, text: res.error ?? '应用失败' })
    }
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-card/40">
      <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="text-xs font-bold text-foreground">背后灵</h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void resetSession()}
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleCardDrop}
        className={cn(
          'flex-1 flex flex-col min-h-0 bg-background/50 relative transition-colors',
          isCardDragOver && 'bg-primary/5'
        )}
      >
        {isCardDragOver && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className="px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground text-[11px] font-semibold shadow-lg">
              松手附加到下一条提问
            </div>
          </div>
        )}

        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-3 space-y-3 select-text"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground select-none">
              <div className="p-3 rounded-2xl bg-muted text-muted-foreground mb-3 border border-border shadow-xs">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-xs font-bold text-foreground">我是您的决斗创作者背后灵</h3>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isLast = index === messages.length - 1
              const isActive = isGenerating && isLast && msg.role === 'assistant'
              const toolCalls = msg.toolCalls ?? []
              const hasThought = Boolean(msg.thought?.trim())
              const hasContent = msg.content.length > 0
              const hasProposal = Boolean(
                msg.boardSetup || (msg.proposals && msg.proposals.length > 0)
              )
              const statusLabel = hasContent
                ? '正在生成'
                : toolCalls.some((call) => !call.resultSummary)
                  ? '正在调用工具'
                  : hasThought
                    ? '正在思考'
                    : '正在准备'

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="message-enter flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground select-none">
                      <span>创作者</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <UserMessageAttachments
                      cards={msg.attachedCards}
                      text={msg.textSource ?? null}
                    />

                    {hasContent && (
                      <div className="max-w-[95%] min-w-0 rounded-lg bg-muted p-2.5 text-[length:var(--chat-font-size)] leading-relaxed font-medium break-words text-foreground">
                        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {msg.content}
                        </div>
                      </div>
                    )}

                    {hasContent && (
                      <div className="flex items-center px-1">
                        <MessageCopyButton text={msg.content} />
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={msg.id} className="message-enter flex flex-col items-start gap-1.5">
                  <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground select-none">
                    <span className="font-bold text-foreground">背后灵</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  </div>

                  {hasThought && (
                    <ReasoningRow text={msg.thought ?? ''} running={isActive && !hasContent} />
                  )}

                  {toolCalls.length > 0 && (
                    <div className="w-full min-w-0 max-w-[95%]">
                      <ToolCallList calls={toolCalls} isStreaming={isActive} />
                    </div>
                  )}

                  {msg.status && (
                    <div className="flex max-w-[95%] items-center gap-1.5 px-1 text-[10px] leading-4 text-muted-foreground">
                      <Info className="h-3 w-3 shrink-0" />
                      <span className="min-w-0">{msg.status}</span>
                    </div>
                  )}

                  {hasContent && (
                    <div className="max-w-[95%] min-w-0 rounded-lg border border-border/80 bg-card p-2.5 text-[length:var(--chat-font-size)] leading-relaxed break-words text-foreground shadow-xs">
                      <MarkdownContent content={msg.content} isStreaming={isActive} />
                    </div>
                  )}

                  {msg.error && (
                    <div className="flex max-w-[95%] items-start gap-1.5 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[11px] leading-relaxed text-destructive">
                      <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                        {msg.error}
                      </span>
                    </div>
                  )}

                  {hasProposal && (
                    <div className="w-full min-w-0 max-w-[95%]">
                      <DuelProposalSummaryCard
                        setup={msg.boardSetup}
                        proposals={msg.proposals ?? []}
                        applied={appliedMessageId === msg.id}
                        applying={applyingProposalMsgId === msg.id}
                        error={proposalError?.msgId === msg.id ? proposalError.text : null}
                        onApply={() => void handleApplyProposal(msg.id)}
                      />
                    </div>
                  )}

                  {hasContent && !isActive && (
                    <div className="flex max-w-[95%] items-center px-1">
                      <MessageCopyButton text={msg.content} />
                    </div>
                  )}

                  {isActive && <StreamingStatus startTime={msg.createdAt} label={statusLabel} />}
                </div>
              )
            })
          )}
        </div>

        <div className="p-2.5 border-t border-border bg-card/80 flex flex-col gap-2 shrink-0">
          <div className="flex flex-col gap-2 rounded-md">
            <AttachmentChips
              cards={attachedCards}
              text={attachedText}
              onRemoveCard={removeAttachedCard}
              onRemoveText={removeAttachedText}
            />

            <Textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedText
                  ? '已附加素材，说明要怎么整理这段对局即可...'
                  : attachedCards.length > 0
                    ? '已引用卡片，直接提问即可...'
                    : '输入消息...（enter发送，shift+enter换行）'
              }
              rows={2}
              className="resize-none rounded-md border-border bg-background text-xs leading-relaxed focus-visible:ring-1"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div className="relative min-w-0 flex-1">
                <ModelPickerMenu />
              </div>
            </div>

            {isGenerating ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={abort}
                className="h-7 shrink-0 px-3 text-xs gap-1 font-semibold"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>中断</span>
              </Button>
            ) : (
              <Button
                size="xs"
                onClick={handleSend}
                disabled={!inputPrompt.trim() && attachedCards.length === 0}
                className="h-7 shrink-0 px-3 text-xs gap-1 font-semibold shadow-xs"
              >
                <Send className="w-3 h-3" />
                <span>发送</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
