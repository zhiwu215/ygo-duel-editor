import {
  createDefaultDuelists,
  createStandardTagDuelists,
  normalizeMatchConfig
} from '@shared/index'
import type { Duelist, EngineBoardState, EngineReplaySummary, MatchConfig } from '@shared/index'

export interface ReplayMatchState {
  matchConfig: MatchConfig
  duelists: Duelist[]
  lp: [number, number]
  turnPlayer: 0 | 1
}

export function buildReplayMatchState(
  info: EngineReplaySummary,
  board: EngineBoardState
): ReplayMatchState {
  const tag = info.isTag
  const baseDuelists = tag ? createStandardTagDuelists() : createDefaultDuelists(1, 1)
  const names = new Map<string, string>(
    tag
      ? [
          ['duelist_0_0', info.hostName],
          ['duelist_1_0', info.clientName],
          ['duelist_0_1', info.tagHostName ?? ''],
          ['duelist_1_1', info.tagClientName ?? '']
        ]
      : [
          ['duelist_0_0', info.hostName],
          ['duelist_1_0', info.clientName]
        ]
  )
  const duelists = baseDuelists.map((duelist) => ({
    ...duelist,
    name: names.get(duelist.id) || duelist.name,
    lp: board.players[duelist.team]?.lp ?? duelist.lp
  }))

  return {
    matchConfig: normalizeMatchConfig(
      tag
        ? { mode: 'tag', team0Count: 2, team1Count: 2, tagFormat: 'standard' }
        : { mode: '1v1', team0Count: 1, team1Count: 1 }
    ),
    duelists,
    lp: [board.players[0].lp, board.players[1].lp],
    turnPlayer: board.turnPlayer
  }
}

export function formatReplayVersus(info: EngineReplaySummary): string {
  const host = info.hostName || '我方'
  const client = info.clientName || '对方'
  if (!info.isTag) return `${host} vs ${client}`
  const tagHost = info.tagHostName || '我方 2'
  const tagClient = info.tagClientName || '对方 2'
  return `${host} / ${tagHost} vs ${client} / ${tagClient}`
}
