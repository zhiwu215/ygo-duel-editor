import React from 'react'
import { Duelist } from '@shared/index'
import { resolveTeamLabel } from '../../utils/duelistNames'
import { cn } from '../../lib/utils'

interface StepTurnHeaderProps {
  turn: number
  turnPlayer: 0 | 1
  lp: [number, number]
  duelists: Duelist[] | undefined
}

const TEAM_STYLES = [
  {
    dot: 'bg-blue-500',
    panel: 'border-blue-500/40 bg-blue-500/[0.07]',
    lp: 'text-blue-600 dark:text-blue-300'
  },
  {
    dot: 'bg-rose-500',
    panel: 'border-rose-500/40 bg-rose-500/[0.07]',
    lp: 'text-rose-600 dark:text-rose-300'
  }
] as const

const TURN_PLAYER_STYLES = [
  'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
] as const

export const StepTurnHeader: React.FC<StepTurnHeaderProps> = ({
  turn,
  turnPlayer,
  lp,
  duelists
}) => (
  <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-border/70 bg-gradient-to-br from-muted/40 to-card shadow-xs select-none">
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-extrabold text-foreground">第 {turn} 回合</span>
      <span
        className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none',
          TURN_PLAYER_STYLES[turnPlayer]
        )}
      >
        {turnPlayer === 0 ? '我方行动' : '对方行动'}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-1.5">
      {([0, 1] as const).map((team) => {
        const styles = TEAM_STYLES[team]
        const active = team === turnPlayer
        return (
          <div
            key={team}
            className={cn(
              'flex flex-col gap-1 rounded-md border px-1.5 py-1 min-w-0',
              active ? styles.panel : 'border-border/50 bg-background/40'
            )}
          >
            <div className="flex items-center gap-1 min-w-0">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', styles.dot)} />
              <span className="truncate text-[10px] font-semibold text-foreground/90">
                {resolveTeamLabel({ duelists }, team, turn)}
              </span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span
                className={cn(
                  'font-mono text-[13px] font-bold tabular-nums leading-none',
                  active ? styles.lp : 'text-foreground/80'
                )}
              >
                {lp[team]}
              </span>
              <span className="text-[8px] font-bold text-muted-foreground">LP</span>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)
