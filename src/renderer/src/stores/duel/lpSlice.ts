import type { StateCreator } from 'zustand'
import { PlayerState, createDefaultDuelists } from '@shared/index'
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
      const isShared = prev.state.matchConfig?.sharedLp
      let baseDuelists = prev.state.duelists
      if (!baseDuelists || baseDuelists.length === 0) {
        baseDuelists = createDefaultDuelists(
          prev.state.matchConfig?.team0Count ?? 1,
          prev.state.matchConfig?.team1Count ?? 1
        )
      }
      const duelists = baseDuelists.map((d) => {
        if (d.team === player) {
          if (isShared || baseDuelists!.filter((item) => item.team === player).length <= 1) {
            return { ...d, lp: updatedLp }
          }
        }
        return d
      })
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
