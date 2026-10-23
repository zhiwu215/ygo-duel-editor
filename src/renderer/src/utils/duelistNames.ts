import { Duelist, DuelPuzzleState } from '@shared/index'

export function turnOrderOf(duelist: Duelist): number {
  return duelist.turnOrder ?? (duelist.isFirst ? 1 : 2)
}

export function resolveOwnerScope(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  viewerDuelistId: string | null,
  turn: number
): string | null {
  const teamDuelists = (duelists || []).filter((d) => d.team === controller)
  if (teamDuelists.length === 0) return null
  const viewer = teamDuelists.find((d) => d.id === viewerDuelistId)
  if (viewer) return viewer.id
  return resolveTeamTurnDuelist(duelists, controller, turn)?.id ?? teamDuelists[0].id
}

export function resolveViewerDuelist(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  viewerDuelistId: string | null,
  turn: number
): Duelist | null {
  const teamDuelists = (duelists || []).filter((d) => d.team === controller)
  const viewer = teamDuelists.find((d) => d.id === viewerDuelistId)
  return viewer ?? resolveTeamTurnDuelist(duelists, controller, turn) ?? teamDuelists[0] ?? null
}

export function resolveDuelistDeck(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  viewerDuelistId: string | null,
  scopeDuelistId?: string
): Duelist | null {
  const teamDuelists = (duelists || []).filter((d) => d.team === controller)
  const scope =
    (scopeDuelistId ? teamDuelists.find((d) => d.id === scopeDuelistId) : undefined) ||
    teamDuelists.find((d) => d.id === viewerDuelistId) ||
    teamDuelists[0] ||
    null
  return scope && scope.deckId ? scope : null
}

export function resolveDuelistById(
  duelists: Duelist[] | undefined,
  duelistId: string | undefined | null
): Duelist | null {
  if (!duelistId) return null
  return (duelists || []).find((duelist) => duelist.id === duelistId) ?? null
}

export function resolveDuelistName(
  duelists: Duelist[] | undefined,
  duelistId: string | undefined | null
): string | null {
  return resolveDuelistById(duelists, duelistId)?.name ?? null
}

export function resolveTurnDuelist(duelists: Duelist[] | undefined, turn: number): Duelist | null {
  const rotation = [...(duelists || [])].sort((a, b) => turnOrderOf(a) - turnOrderOf(b))
  if (rotation.length === 0) return null
  return rotation[(((turn - 1) % rotation.length) + rotation.length) % rotation.length] ?? null
}

export function resolveTeamTurnDuelist(
  duelists: Duelist[] | undefined,
  controller: 0 | 1,
  turn: number
): Duelist | null {
  const all = duelists || []
  const team = all.filter((d) => d.team === controller)
  if (team.length === 0) return null
  const cycle = Math.max(team.length, ...all.map(turnOrderOf), 1)
  let latest: Duelist | null = null
  let latestTurn = Number.NEGATIVE_INFINITY
  let earliest = team[0]
  for (const duelist of team) {
    const order = turnOrderOf(duelist)
    if (order < turnOrderOf(earliest)) earliest = duelist
    if (order > turn) continue
    const lastTurn = order + Math.floor((turn - order) / cycle) * cycle
    if (lastTurn > latestTurn) {
      latestTurn = lastTurn
      latest = duelist
    }
  }
  return latest ?? earliest
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
