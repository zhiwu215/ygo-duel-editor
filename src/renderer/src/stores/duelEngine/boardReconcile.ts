import {
  CardLocation,
  DuelPhase,
  EngineBoardState,
  EngineCard,
  FieldCard,
  duelPhaseFromMask,
  resolveEngineCardStats
} from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { normalizeEngineCardPosition } from '../../utils/engineCardPosition'
import { getEditorId, registerIdentity, toEditorToEngineMap } from './identityMap'

export function mapPhaseToDuelPhase(phase: number): DuelPhase {
  return duelPhaseFromMask(phase)
}

export function applyEngineWrite(apply: () => void): void {
  useDuelStore.getState().withSingleUndoStep(apply)
}

export function syncJumpToStepWrapped(
  boardState: EngineBoardState,
  options?: { silentLp?: boolean }
): void {
  applyEngineWrite(() => syncJumpToStepToDuelStore(boardState, options))
}

function syncJumpToStepToDuelStore(
  boardState: EngineBoardState,
  options?: { silentLp?: boolean }
): void {
  const duelStore = useDuelStore.getState()
  const masterRule = duelStore.state.masterRule
  const currentCards = [...duelStore.state.cards]
  const engineById = new Map(boardState.allCards.map((c) => [c.instanceId, c]))
  const isPrivateLocation = (location: number): boolean =>
    location === CardLocation.HAND ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA
  const activeDuelist = boardState.tag ? boardState.activeDuelist : undefined
  const isInactivePrivate = (card: {
    controller: 0 | 1
    location: number
    duelistId?: string
  }): boolean => {
    if (!activeDuelist || !isPrivateLocation(card.location)) return false
    const activeId = activeDuelist[card.controller]
    return Boolean(card.duelistId && activeId && card.duelistId !== activeId)
  }
  const positionKey = (card: {
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  }): string => {
    const position = normalizeEngineCardPosition(masterRule, card.location, card.sequence)
    const seat =
      boardState.tag && isPrivateLocation(card.location) && card.duelistId ? card.duelistId : ''
    return `${card.controller}:${seat}:${position.location}:${position.sequence}`
  }
  const engineByPos = new Map(boardState.allCards.map((card) => [positionKey(card), card] as const))
  const editorToEngineId = toEditorToEngineMap()
  const resolveSeatDuelistId = (controller: 0 | 1, duelistId?: string): string => {
    if (duelistId) return duelistId
    const teamDuelists = (duelStore.state.duelists || []).filter((d) => d.team === controller)
    const activeId = duelStore.activeDuelistIds?.[controller]
    return (
      (activeId ? teamDuelists.find((d) => d.id === activeId)?.id : undefined) ||
      teamDuelists[0]?.id ||
      (controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
    )
  }

  const countersKey = (counters: Record<number, number> | undefined): string =>
    Object.entries(counters ?? {})
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([type, count]) => `${type}:${count}`)
      .join(',')

  const removedIds = new Set<string>()
  const cardUpdates = new Map<string, Partial<FieldCard>>()
  const claimedEngineIds = new Set<string>()
  const identityMatches = new Map<string, EngineCard>()
  const positionMatches = new Map<string, EngineCard>()

  const claimMatch = (matches: Map<string, EngineCard>, editorId: string, ec: EngineCard): void => {
    claimedEngineIds.add(ec.instanceId)
    matches.set(editorId, ec)
    if (ec.instanceId !== editorId) {
      registerIdentity(ec.instanceId, editorId)
    }
  }

  for (const card of currentCards) {
    if (isInactivePrivate(card)) continue
    const mappedEngineId = editorToEngineId.get(card.instanceId)
    const ec =
      engineById.get(card.instanceId) ??
      (mappedEngineId ? engineById.get(mappedEngineId) : undefined)
    if (!ec || claimedEngineIds.has(ec.instanceId)) continue
    claimMatch(identityMatches, card.instanceId, ec)
  }

  for (const card of currentCards) {
    if (isInactivePrivate(card) || identityMatches.has(card.instanceId)) continue
    const ec = engineByPos.get(positionKey(card))
    if (!ec || claimedEngineIds.has(ec.instanceId)) continue
    claimMatch(positionMatches, card.instanceId, ec)
  }

  for (const card of currentCards) {
    if (isInactivePrivate(card)) continue
    const ec = identityMatches.get(card.instanceId) ?? positionMatches.get(card.instanceId)
    if (!ec) {
      removedIds.add(card.instanceId)
      continue
    }

    const ecPosition = normalizeEngineCardPosition(masterRule, ec.location, ec.sequence)
    const updates: Partial<FieldCard> = {}

    if (card.code !== ec.code || (!card.card && ec.card)) {
      updates.code = ec.code
      if (ec.card) updates.card = ec.card
    }
    if (
      card.location !== ecPosition.location ||
      card.sequence !== ecPosition.sequence ||
      card.controller !== ec.controller ||
      card.position !== ec.position
    ) {
      updates.location = ecPosition.location
      updates.sequence = ecPosition.sequence
      updates.controller = ec.controller
      updates.position = ec.position
    }
    if (ec.status !== undefined && card.status !== ec.status) {
      updates.status = ec.status
    }
    if (countersKey(ec.counters) !== countersKey(card.counters)) {
      updates.counters = ec.counters ? { ...ec.counters } : undefined
    }
    const engineMats = ec.overlayMaterials ?? []
    const editorMats = card.overlayMaterials ?? []
    if (engineMats.join(',') !== editorMats.join(',')) {
      updates.overlayMaterials = [...engineMats]
    }

    if (!card.duelistId) {
      updates.duelistId = resolveSeatDuelistId(ec.controller, ec.duelistId)
    }

    if (Object.keys(updates).length > 0) {
      cardUpdates.set(card.instanceId, updates)
    }
  }

  const addedCards: FieldCard[] = []
  for (const ec of boardState.allCards) {
    if (claimedEngineIds.has(ec.instanceId)) continue
    if (currentCards.some((c) => c.instanceId === ec.instanceId)) continue
    if (isInactivePrivate(ec)) continue
    if (!ec.card) {
      console.warn(
        `[useDuelEngineStore] 引擎卡 ${ec.instanceId} (code=${ec.code}) 缺少 CDB 数据，无法补进棋盘。`
      )
      continue
    }
    const ecPosition = normalizeEngineCardPosition(masterRule, ec.location, ec.sequence)
    const duelistId = resolveSeatDuelistId(ec.controller, ec.duelistId)
    addedCards.push({
      instanceId: ec.instanceId,
      code: ec.card.id,
      card: ec.card,
      controller: ec.controller,
      owner: ec.owner,
      location: ecPosition.location,
      sequence: ecPosition.sequence,
      position: ec.position,
      overlayMaterials: [...(ec.overlayMaterials ?? [])],
      counters: ec.counters ? { ...ec.counters } : undefined,
      status: ec.status,
      duelistId
    })
  }

  if (removedIds.size > 0 || cardUpdates.size > 0 || addedCards.length > 0) {
    useDuelStore.setState((prev) => {
      let cards = prev.state.cards
      if (removedIds.size > 0) {
        cards = cards.filter((c) => !removedIds.has(c.instanceId))
      }
      if (cardUpdates.size > 0) {
        cards = cards.map((c) => {
          const update = cardUpdates.get(c.instanceId)
          return update ? { ...c, ...update } : c
        })
      }
      if (addedCards.length > 0) {
        cards = [...cards, ...addedCards]
      }
      return {
        ...prev,
        state: {
          ...prev.state,
          cards
        },
        selectedCardId:
          prev.selectedCardId && removedIds.has(prev.selectedCardId) ? null : prev.selectedCardId,
        hoveredInstanceId:
          prev.hoveredInstanceId && removedIds.has(prev.hoveredInstanceId)
            ? null
            : prev.hoveredInstanceId
      }
    })
  }

  duelStore.setPlayerLp(0, boardState.players[0].lp, { silent: options?.silentLp })
  duelStore.setPlayerLp(1, boardState.players[1].lp, { silent: options?.silentLp })
  duelStore.setCurrentPhase(mapPhaseToDuelPhase(boardState.phase))
  duelStore.setTurnPlayer(boardState.turnPlayer)
  duelStore.setCurrentTurn(boardState.turn)

  const editorCards = new Map(useDuelStore.getState().state.cards.map((c) => [c.instanceId, c]))
  for (const ec of boardState.allCards) {
    const stats = resolveEngineCardStats(ec)
    if (!stats) continue
    const editorId = getEditorId(ec.instanceId) ?? ec.instanceId
    const card = editorCards.get(editorId)
    if (!card) continue
    if (card.customAtk === stats.customAtk && card.customDef === stats.customDef) continue
    duelStore.setCardCustomStats(editorId, stats.customAtk, stats.customDef)
  }
}
