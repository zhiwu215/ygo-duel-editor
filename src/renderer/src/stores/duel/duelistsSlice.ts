import type { StateCreator } from 'zustand'
import {
  DuelSceneSnapshot,
  Duelist,
  MatchConfig,
  alignFirstPlayerSeat,
  createDefaultDuelists,
  createStandardTagDuelists,
  getMatchScenarioKey,
  isStandardTag,
  normalizeDuelScenarios,
  normalizeMatchConfig
} from '@shared/index'
import { createLpFlash } from './lpSlice'
import type { DuelStore } from './types'
import { turnOrderOf } from '../../utils/duelistNames'
import { isDuelStarted } from '../../utils/duelStart'

export interface DuelistsSlice {
  expandedDuelistId: string | null
  activeDuelistIds: [string | null, string | null]
  setExpandedDuelistId: (id: string | null) => void
  focusDuelist: (id: string) => void

  switchMatchConfig: (config: MatchConfig) => void
  updateDuelist: (duelistId: string, patch: Partial<Duelist>) => void
  setDuelistTurnOrder: (duelistId: string, newOrder: number) => void
  toggleSharedLp: () => void
}

export const createDuelistsSlice: StateCreator<DuelStore, [], [], DuelistsSlice> = (set, get) => ({
  expandedDuelistId: null,
  activeDuelistIds: [null, null],
  setExpandedDuelistId: (id) => set({ expandedDuelistId: id }),
  focusDuelist: (id) =>
    set((prev) => {
      const team = prev.state.duelists?.find((duelist) => duelist.id === id)?.team
      if (team === undefined || prev.activeDuelistIds[team] === id) return {}
      const activeDuelistIds: [string | null, string | null] = [...prev.activeDuelistIds]
      activeDuelistIds[team] = id
      return { activeDuelistIds }
    }),

  switchMatchConfig: (newConfig) => {
    if (get().sceneEditing) get().exitSceneMode()
    set((prev) => {
      const currentConfig = normalizeMatchConfig(
        prev.state.matchConfig || {
          mode: '1v1',
          team0Count: 1,
          team1Count: 1
        }
      )
      const targetConfig = normalizeMatchConfig(newConfig)
      const currentKey = getMatchScenarioKey(currentConfig)
      const targetKey = getMatchScenarioKey(targetConfig)

      const currentSnapshot: DuelSceneSnapshot = {
        duelists:
          prev.state.duelists ||
          createDefaultDuelists(currentConfig.team0Count, currentConfig.team1Count),
        cards: prev.state.cards,
        turnPlayer: prev.state.turnPlayer,
        firstTurnAttack: prev.state.firstTurnAttack,
        steps: prev.state.steps,
        matchConfig: currentConfig,
        players: prev.state.players,
        initialBoardSnapshot: prev.state.initialBoardSnapshot,
        initialLp: prev.state.initialLp
      }

      const updatedScenarios: Record<string, DuelSceneSnapshot> = {
        ...normalizeDuelScenarios(prev.state.scenarios),
        [currentKey]: currentSnapshot
      }

      const resetRuntime = {
        expandedDuelistId: null,
        activeDuelistIds: [null, null] as [string | null, string | null],
        selectedCardId: null,
        currentStepIndex: null,
        sceneEditing: false,
        currentTurn: 1,
        currentPhase: 'DP' as const,
        currentChain: 0
      }

      if (updatedScenarios[targetKey]) {
        const snap = updatedScenarios[targetKey]
        return {
          state: {
            ...prev.state,
            matchConfig: targetConfig,
            duelists: snap.duelists,
            cards: snap.cards,

            players: snap.players ?? prev.state.players,
            initialBoardSnapshot: snap.initialBoardSnapshot ?? prev.state.initialBoardSnapshot,
            initialLp: snap.initialLp ?? prev.state.initialLp,
            turnPlayer: snap.turnPlayer,
            firstTurnAttack: snap.firstTurnAttack,
            steps: snap.steps,
            scenarios: updatedScenarios
          },
          ...resetRuntime,
          duelStarted: isDuelStarted({ cards: snap.cards, steps: snap.steps }),
          activeTurnPlayer: snap.turnPlayer
        }
      }

      const newDuelists = isStandardTag(targetConfig)
        ? createStandardTagDuelists()
        : createDefaultDuelists(targetConfig.team0Count, targetConfig.team1Count)

      return {
        state: {
          ...prev.state,
          matchConfig: targetConfig,
          duelists: newDuelists,
          cards: [],
          players: [
            { lp: 8000, maxHand: 0, startHand: 0 },
            { lp: 8000, maxHand: 0, startHand: 0 }
          ],
          steps: [],
          initialBoardSnapshot: undefined,
          initialLp: [8000, 8000],
          turnPlayer: 0,
          firstTurnAttack: targetConfig.mode === '1v1' ? prev.state.firstTurnAttack : false,
          scenarios: updatedScenarios
        },
        ...resetRuntime,
        duelStarted: false
      }
    })
  },

  updateDuelist: (duelistId, patch) =>
    set((prev) => {
      let baseDuelists = prev.state.duelists
      if (!baseDuelists || baseDuelists.length === 0) {
        baseDuelists = createDefaultDuelists(
          prev.state.matchConfig?.team0Count ?? 1,
          prev.state.matchConfig?.team1Count ?? 1
        )
        if (prev.state.players[0]) baseDuelists[0].lp = prev.state.players[0].lp
        if (prev.state.players[1]) baseDuelists[1].lp = prev.state.players[1].lp
      }

      let target = baseDuelists.find((d) => d.id === duelistId)
      if (!target) {
        if (duelistId.includes('_0_')) target = baseDuelists.find((d) => d.team === 0)
        else if (duelistId.includes('_1_')) target = baseDuelists.find((d) => d.team === 1)
      }

      const targetId = target ? target.id : duelistId
      const targetTeam: 0 | 1 = target ? target.team : duelistId.includes('_1_') ? 1 : 0
      const updatedLp = patch.lp !== undefined ? Math.max(0, patch.lp) : undefined

      const duelists = baseDuelists.map((d) => {
        if (d.id === targetId) {
          return { ...d, ...patch, ...(updatedLp !== undefined ? { lp: updatedLp } : {}) }
        }
        return d
      })

      let players = prev.state.players

      if (updatedLp !== undefined) {
        if (prev.state.matchConfig?.sharedLp) {
          duelists.forEach((d) => {
            if (d.team === targetTeam) {
              d.lp = updatedLp
            }
          })
        }
        players = [
          targetTeam === 0 ? { ...players[0], lp: updatedLp } : players[0],
          targetTeam === 1 ? { ...players[1], lp: updatedLp } : players[1]
        ]
      }

      return {
        lpFlash:
          updatedLp === undefined || !target || target.lp === updatedLp
            ? prev.lpFlash
            : createLpFlash(targetTeam, updatedLp - target.lp),
        state: {
          ...prev.state,
          duelists,
          players
        }
      }
    }),

  setDuelistTurnOrder: (duelistId, newOrder) =>
    set((prev) => {
      const rawDuelists = prev.state.duelists || []
      const target = rawDuelists.find((d) => d.id === duelistId)
      if (!target) return prev

      const currentTargetOrder = turnOrderOf(target)
      if (currentTargetOrder === newOrder) return prev

      const duelists = rawDuelists.map((d) => ({ ...d }))
      const targetInList = duelists.find((d) => d.id === duelistId)!
      const otherInList = duelists.find((d) => d.id !== duelistId && turnOrderOf(d) === newOrder)

      targetInList.turnOrder = newOrder
      if (otherInList) {
        otherInList.turnOrder = currentTargetOrder
      }

      let turnPlayer = prev.state.turnPlayer
      duelists.forEach((d) => {
        const order = d.turnOrder ?? 2
        d.isFirst = order === 1
        if (d.isFirst) {
          turnPlayer = d.team
        }
      })

      const state = alignFirstPlayerSeat({ ...prev.state, duelists, turnPlayer })

      return {
        state,
        activeTurnPlayer: state.turnPlayer
      }
    }),

  toggleSharedLp: () =>
    set((prev) => {
      const currentConfig = prev.state.matchConfig || {
        mode: '1v1',
        team0Count: 1,
        team1Count: 1,
        sharedLp: false
      }
      const nextShared = !currentConfig.sharedLp
      const nextConfig: MatchConfig = { ...currentConfig, sharedLp: nextShared }

      let duelists = prev.state.duelists || []
      let players = prev.state.players
      if (nextShared) {
        const team0Lp = duelists.find((d) => d.team === 0)?.lp ?? prev.state.players[0].lp
        const team1Lp = duelists.find((d) => d.team === 1)?.lp ?? prev.state.players[1].lp
        duelists = duelists.map((d) => ({
          ...d,
          lp: d.team === 0 ? team0Lp : team1Lp
        }))
        players = [
          { ...players[0], lp: team0Lp },
          { ...players[1], lp: team1Lp }
        ]
      }

      return {
        state: {
          ...prev.state,
          matchConfig: nextConfig,
          duelists,
          players
        }
      }
    })
})
