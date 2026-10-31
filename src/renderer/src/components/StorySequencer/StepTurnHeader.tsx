import React from 'react'
import { Duelist } from '@shared/index'
import { sideName } from './stepLogFormat'
import { cn } from '../../lib/utils'

interface StepTurnHeaderProps {
  turn: number
  turnPlayer: 0 | 1
  lp: [number, number]
  duelists: Duelist[] | undefined
  sharedLp?: boolean
}

const TEAM_STYLES = [
  {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    lp: 'text-blue-700 dark:text-blue-300',
    panel: 'border-blue-500/30 bg-blue-500/[0.06]'
  },
  {
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    lp: 'text-rose-700 dark:text-rose-300',
    panel: 'border-rose-500/30 bg-rose-500/[0.06]'
  }
] as const

const TURN_PLAYER_STYLES = [
  'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
] as const

function teamName(duelists: Duelist[] | undefined, team: 0 | 1): string {
  const members = (duelists || []).filter((duelist) => duelist.team === team)
  if (members.length === 0) return sideName(team)
  return members.map((duelist) => duelist.name).join('／') || sideName(team)
}

export const StepTurnHeader: React.FC<StepTurnHeaderProps> = ({
  turn,
  turnPlayer,
  lp,
  duelists,
  sharedLp = false
}) => (
  <div className="flex flex-col gap-1 border-y border-border/70 bg-muted/40 px-2 py-1.5 select-none">
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-extrabold text-foreground">第 {turn} 回合</span>
      <span
        className={cn(
          'rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none',
          TURN_PLAYER_STYLES[turnPlayer]
        )}
      >
        {sideName(turnPlayer)}行动
      </span>
      {sharedLp && (
        <span className="rounded border border-border/60 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground">
          共用 LP
        </span>
      )}
    </div>

    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {([0, 1] as const).map((team) => {
        const styles = TEAM_STYLES[team]
        const active = team === turnPlayer
        const members = (duelists || []).filter((duelist) => duelist.team === team)
        const independent = members.length > 1 && !sharedLp
        return (
          <div
            key={team}
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-0.5',
              active ? styles.panel : 'border-transparent'
            )}
          >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />
            {independent ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold">
                {members.map((member) => (
                  <span key={member.id} className="flex min-w-0 items-center gap-1">
                    <span className={cn('truncate', active ? styles.text : 'text-foreground/80')}>
                      {member.name}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[11px] font-bold tabular-nums',
                        active ? styles.lp : 'text-foreground/80'
                      )}
                    >
                      {member.lp}
                    </span>
                  </span>
                ))}
                <span className="shrink-0 text-[8px] font-bold text-muted-foreground">LP</span>
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    'min-w-0 truncate text-[10px] font-semibold',
                    active ? styles.text : 'text-foreground/80'
                  )}
                >
                  {teamName(duelists, team)}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[11px] font-bold tabular-nums',
                    active ? styles.lp : 'text-foreground/80'
                  )}
                >
                  {lp[team]}
                </span>
                <span className="shrink-0 text-[8px] font-bold text-muted-foreground">LP</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  </div>
)
