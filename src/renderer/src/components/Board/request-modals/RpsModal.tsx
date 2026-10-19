import React from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { submitAnswer } from './engine'

const RPS_OPTIONS = [
  { hand: 'rock', label: '石头', emoji: '✊' },
  { hand: 'scissors', label: '剪刀', emoji: '✌️' },
  { hand: 'paper', label: '布', emoji: '✋' }
] as const

export const RpsModal: React.FC<{ request: EngineRequest }> = ({ request }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-sm">
      <div className="grid grid-cols-3 gap-2">
        {RPS_OPTIONS.map((option) => (
          <Button
            key={option.hand}
            variant="outline"
            disabled={loading}
            className="h-24 flex-col gap-1.5 text-sm font-bold"
            onClick={() => submitAnswer({ kind: 'rps', hand: option.hand })}
          >
            <span className="text-3xl leading-none">{option.emoji}</span>
            {option.label}
          </Button>
        ))}
      </div>
    </RequestModalShell>
  )
}
