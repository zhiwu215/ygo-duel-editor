import { Duelist, MatchConfig, createDefaultDuelists } from '@shared/index'

export function applyLpToDuelists(
  duelists: Duelist[] | undefined,
  player: 0 | 1,
  lp: number,
  matchConfig?: MatchConfig
): Duelist[] {
  const baseDuelists =
    duelists ?? createDefaultDuelists(matchConfig?.team0Count ?? 1, matchConfig?.team1Count ?? 1)
  const isShared = matchConfig?.sharedLp
  const teamSize = baseDuelists.filter((d) => d.team === player).length
  return baseDuelists.map((d) => {
    if (d.team === player && (isShared || teamSize <= 1)) {
      return { ...d, lp: Math.max(0, lp) }
    }
    return d
  })
}
