import React, { useEffect, useRef } from 'react'
import { StreamingStatus } from '../common/StreamingStatus'
import type { AiScriptTraceState } from '../../utils/aiScriptTrace'

interface AiScriptTraceProps {
  trace: AiScriptTraceState
}

export const AiScriptTrace: React.FC<AiScriptTraceProps> = ({ trace }) => {
  const thinkingRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const node = thinkingRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [trace.thinking])

  useEffect(() => {
    const node = scriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [trace.script])

  return (
    <div className="flex flex-col gap-2">
      <StreamingStatus startTime={trace.startedAt} label={trace.status} />

      {trace.thinking.trim().length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground">思考</span>
          <div
            ref={thinkingRef}
            className="max-h-32 overflow-y-auto rounded-md border border-border/50 bg-background/60 px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]"
          >
            {trace.thinking}
          </div>
        </div>
      )}

      {trace.script.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground">脚本输出</span>
          <pre
            ref={scriptRef}
            className="max-h-44 overflow-auto rounded-md border border-border/50 bg-background/60 px-2 py-1.5 font-mono text-[length:var(--code-font-size)] leading-relaxed text-foreground/85"
          >
            {trace.script}
          </pre>
        </div>
      )}
    </div>
  )
}
