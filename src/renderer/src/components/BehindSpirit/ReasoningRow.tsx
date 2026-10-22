import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { BrainCircuit, ChevronRight } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'
import { cn } from '../../lib/utils'

function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

function latestCompletedParagraphFirstLine(text: string): string {
  let summary = ''
  let paragraphStart = 0
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g
  while (true) {
    const nextParagraph = separator.exec(text)
    const paragraphEnd =
      nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf('\n')
    const newline = text.indexOf('\n', paragraphStart)
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim()
      if (candidate !== '') summary = candidate
    }
    if (nextParagraph === null) return summary
    paragraphStart = nextParagraph.index + nextParagraph[0].length
  }
}

interface ReasoningRowProps {
  text: string
  running: boolean
}

export function ReasoningRow({ text, running }: ReasoningRowProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const summaryText = running ? latestCompletedParagraphFirstLine(text) : firstLine(text)
  const summary = useMemo(() => summaryText.replaceAll('**', ''), [summaryText])
  const hasText = text.trim().length > 0

  useEffect(() => {
    if (!expanded || !running) return
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [expanded, running, text])

  if (!hasText && !running) return null

  return (
    <div className="flex w-full min-w-0 max-w-[95%] flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="group flex min-h-6 w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] leading-5 text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <BrainCircuit
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            running ? 'animate-pulse text-foreground/70' : 'text-muted-foreground'
          )}
        />
        <span className="shrink-0 font-medium text-foreground/70">思考</span>
        {!expanded && (
          <>
            <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/50" />
            {summary ? (
              <span
                data-streaming={running || undefined}
                className={cn(
                  'reasoning-preview min-w-0 flex-1 truncate',
                  running && 'animated-gradient-text'
                )}
              >
                {summary}
              </span>
            ) : (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-muted-foreground/70',
                  running && 'animated-gradient-text'
                )}
              >
                正在整理思路…
              </span>
            )}
          </>
        )}
        {expanded && <span className="min-w-0 flex-1" />}
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>
      {expanded && (
        <div
          ref={bodyRef}
          className="mt-1 ml-5 max-h-64 overflow-y-auto border-l border-border/60 pl-3"
        >
          <MarkdownContent
            content={text || '（暂无思考内容）'}
            className="text-[0.95em] leading-relaxed text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
