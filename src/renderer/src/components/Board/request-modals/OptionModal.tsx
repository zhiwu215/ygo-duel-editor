import React from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'

export const OptionModal: React.FC<{ request: EngineRequest; data: DataOf<'option'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-lg">
      <div className="flex flex-col gap-2">
        {data.options.map((option, index) => (
          <Button
            key={`${option.code}-${index}`}
            variant="outline"
            disabled={loading}
            className="h-auto w-full justify-start whitespace-normal py-2.5 text-left text-xs leading-relaxed"
            onClick={() => submitAnswer({ kind: 'option', index })}
          >
            <span className="mr-1.5 shrink-0 font-bold text-muted-foreground">{index + 1}.</span>
            <span>{option.text ?? `选项 ${index + 1}（#${option.code}）`}</span>
          </Button>
        ))}
        {data.options.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">没有可选项</p>
        )}
      </div>
    </RequestModalShell>
  )
}
