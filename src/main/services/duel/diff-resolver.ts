import {
  EngineBoardState,
  EngineCard,
  EngineDiffMovedCard,
  EngineDiffAddedCard,
  EngineDiffRemovedCard,
  EngineDiffPositionChange,
  EngineDiffLpChange,
  EngineDiffCounterChange,
  EngineDiffResult
} from '@shared/index'

export type {
  EngineDiffMovedCard,
  EngineDiffAddedCard,
  EngineDiffRemovedCard,
  EngineDiffPositionChange,
  EngineDiffLpChange,
  EngineDiffCounterChange,
  EngineDiffResult
}

interface CardKey {
  code: number
  controller: number
  location: number
  sequence: number
}

function cardKey(c: CardKey): string {
  return `${c.code}_${c.controller}_${c.location}_${c.sequence}`
}

function collectFieldCards(state: EngineBoardState): EngineCard[] {
  const list: EngineCard[] = []
  for (const p of state.players) {
    list.push(...p.hand)
    for (const m of p.mzone) {
      if (m) list.push(m)
    }
    for (const s of p.szone) {
      if (s) list.push(s)
    }
    list.push(...p.graveyard)
    list.push(...p.banished)
  }
  return list
}

export function computeDiff(before: EngineBoardState, after: EngineBoardState): EngineDiffResult {
  const result: EngineDiffResult = {
    movedCards: [],
    addedCards: [],
    removedCards: [],
    positionChanges: [],
    lpChanges: [],
    counterChanges: []
  }

  if (before.phase !== after.phase) {
    result.phaseChange = {
      phase: after.phase,
      phaseName: after.phaseName
    }
  }

  if (before.turn !== after.turn || before.turnPlayer !== after.turnPlayer) {
    result.turnChange = {
      turn: after.turn,
      turnPlayer: after.turnPlayer
    }
  }

  for (let i = 0; i < 2; i++) {
    if (before.players[i].lp !== after.players[i].lp) {
      result.lpChanges.push({
        player: i as 0 | 1,
        newLp: after.players[i].lp
      })
    }
  }

  const beforeCards = collectFieldCards(before)
  const afterCards = collectFieldCards(after)

  const beforeMap = new Map<string, EngineCard>()
  for (const c of beforeCards) {
    beforeMap.set(cardKey(c), c)
  }

  const afterMap = new Map<string, EngineCard>()
  for (const c of afterCards) {
    afterMap.set(cardKey(c), c)
  }

  const matchedBefore = new Set<string>()
  const matchedAfter = new Set<string>()

  for (const [key, bc] of beforeMap) {
    const ac = afterMap.get(key)
    if (ac) {
      matchedBefore.add(key)
      matchedAfter.add(key)

      if (bc.position !== ac.position) {
        result.positionChanges.push({
          controller: ac.controller,
          location: ac.location,
          sequence: ac.sequence,
          code: ac.code,
          newPosition: ac.position
        })
      }

      const bcCounters = bc.counters || {}
      const acCounters = ac.counters || {}
      const allCounterTypes = new Set([...Object.keys(bcCounters), ...Object.keys(acCounters)])
      for (const ctStr of allCounterTypes) {
        const ct = Number(ctStr)
        const oldCount = bcCounters[ct] || 0
        const newCount = acCounters[ct] || 0
        if (oldCount !== newCount) {
          result.counterChanges.push({
            controller: ac.controller,
            location: ac.location,
            sequence: ac.sequence,
            code: ac.code,
            counterType: ct,
            newCount
          })
        }
      }
    }
  }

  const unmatchedBefore: EngineCard[] = []
  for (const [key, c] of beforeMap) {
    if (!matchedBefore.has(key)) unmatchedBefore.push(c)
  }

  const unmatchedAfter: EngineCard[] = []
  for (const [key, c] of afterMap) {
    if (!matchedAfter.has(key)) unmatchedAfter.push(c)
  }

  for (const ac of [...unmatchedAfter]) {
    const idx = unmatchedBefore.findIndex((bc) => bc.code === ac.code)
    if (idx !== -1) {
      const bc = unmatchedBefore.splice(idx, 1)[0]
      const acIdx = unmatchedAfter.indexOf(ac)
      if (acIdx !== -1) unmatchedAfter.splice(acIdx, 1)

      result.movedCards.push({
        code: ac.code,
        fromController: bc.controller,
        fromLocation: bc.location,
        fromSequence: bc.sequence,
        toController: ac.controller,
        toLocation: ac.location,
        toSequence: ac.sequence,
        newPosition: ac.position
      })
    }
  }

  for (const c of unmatchedBefore) {
    result.removedCards.push({
      code: c.code,
      controller: c.controller,
      location: c.location,
      sequence: c.sequence
    })
  }

  for (const c of unmatchedAfter) {
    result.addedCards.push({
      code: c.code,
      controller: c.controller,
      location: c.location,
      sequence: c.sequence,
      position: c.position
    })
  }

  return result
}
