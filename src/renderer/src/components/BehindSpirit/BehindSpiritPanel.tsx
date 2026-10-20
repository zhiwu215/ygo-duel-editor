import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect, useRef, JSX } from 'react'
import { createPortal } from 'react-dom'
import {
  Send,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Bot,
  Loader2,
  Paperclip,
  BookOpen
} from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { DuelProposalSummaryCard } from './DuelProposalSummaryCard'
import { MarkdownContent } from './MarkdownContent'
import { TextSourcePicker } from './TextSourcePicker'
import { ToolCallList } from './ToolCallList'
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
    config,
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
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({})

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
    attachText,
    clearAttachments,
    textPickerOpen,
    textPickerPos,
    textPickerAnchorRef,
    openTextPicker,
    closeTextPicker
  } = useChatAttachments()

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const toolbarRef = useRef<HTMLDivElement>(null)

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
      attachedCards.map((c) => ({ id: c.id, name: c.name })),
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

  const toggleThought = (msgId: string): void => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }))
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
              {!config.apiKey && (
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  尚未连接模型提供商：点击窗口左下角的「设置」补全 Key，
                  或在下方工具栏直接切换已配好的提供商与模型。
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 select-none">
                  {msg.role === 'user' ? (
                    <span>创作者</span>
                  ) : (
                    <span className="font-bold text-foreground">背后灵</span>
                  )}
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>

                <div
                  className={`rounded-lg p-2.5 max-w-[95%] min-w-0 text-xs leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'bg-muted text-foreground font-medium'
                      : 'bg-card border border-border/80 text-foreground shadow-xs'
                  }`}
                >
                  {msg.thought && (
                    <div className="mb-2 border-b border-border/40 pb-2">
                      <button
                        type="button"
                        onClick={() => toggleThought(msg.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold hover:text-foreground hover:underline"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>{expandedThoughts[msg.id] ? '收起思考过程' : '展开深度思考链'}</span>
                        {expandedThoughts[msg.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      {expandedThoughts[msg.id] && (
                        <ScrollArea className="mt-1.5 rounded bg-neutral-100 max-h-48 border border-border/30">
                          <div className="p-2 dark:bg-neutral-900/80 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap">
                            {msg.thought}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}

                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <ToolCallList calls={msg.toolCalls} isStreaming={isGenerating} />
                  )}

                  {msg.status && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span>{msg.status}</span>
                    </div>
                  )}

                  {msg.role === 'user' && msg.textSource && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground min-w-0">
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-64">{msg.textSource.title}</span>
                        {msg.textSource.wordCount ? (
                          <span className="shrink-0 font-mono">
                            约 {msg.textSource.wordCount} 字
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  {msg.attachedCards && msg.attachedCards.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                      {msg.attachedCards.map((c) => (
                        <span
                          key={c.id}
                          className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {msg.content}
                    </div>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  {isGenerating &&
                    msg.role === 'assistant' &&
                    msg === messages[messages.length - 1] && (
                      <span className="inline-block w-1.5 h-3 ml-1 bg-foreground animate-pulse" />
                    )}

                  {(msg.boardSetup || (msg.proposals && msg.proposals.length > 0)) && (
                    <DuelProposalSummaryCard
                      setup={msg.boardSetup}
                      proposals={msg.proposals ?? []}
                      applied={appliedMessageId === msg.id}
                      applying={applyingProposalMsgId === msg.id}
                      error={proposalError?.msgId === msg.id ? proposalError.text : null}
                      onApply={() => void handleApplyProposal(msg.id)}
                    />
                  )}
                </div>
              </div>
            ))
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

          <div className="flex items-center justify-between gap-1.5" ref={toolbarRef}>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div ref={textPickerAnchorRef} className="shrink-0">
                <button
                  type="button"
                  onClick={openTextPicker}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center transition-colors',
                    textPickerOpen
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative min-w-0 flex-1">
                <ModelPickerMenu toolbarRef={toolbarRef} />
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

      {textPickerOpen &&
        createPortal(
          <TextSourcePicker
            pos={textPickerPos}
            anchorRef={textPickerAnchorRef}
            onClose={closeTextPicker}
            onAttach={attachText}
          />,
          document.body
        )}
    </div>
  )
}
