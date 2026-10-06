import { memo, useEffect, useRef, useState, type JSX } from 'react'
import { BrainCircuit, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { usePacedText } from './usePacedText'

const UNMOUNT_DELAY_MS = 300
const MS_PER_SECOND = 1000

function resolveLastLine(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim()
    if (line.length > 0) return line
  }
  return null
}

function ThinkingBlockImpl({
  text,
  isStreaming
}: {
  text: string
  isStreaming: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [duration, setDuration] = useState<number | undefined>(undefined)
  const startRef = useRef<number | null>(null)
  const unmountTimerRef = useRef<number | null>(null)
  const renderedText = usePacedText(text, isStreaming)

  useEffect(() => {
    if (!isStreaming) {
      if (startRef.current === null) return
      const finalTimer = window.setTimeout(() => {
        if (startRef.current === null) return
        setDuration(Math.max(1, Math.round((Date.now() - startRef.current) / MS_PER_SECOND)))
        startRef.current = null
      }, 0)
      return () => window.clearTimeout(finalTimer)
    }

    if (startRef.current === null) startRef.current = Date.now()
    if (!open) return
    const timer = window.setInterval(() => {
      if (startRef.current === null) return
      setDuration(Math.max(1, Math.floor((Date.now() - startRef.current) / MS_PER_SECOND)))
    }, MS_PER_SECOND)
    return () => window.clearInterval(timer)
  }, [isStreaming, open])

  useEffect(() => {
    if (open) {
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current)
        unmountTimerRef.current = null
      }
      return
    }
    if (!shouldRender) return
    const timer = window.setTimeout(() => {
      setShouldRender(false)
      unmountTimerRef.current = null
    }, UNMOUNT_DELAY_MS)
    unmountTimerRef.current = timer
    return () => window.clearTimeout(timer)
  }, [open, shouldRender])

  useEffect(() => {
    return () => {
      if (unmountTimerRef.current !== null) window.clearTimeout(unmountTimerRef.current)
    }
  }, [])

  const streamingSummary = isStreaming && !open ? resolveLastLine(text) : null

  return (
    <div className="mb-2 min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) setShouldRender(true)
          setOpen((current) => !current)
        }}
        className="group/thought flex max-w-full min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0 whitespace-nowrap font-medium">
          {isStreaming ? (
            <span className="animated-gradient-text">正在思考</span>
          ) : (
            <span>
              已思考
              <span className="font-normal text-muted-foreground"> · </span>
              <span className="font-normal text-muted-foreground">
                {duration === undefined ? '片刻' : `${duration} 秒`}
              </span>
            </span>
          )}
        </span>
        {streamingSummary && (
          <>
            <span className="shrink-0">·</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {streamingSummary}
            </span>
          </>
        )}
        <ChevronRight
          className={cn('h-3 w-3 shrink-0 transition-transform duration-200', open && 'rotate-90')}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          {shouldRender && (
            <div className="mt-1.5 ml-2 max-h-48 overflow-y-auto border-l border-border pl-3">
              <div className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {renderedText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const ThinkingBlock = memo(ThinkingBlockImpl)
