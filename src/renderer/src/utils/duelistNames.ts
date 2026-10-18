import { Duelist, DuelPuzzleState } from '@shared/index'

function turnOrderOf(duelist: Duelist): number {
  return duelist.turnOrder ?? (duelist.isFirst ? 1 : 2)
}

export function resolveTeamColorClass(team: 0 | 1): string {
  return team === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
}

export function resolveTeamLabel(
  state: Pick<DuelPuzzleState, 'duelists'>,
  team: 0 | 1,
  currentTurn = 1
): string {
  const fallback = team === 0 ? '我方' : '对方'
  const duelists = state.duelists || []
  const teamDuelists = duelists.filter((d) => d.team === team)
  if (teamDuelists.length === 0) return fallback
  if (teamDuelists.length === 1) return teamDuelists[0].name || fallback

  const rotation = [...duelists].sort((a, b) => turnOrderOf(a) - turnOrderOf(b))
  const acting = rotation[(currentTurn - 1) % rotation.length]
  if (acting && acting.team === team && acting.name) return acting.name

  const sorted = [...teamDuelists].sort((a, b) => turnOrderOf(a) - turnOrderOf(b))
  const headOrder = turnOrderOf(sorted[0])
  return (
    sorted
      .filter((d) => turnOrderOf(d) === headOrder)
      .map((d) => d.name)
      .filter(Boolean)
      .join('／') || fallback
  )
}
