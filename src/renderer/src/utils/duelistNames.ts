import { Duelist, DuelPuzzleState } from '@shared/index'

export function turnOrderOf(duelist: Duelist): number {
  return duelist.turnOrder ?? (duelist.isFirst ? 1 : 2)
}

export function resolveOwnerScope(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  activeDuelistId: string | null
): string | null {
  const match = (duelists || []).find((d) => d.id === activeDuelistId && d.team === controller)
  return match ? activeDuelistId : null
}

export function resolveViewerDuelist(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  activeDuelistId: string | null
): Duelist | null {
  const teamDuelists = (duelists || []).filter((d) => d.team === controller)
  return teamDuelists.find((d) => d.id === activeDuelistId) || teamDuelists[0] || null
}

export function resolveDuelistDeck(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  activeDuelistId: string | null,
  scopeDuelistId?: string
): Duelist | null {
  const teamDuelists = (duelists || []).filter((d) => d.team === controller)
  const scope =
    (scopeDuelistId ? teamDuelists.find((d) => d.id === scopeDuelistId) : undefined) ||
    teamDuelists.find((d) => d.id === activeDuelistId) ||
    teamDuelists[0] ||
    null
  return scope && scope.deckId ? scope : null
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
