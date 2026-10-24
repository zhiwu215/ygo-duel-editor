import React from 'react'
import { Duelist } from '@shared/index'
import { resolveTurnDuelist, turnOrderOf } from '../../utils/duelistNames'
import { cn } from '../../lib/utils'

interface StepTurnHeaderProps {
  turn: number
  turnPlayer: 0 | 1
  lp: [number, number]
  duelists: Duelist[] | undefined
  actingDuelistId?: string
  sharedLp?: boolean
}

const TEAM_STYLES = [
  {
    dot: 'bg-blue-500',
    panel: 'border-blue-500/40 bg-blue-500/[0.07]',
    lp: 'text-blue-600 dark:text-blue-300',
    activeRow: 'bg-blue-500/15 text-blue-700 dark:text-blue-200'
  },
  {
    dot: 'bg-rose-500',
    panel: 'border-rose-500/40 bg-rose-500/[0.07]',
    lp: 'text-rose-600 dark:text-rose-300',
    activeRow: 'bg-rose-500/15 text-rose-700 dark:text-rose-200'
  }
] as const

const TURN_PLAYER_STYLES = [
  'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
] as const

function sortedTeamDuelists(duelists: Duelist[] | undefined, team: 0 | 1): Duelist[] {
  return [...(duelists || [])]
    .filter((duelist) => duelist.team === team)
    .sort((a, b) => turnOrderOf(a) - turnOrderOf(b))
}

export const StepTurnHeader: React.FC<StepTurnHeaderProps> = ({
  turn,
  turnPlayer,
  lp,
  duelists,
  actingDuelistId,
  sharedLp = false
}) => {
  const knownActingId = (duelists || []).some((duelist) => duelist.id === actingDuelistId)
    ? actingDuelistId
    : undefined
  const actingId = knownActingId ?? resolveTurnDuelist(duelists, turn)?.id
  const actingName = (duelists || []).find((duelist) => duelist.id === actingId)?.name
  const turnLabel = actingName ? `${actingName} 行动` : turnPlayer === 0 ? '我方行动' : '对方行动'

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-border/70 bg-gradient-to-br from-muted/40 to-card shadow-xs select-none">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-extrabold text-foreground">第 {turn} 回合</span>
        <span
          className={cn(
            'text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none',
            TURN_PLAYER_STYLES[turnPlayer]
          )}
        >
          {turnLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {([0, 1] as const).map((team) => {
          const styles = TEAM_STYLES[team]
          const members = sortedTeamDuelists(duelists, team)
          const active = team === turnPlayer
          const isMulti = members.length > 1
          const teamName = team === 0 ? '我方' : '对方'
          const headerName = isMulti ? teamName : members[0]?.name || teamName
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
                  {headerName}
                </span>
                {sharedLp || !isMulti ? (
                  <span className="flex items-baseline gap-0.5 ml-auto shrink-0">
                    <span
                      className={cn(
                        'font-mono text-[13px] font-bold tabular-nums leading-none',
                        active ? styles.lp : 'text-foreground/80'
                      )}
                    >
                      {sharedLp ? lp[team] : (members[0]?.lp ?? lp[team])}
                    </span>
                    <span className="text-[8px] font-bold text-muted-foreground">LP</span>
                    {isMulti && (
                      <span className="ml-0.5 rounded border border-border/60 px-1 text-[8px] font-semibold text-muted-foreground">
                        共用
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="ml-auto shrink-0 rounded border border-border/60 px-1 text-[8px] font-semibold text-muted-foreground">
                    独立 LP
                  </span>
                )}
              </div>

              {isMulti && (
                <div className="flex flex-col gap-0.5">
                  {members.map((duelist) => {
                    const isActing = duelist.id === actingId
                    return (
                      <div
                        key={duelist.id}
                        className={cn(
                          'flex items-center gap-1 rounded px-1 py-0.5 min-w-0',
                          isActing ? styles.activeRow : 'text-foreground/80'
                        )}
                      >
                        <span className="truncate text-[10px] font-semibold">{duelist.name}</span>
                        <span className="ml-auto shrink-0 text-[8px] font-mono text-muted-foreground">
                          {turnOrderOf(duelist)} 顺位
                        </span>
                        {!sharedLp && (
                          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums">
                            {duelist.lp}
                          </span>
                        )}
                        {isActing && (
                          <span className="shrink-0 text-[8px] font-bold text-current">行动</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
