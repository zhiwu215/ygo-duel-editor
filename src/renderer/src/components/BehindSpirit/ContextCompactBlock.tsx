import { memo, type JSX } from 'react'
import { Archive } from 'lucide-react'
import type { AgentContextCompaction } from '../../stores/useAgentStore'

const OVERFLOW_REASON = 'overflow'

function formatTokens(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

function ContextCompactBlockImpl({
  compaction
}: {
  compaction: AgentContextCompaction
}): JSX.Element {
  const isOverflow = compaction.reason === OVERFLOW_REASON

  const label = compaction.running
    ? isOverflow
      ? '上下文超限，正在整理对话…'
      : '正在整理对话上下文…'
    : compaction.error
      ? '对话上下文整理失败'
      : '已整理对话上下文'

  const tokenText =
    !compaction.running && !compaction.error && compaction.tokensBefore && compaction.tokensAfter
      ? `${formatTokens(compaction.tokensBefore)} → ${formatTokens(compaction.tokensAfter)} token`
      : null

  return (
    <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px]">
      <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
      {compaction.running ? (
        <span className="animated-gradient-text shrink-0 whitespace-nowrap">{label}</span>
      ) : (
        <span className="shrink-0 whitespace-nowrap text-foreground/80">{label}</span>
      )}
      {tokenText && <span className="min-w-0 truncate text-muted-foreground">{tokenText}</span>}
      {compaction.error && (
        <span
          title={compaction.error}
          className="shrink-0 cursor-help whitespace-nowrap text-muted-foreground underline decoration-dotted underline-offset-2"
        >
          详情
        </span>
      )}
      {!compaction.running && !compaction.error && (
        <span
          title={
            isOverflow
              ? '上下文已超出模型窗口，SDK 抢救式压缩了早期对话'
              : '对话接近上下文窗口上限，SDK 把早期对话总结成一条摘要以腾出预算'
          }
          className="shrink-0 whitespace-nowrap text-muted-foreground"
        >
          {isOverflow ? '超限抢救' : '自动压缩'}
        </span>
      )}
    </div>
  )
}

export const ContextCompactBlock = memo(ContextCompactBlockImpl)
