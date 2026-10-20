import type { StateCreator } from 'zustand'
import { Duelist, MatchConfig, PlayerState, createDefaultDuelists } from '@shared/index'
import { useStagingStore } from '../useStagingStore'
import type { DuelStore } from './types'

export interface LpFlash {
  id: number
  player: 0 | 1
  delta: number
}

let lpFlashSeq = 0

export function createLpFlash(player: 0 | 1, delta: number): LpFlash {
  return { id: ++lpFlashSeq, player, delta }
}

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

export interface LpSlice {
  lpFlash: LpFlash | null
  setPlayerLp: (player: 0 | 1, lp: number) => void
}

export const createLpSlice: StateCreator<DuelStore, [], [], LpSlice> = (set) => ({
  lpFlash: null,

  setPlayerLp: (player, lp) => {
    useStagingStore.getState().pushOp({ type: 'lp', player, value: Math.max(0, lp) })
    set((prev) => {
      const updatedLp = Math.max(0, lp)
      const previousLp = prev.state.players[player]?.lp
      const players: [PlayerState, PlayerState] = [
        player === 0 ? { ...prev.state.players[0], lp: updatedLp } : prev.state.players[0],
        player === 1 ? { ...prev.state.players[1], lp: updatedLp } : prev.state.players[1]
      ]
      const duelists = applyLpToDuelists(
        prev.state.duelists,
        player,
        updatedLp,
        prev.state.matchConfig
      )
      return {
        lpFlash:
          previousLp === undefined || previousLp === updatedLp
            ? prev.lpFlash
            : createLpFlash(player, updatedLp - previousLp),
        state: { ...prev.state, players, duelists }
      }
    })
  }
})
