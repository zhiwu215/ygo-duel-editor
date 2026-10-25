import {
  CardLocation,
  DuelPhase,
  EngineBoardState,
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
  const usedEngineIds = new Set<string>()
  const syncStatus = (instanceId: string, status: number | undefined): void => {
    if (status === undefined) return
    const current = useDuelStore.getState().state.cards.find((c) => c.instanceId === instanceId)
    if (!current || current.status === status) return
    useDuelStore.setState((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        cards: prev.state.cards.map((item) =>
          item.instanceId === instanceId ? { ...item, status } : item
        )
      }
    }))
  }

  for (const card of currentCards) {
    if (isInactivePrivate(card)) continue
    const mappedEngineId = editorToEngineId.get(card.instanceId)
    const ec =
      engineById.get(card.instanceId) ??
      (mappedEngineId ? engineById.get(mappedEngineId) : undefined) ??
      engineByPos.get(positionKey(card))
    if (!ec) {
      duelStore.removeCard(card.instanceId)
      continue
    }
    usedEngineIds.add(ec.instanceId)
    if (ec.instanceId !== card.instanceId) {
      registerIdentity(ec.instanceId, card.instanceId)
    }

    if (card.code !== ec.code) {
      useDuelStore.setState((prev) => ({
        ...prev,
        state: {
          ...prev.state,
          cards: prev.state.cards.map((item) =>
            item.instanceId === card.instanceId
              ? { ...item, code: ec.code, card: ec.card ?? item.card }
              : item
          )
        }
      }))
      card.code = ec.code
      if (ec.card) card.card = ec.card
    }

    const ecPosition = normalizeEngineCardPosition(masterRule, ec.location, ec.sequence)
    if (
      card.location !== ecPosition.location ||
      card.sequence !== ecPosition.sequence ||
      card.controller !== ec.controller
    ) {
      duelStore.moveCard(
        card.instanceId,
        ecPosition.location,
        ecPosition.sequence,
        ec.controller,
        ec.position
      )
      card.location = ecPosition.location
      card.sequence = ecPosition.sequence
      card.controller = ec.controller
      card.position = ec.position
    } else if (card.position !== ec.position) {
      duelStore.updateCardPosition(card.instanceId, ec.position)
      card.position = ec.position
    }

    syncStatus(card.instanceId, ec.status)
    if (ec.status !== undefined) card.status = ec.status

    if (ec.location === CardLocation.MZONE && ec.location === card.location) {
      const engineMats = ec.overlayMaterials
      const editorMats = card.overlayMaterials
      if (engineMats.join(',') !== editorMats.join(',')) {
        for (let i = editorMats.length - 1; i >= 0; i--) {
          duelStore.removeOverlayMaterial(card.instanceId, i)
        }
        for (const mat of engineMats) {
          duelStore.addOverlayMaterial(card.instanceId, mat)
        }
        card.overlayMaterials = [...engineMats]
      }
    }
  }

  for (const ec of boardState.allCards) {
    if (usedEngineIds.has(ec.instanceId)) continue
    if (currentCards.some((c) => c.instanceId === ec.instanceId)) continue
    if (isInactivePrivate(ec)) continue
    if (!ec.card) {
      console.warn(
        `[useDuelEngineStore] 引擎卡 ${ec.instanceId} (code=${ec.code}) 缺少 CDB 数据，无法补进棋盘。`
      )
      continue
    }
    const ecPosition = normalizeEngineCardPosition(masterRule, ec.location, ec.sequence)
    duelStore.addCardToZone(
      ec.card,
      ec.controller,
      ecPosition.location,
      ecPosition.sequence,
      ec.position,
      ec.duelistId,
      ec.instanceId
    )
    syncStatus(ec.instanceId, ec.status)
    currentCards.push({
      instanceId: ec.instanceId,
      code: ec.card.id,
      card: ec.card,
      controller: ec.controller,
      owner: ec.owner,
      location: ecPosition.location,
      sequence: ecPosition.sequence,
      position: ec.position,
      overlayMaterials: [...ec.overlayMaterials],
      status: ec.status,
      duelistId: ec.duelistId
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
