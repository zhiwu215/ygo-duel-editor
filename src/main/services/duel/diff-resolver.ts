import {
  EngineBoardState,
  EngineCard,
  EngineDiffMovedCard,
  EngineDiffAddedCard,
  EngineDiffRemovedCard,
  EngineDiffPositionChange,
  EngineDiffLpChange,
  EngineDiffCounterChange,
  EngineDiffOverlayChange,
  EngineDiffResult
} from '@shared/index'

export type {
  EngineDiffMovedCard,
  EngineDiffAddedCard,
  EngineDiffRemovedCard,
  EngineDiffPositionChange,
  EngineDiffLpChange,
  EngineDiffCounterChange,
  EngineDiffOverlayChange,
  EngineDiffResult
}

function collectFieldCards(state: EngineBoardState): EngineCard[] {
  const list: EngineCard[] = []
  for (const p of state.players) {
    if (p.deck) list.push(...p.deck)
    if (p.extra) list.push(...p.extra)
    list.push(...p.hand)
    for (const m of p.mzone) {
      if (m) list.push(m)
    }
    for (const s of p.szone) {
      if (s) list.push(s)
    }
    if (p.fzone) list.push(p.fzone)
    for (const z of p.pzone) {
      if (z) list.push(z)
    }
    list.push(...p.graveyard)
    list.push(...p.banished)
  }
  return list
}

function computeOverlayChanges(
  before: EngineBoardState,
  after: EngineBoardState
): EngineDiffOverlayChange[] {
  const changes: EngineDiffOverlayChange[] = []
  for (let i = 0; i < 2; i++) {
    const bp = before.players[i]
    const ap = after.players[i]
    for (let seq = 0; seq < ap.mzone.length; seq++) {
      const bc = bp.mzone[seq]
      const ac = ap.mzone[seq]
      if (!ac) continue
      const beforeMats = bc ? bc.overlayMaterials : []
      const afterMats = ac.overlayMaterials
      const beforeCount = new Map<number, number>()
      for (const code of beforeMats) {
        beforeCount.set(code, (beforeCount.get(code) || 0) + 1)
      }
      const afterCount = new Map<number, number>()
      for (const code of afterMats) {
        afterCount.set(code, (afterCount.get(code) || 0) + 1)
      }
      for (const [code, count] of afterCount) {
        const oldCount = beforeCount.get(code) || 0
        if (count > oldCount) {
          changes.push({
            hostInstanceId: ac.instanceId,
            hostController: i as 0 | 1,
            hostSequence: seq,
            materialCode: code,
            matIndex: afterMats.indexOf(code),
            attached: true
          })
        }
      }
      for (const [code, count] of beforeCount) {
        const newCount = afterCount.get(code) || 0
        if (count > newCount) {
          changes.push({
            hostInstanceId: ac.instanceId,
            hostController: i as 0 | 1,
            hostSequence: seq,
            materialCode: code,
            matIndex: beforeMats.indexOf(code),
            attached: false
          })
        }
      }
    }
  }
  return changes
}

export function computeDiff(before: EngineBoardState, after: EngineBoardState): EngineDiffResult {
  const result: EngineDiffResult = {
    movedCards: [],
    addedCards: [],
    removedCards: [],
    positionChanges: [],
    lpChanges: [],
    counterChanges: [],
    overlayChanges: computeOverlayChanges(before, after)
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

  const beforeById = new Map<string, EngineCard>()
  for (const c of beforeCards) {
    beforeById.set(c.instanceId, c)
  }
  const afterById = new Map<string, EngineCard>()
  for (const c of afterCards) {
    afterById.set(c.instanceId, c)
  }

  const matchedBefore = new Set<string>()
  const matchedAfter = new Set<string>()

  for (const [id, bc] of beforeById) {
    const ac = afterById.get(id)
    if (!ac) continue
    matchedBefore.add(id)
    matchedAfter.add(id)

    if (bc.position !== ac.position) {
      result.positionChanges.push({
        instanceId: ac.instanceId,
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
          instanceId: ac.instanceId,
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

  const unmatchedBefore: EngineCard[] = []
  for (const [id, c] of beforeById) {
    if (!matchedBefore.has(id)) unmatchedBefore.push(c)
  }

  const unmatchedAfter: EngineCard[] = []
  for (const [id, c] of afterById) {
    if (!matchedAfter.has(id)) unmatchedAfter.push(c)
  }

  for (const ac of [...unmatchedAfter]) {
    let bcIdx = unmatchedBefore.findIndex((bc) => bc.instanceId === ac.instanceId)
    if (bcIdx === -1) {
      bcIdx = unmatchedBefore.findIndex((bc) => bc.code === ac.code && bc.code !== 0)
    }
    if (bcIdx !== -1) {
      const bc = unmatchedBefore.splice(bcIdx, 1)[0]
      const acIdx = unmatchedAfter.indexOf(ac)
      if (acIdx !== -1) unmatchedAfter.splice(acIdx, 1)

      result.movedCards.push({
        instanceId: bc.instanceId,
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
      instanceId: c.instanceId,
      code: c.code,
      controller: c.controller,
      location: c.location,
      sequence: c.sequence
    })
  }

  for (const c of unmatchedAfter) {
    result.addedCards.push({
      instanceId: c.instanceId,
      code: c.code,
      controller: c.controller,
      location: c.location,
      sequence: c.sequence,
      position: c.position,
      card: c.card
    })
  }

  return result
}
