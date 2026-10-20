import React from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'

export const OptionModal: React.FC<{ request: EngineRequest; data: DataOf<'option'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-lg">
      <div className="flex flex-col">
        {data.options.map((option, index) => (
          <button
            key={`${option.code}-${index}`}
            type="button"
            disabled={loading}
            onClick={() => submitAnswer({ kind: 'option', index })}
            className="flex items-baseline gap-2 border-b border-border/50 px-1.5 py-2 text-left text-xs leading-relaxed transition-colors last:border-b-0 hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="shrink-0 text-[11px] text-muted-foreground">{index + 1}.</span>
            <span className="min-w-0 flex-1 break-words">
              {option.text ?? `选项 ${index + 1}（#${option.code}）`}
            </span>
          </button>
        ))}
        {data.options.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">没有可选项</p>
        )}
      </div>
    </RequestModalShell>
  )
}
