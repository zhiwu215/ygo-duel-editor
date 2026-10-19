import type { StateCreator } from 'zustand'
import {
  DuelSceneSnapshot,
  Duelist,
  MatchConfig,
  createDefaultDuelists,
  createLightweightSnapshot,
  getMatchScenarioKey
} from '@shared/index'
import { createLpFlash } from './lpSlice'
import type { DuelStore } from './types'
import { turnOrderOf } from '../../utils/duelistNames'
import { isAutoRecordingPaused } from './recordingGate'

export interface DuelistsSlice {
  expandedDuelistId: string | null
  activeDuelistId: string | null
  setExpandedDuelistId: (id: string | null) => void
  setActiveDuelistId: (id: string | null) => void

  switchMatchConfig: (config: MatchConfig) => void
  updateDuelist: (duelistId: string, patch: Partial<Duelist>) => void
  setDuelistTurnOrder: (duelistId: string, newOrder: number) => void
  toggleSharedLp: () => void
}

export const createDuelistsSlice: StateCreator<DuelStore, [], [], DuelistsSlice> = (set) => ({
  expandedDuelistId: null,
  activeDuelistId: null,
  setExpandedDuelistId: (id) => set({ expandedDuelistId: id }),
  setActiveDuelistId: (id) => set({ activeDuelistId: id }),

  switchMatchConfig: (newConfig) =>
    set((prev) => {
      const currentConfig = prev.state.matchConfig || {
        mode: '1v1',
        team0Count: 1,
        team1Count: 1,
        sharedLp: false
      }
      const currentKey = getMatchScenarioKey(currentConfig)
      const targetKey = getMatchScenarioKey(newConfig)

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
        initialBoardSnapshot: prev.state.initialBoardSnapshot
      }

      const updatedScenarios: Record<string, DuelSceneSnapshot> = {
        ...(prev.state.scenarios || {}),
        [currentKey]: currentSnapshot
      }

      const resetRuntime = {
        expandedDuelistId: null,
        activeDuelistId: null,
        selectedCardId: null,
        currentStepIndex: null,
        currentTurn: 1,
        currentPhase: 'M1' as const,
        currentChain: 0
      }

      if (updatedScenarios[targetKey]) {
        const snap = updatedScenarios[targetKey]
        return {
          state: {
            ...prev.state,
            matchConfig: newConfig,
            duelists: snap.duelists,
            cards: snap.cards,

            players: snap.players ?? prev.state.players,
            initialBoardSnapshot: snap.initialBoardSnapshot ?? prev.state.initialBoardSnapshot,
            turnPlayer: snap.turnPlayer,
            firstTurnAttack: snap.firstTurnAttack,
            steps: snap.steps,
            scenarios: updatedScenarios
          },
          ...resetRuntime,
          activeTurnPlayer: snap.turnPlayer
        }
      }

      const newDuelists = createDefaultDuelists(newConfig.team0Count, newConfig.team1Count)

      return {
        state: {
          ...prev.state,
          matchConfig: newConfig,
          duelists: newDuelists,
          cards: [],
          players: [
            { lp: 8000, maxHand: 0, startHand: 0 },
            { lp: 8000, maxHand: 0, startHand: 0 }
          ],
          steps: [],
          initialBoardSnapshot: undefined,
          turnPlayer: 0,
          firstTurnAttack: newConfig.mode === '1v1' ? prev.state.firstTurnAttack : false,
          scenarios: updatedScenarios
        },
        ...resetRuntime
      }
    }),

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
      let nextSteps = prev.state.steps || []

      if (updatedLp !== undefined) {
        const oldLp = target ? target.lp : (players[targetTeam]?.lp ?? 8000)
        const diff = Math.abs(updatedLp - oldLp)
        if (prev.isAutoRecording && !isAutoRecordingPaused() && diff > 0) {
          const isDamage = updatedLp < oldLp
          const roleName = target?.name || (targetTeam === 0 ? '我方' : '对方')
          nextSteps = [
            ...nextSteps,
            {
              id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              turn: prev.currentTurn,
              turnPlayer: prev.activeTurnPlayer,
              phase: prev.currentPhase,
              actionPlayer: targetTeam,
              actionType: isDamage ? 'DAMAGE' : 'RECOVER',
              description: isDamage
                ? `${roleName}受到 ${diff} 点伤害 (LP: ${oldLp} → ${updatedLp})`
                : `${roleName}回复 ${diff} 点生命值 (LP: ${oldLp} → ${updatedLp})`,
              lpChange: { player: targetTeam, oldLp, newLp: updatedLp },
              boardAfter: createLightweightSnapshot(prev.state.cards)
            }
          ]
        }

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
          players,
          steps: nextSteps,
          initialBoardSnapshot:
            prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
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

      return {
        state: {
          ...prev.state,
          duelists,
          turnPlayer
        }
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
