import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { memo, useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { AlertTriangle, BookOpen, Check, Copy, Loader2, Paperclip, Sliders } from 'lucide-react'
import type { AgentChatMessage } from '../../stores/useAgentStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { ContextCompactBlock } from './ContextCompactBlock'
import { DuelProposalSummaryCard } from './DuelProposalSummaryCard'
import { MarkdownContent } from './MarkdownContent'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallList } from './ToolCallList'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const APPLIED_RESET_MS = 3000
const COPIED_RESET_MS = 1500

function ChatMessageItemImpl({
  message,
  isLast,
  isGenerating
}: {
  message: AgentChatMessage
  isLast: boolean
  isGenerating: boolean
}): JSX.Element {
  const applyDuelProposal = useAgentStore((s) => s.applyDuelProposal)
  const applyEngineSteps = useAgentStore((s) => s.applyEngineSteps)
  const applyCardSwap = useAgentStore((s) => s.applyCardSwap)

  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  const isUser = message.role === 'user'
  const isStreaming = isGenerating && isLast

  const scheduleReset = useCallback((reset: () => void, delay: number): void => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      reset()
      resetTimerRef.current = null
    }, delay)
  }, [])

  const handleCopy = useCallback((): void => {
    void navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true)
        scheduleReset(() => setCopied(false), COPIED_RESET_MS)
      })
      .catch(() => {
        setCopied(false)
      })
  }, [message.content, scheduleReset])

  const finishApply = useCallback(
    (ok: boolean, error?: string): void => {
      setApplying(false)
      if (ok) {
        setApplyError(null)
        setApplied(true)
        scheduleReset(() => setApplied(false), APPLIED_RESET_MS)
        return
      }
      setApplyError(error ?? '应用失败')
    },
    [scheduleReset]
  )

  const handleApplyProposal = useCallback(async (): Promise<void> => {
    const fieldCards = useDuelStore.getState().state.cards
    if (fieldCards.length > 0) {
      const confirmed = await confirmDialog({
        title: '应用提案会清空当前盘面',
        description: `当前决斗盘上已有 ${fieldCards.length} 张卡。应用会把盘面清空并按提案重建，已排的步骤也会被替换。`,
        confirmText: '继续'
      })
      if (!confirmed) return
    }
    setApplying(true)
    setApplyError(null)
    const res = await applyDuelProposal(message.boardSetup ?? null, message.proposals ?? [])
    finishApply(res.ok, res.error)
  }, [applyDuelProposal, finishApply, message.boardSetup, message.proposals])

  const handleApplySwap = useCallback(async (): Promise<void> => {
    if (!message.cardSwap?.placements?.length) return
    setApplying(true)
    setApplyError(null)
    const res = await applyCardSwap(message.cardSwap)
    finishApply(res.ok, res.error)
  }, [applyCardSwap, finishApply, message.cardSwap])

  const handleApplyEngineSteps = useCallback(async (): Promise<void> => {
    if (!message.engineSteps?.length) return
    const existingSteps = useDuelStore.getState().state.steps ?? []
    if (existingSteps.length > 0) {
      const confirmed = await confirmDialog({
        title: '应用会替换步骤时间线',
        description: `当前决斗场已排有 ${existingSteps.length} 步。应用会替换整条步骤时间线（引擎对局 ${message.engineSteps.length} 步）。`,
        confirmText: '继续'
      })
      if (!confirmed) return
    }
    setApplying(true)
    setApplyError(null)
    const res = await applyEngineSteps(message.engineSteps, message.engineInitialCards)
    finishApply(res.ok, res.error)
  }, [applyEngineSteps, finishApply, message.engineInitialCards, message.engineSteps])

  return (
    <div
      className={cn(
        'group/msg message-enter flex w-full flex-col gap-1',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div className="flex w-full items-center gap-1.5 px-0.5 text-[10px] text-muted-foreground">
        <span className={isUser ? undefined : 'font-bold text-foreground'}>
          {isUser ? '创作者' : '背后灵'}
        </span>
        <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
        {isStreaming && <span className="animated-gradient-text">生成中</span>}
        {message.content && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="复制这条消息"
                  className="ml-auto flex shrink-0 items-center gap-1 rounded px-1 py-0.5 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/msg:opacity-100"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? '已复制' : '复制'}</span>
                </button>
              }
            />
            <TooltipContent>复制这条消息</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className={cn('min-w-0 w-full', isUser && 'max-w-[92%]')}>
        <div
          className={cn(
            'min-w-0 text-xs leading-relaxed',
            isUser && 'rounded-xl rounded-tr-sm bg-muted px-2.5 py-2 font-medium'
          )}
        >
          {message.thought && <ThinkingBlock text={message.thought} isStreaming={isStreaming} />}

          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallList calls={message.toolCalls} isStreaming={isStreaming} />
          )}

          {message.status && (
            <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px]">
              <span className="animated-gradient-text min-w-0 break-words [overflow-wrap:anywhere]">
                {message.status}
              </span>
            </div>
          )}

          {message.compaction && <ContextCompactBlock compaction={message.compaction} />}

          {isUser && message.textSource && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="flex min-w-0 items-center gap-1 rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="max-w-64 truncate">{message.textSource.title}</span>
                      {message.textSource.wordCount ? (
                        <span className="shrink-0 font-mono">
                          约 {message.textSource.wordCount} 字
                        </span>
                      ) : null}
                    </span>
                  }
                />
                <TooltipContent>已附加的文本素材，正文经 read_text_source 工具读取</TooltipContent>
              </Tooltip>
            </div>
          )}

          {message.attachedCards && message.attachedCards.length > 0 && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              {message.attachedCards.map((c) => (
                <Tooltip key={c.id}>
                  <TooltipTrigger
                    render={
                      <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {c.name}
                      </span>
                    }
                  />
                  <TooltipContent>{`卡密 ${c.id}`}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.content}
            </div>
          ) : (
            <div className={cn(isStreaming && message.content && 'markdown-streaming')}>
              <MarkdownContent content={message.content} isStreaming={isStreaming} />
            </div>
          )}

          {message.error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{message.error}</span>
            </div>
          )}

          {message.cardSwap && (
            <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <Sliders className="h-3.5 w-3.5" />
                  <span>卡位替换提案</span>
                </span>
                <Button
                  size="xs"
                  onClick={() => void handleApplySwap()}
                  disabled={applying || applied}
                  className="h-6 shrink-0 gap-1 text-[10px] font-bold"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>应用中...</span>
                    </>
                  ) : applied ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>已替换</span>
                    </>
                  ) : (
                    <span>应用到决斗场</span>
                  )}
                </Button>
              </div>

              <div className="text-[10px] leading-relaxed text-muted-foreground">
                {message.cardSwap.summary}
              </div>

              <div className="space-y-0.5 rounded border border-border/50 bg-muted/20 p-2">
                {message.cardSwap.placements.map((swapItem, i) => (
                  <div
                    key={i}
                    className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span className="shrink-0">
                      {(swapItem.side === 0 ? '我方' : '对方') +
                        ' ' +
                        (swapItem.slot === 'HAND' ? '手牌' : '魔陷区') +
                        `[${swapItem.index}]`}
                    </span>
                    <span className="min-w-0 truncate">
                      {swapItem.replacedName ? `${swapItem.replacedName} → ` : ''}
                      <span className="font-medium text-foreground/90">
                        {swapItem.cardName || `卡密 ${swapItem.code}`}
                      </span>
                      <span className="font-mono text-[9px]"> ({swapItem.code})</span>
                    </span>
                  </div>
                ))}
              </div>

              {message.cardSwap.warnings.length > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className="text-[10px] text-amber-500">
                        {message.cardSwap.warnings.length} 条落位提示
                      </div>
                    }
                  />
                  <TooltipContent>{message.cardSwap.warnings.join('\n')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {message.engineSteps && message.engineSteps.length > 0 && (
            <DuelProposalSummaryCard
              engine={{
                steps: message.engineSteps,
                winner: message.engineWinner ?? null,
                totalTurns: message.engineSteps.reduce((acc, s) => Math.max(acc, s.turn), 0) || 0
              }}
              proposals={[]}
              applied={applied}
              applying={applying}
              error={applyError}
              onApply={() => void handleApplyEngineSteps()}
            />
          )}

          {!message.engineSteps?.length &&
            (message.boardSetup || (message.proposals && message.proposals.length > 0)) && (
              <DuelProposalSummaryCard
                setup={message.boardSetup}
                proposals={message.proposals ?? []}
                applied={applied}
                applying={applying}
                error={applyError}
                onApply={() => void handleApplyProposal()}
              />
            )}
        </div>
      </div>
    </div>
  )
}

export const ChatMessageItem = memo(ChatMessageItemImpl)
