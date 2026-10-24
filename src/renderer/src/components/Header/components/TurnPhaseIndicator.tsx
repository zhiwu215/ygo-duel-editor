import React from 'react'
import { DuelPhase, PHASE_SHORT_NAMES, viewTopSeatOf } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { resolveTeamColorClass, resolveTeamLabel } from '../../../utils/duelistNames'
import { Button } from '../../ui/button'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../lib/utils'

const PHASE_SEQUENCE: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

export const TurnPhaseIndicator: React.FC = () => {
  const currentTurn = useDuelStore((s) => s.currentTurn)
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const currentChain = useDuelStore((s) => s.currentChain)
  const activeTurnPlayer = useDuelStore((s) => s.activeTurnPlayer)
  const duelStarted = useDuelStore((s) => s.duelStarted)
  const duelists = useDuelStore((s) => s.state.duelists)
  const viewTopSeat = useDuelStore((s) => viewTopSeatOf(s.state))
  const insertPhaseChange = useDuelStore((s) => s.insertPhaseChange)
  const resetChain = useDuelStore((s) => s.resetChain)
  const isSelfTurn = activeTurnPlayer !== viewTopSeat
  const turnLabel = resolveTeamLabel({ duelists }, activeTurnPlayer, currentTurn)

  if (!duelStarted) return null

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-[11px] font-extrabold leading-none',
            resolveTeamColorClass(activeTurnPlayer)
          )}
        >
          第 {currentTurn} 回合 · {turnLabel}的回合
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] leading-none font-semibold text-muted-foreground">
            {PHASE_SHORT_NAMES[currentPhase] || currentPhase}
          </span>
          <div className="flex items-center gap-0.5">
            {PHASE_SEQUENCE.map((phase) => (
              <span
                key={phase}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  phase === currentPhase
                    ? cn('w-4', isSelfTurn ? 'bg-blue-500' : 'bg-rose-500')
                    : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {currentChain > 0 && (
        <span
          onClick={resetChain}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 cursor-pointer animate-pulse"
        >
          C{currentChain} 结算
        </span>
      )}

      <Button
        variant="outline"
        size="icon-xs"
        onClick={insertPhaseChange}
        className="h-7 w-6 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
