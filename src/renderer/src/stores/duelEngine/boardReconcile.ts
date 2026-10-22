import { CardLocation, DuelPhase, EngineBoardState, resolveEngineCardStats } from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { getEditorId, registerIdentity, toEditorToEngineMap } from './identityMap'

export function mapPhaseToDuelPhase(phase: number): DuelPhase {
  if (phase === 1) return 'DP'
  if (phase === 2) return 'SP'
  if (phase === 4) return 'M1'
  if ([8, 16, 32, 64, 128].includes(phase)) return 'BP'
  if (phase === 256) return 'M2'
  if (phase === 512) return 'EP'
  return 'M1'
}

export function applyEngineWrite(apply: () => void): void {
  const duelStore = useDuelStore.getState()
  const prevState = duelStore.state
  duelStore.pauseUndoTracking()
  try {
    apply()
  } finally {
    duelStore.resumeAndPushUndo(structuredClone(prevState))
  }
}

export function syncJumpToStepWrapped(boardState: EngineBoardState): void {
  applyEngineWrite(() => syncJumpToStepToDuelStore(boardState))
}

function syncJumpToStepToDuelStore(boardState: EngineBoardState): void {
  const duelStore = useDuelStore.getState()
  const currentCards = [...duelStore.state.cards]
  const engineById = new Map(boardState.allCards.map((c) => [c.instanceId, c]))
  const engineByPos = new Map(
    boardState.allCards.map((c) => [`${c.controller}:${c.location}:${c.sequence}`, c])
  )
  const editorToEngineId = toEditorToEngineMap()
  const usedEngineIds = new Set<string>()

  for (const card of currentCards) {
    const mappedEngineId = editorToEngineId.get(card.instanceId)
    const ec =
      engineById.get(card.instanceId) ??
      (mappedEngineId ? engineById.get(mappedEngineId) : undefined) ??
      engineByPos.get(`${card.controller}:${card.location}:${card.sequence}`)
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

    if (
      card.location !== ec.location ||
      card.sequence !== ec.sequence ||
      card.controller !== ec.controller
    ) {
      duelStore.moveCard(card.instanceId, ec.location, ec.sequence, ec.controller, ec.position)
      card.location = ec.location
      card.sequence = ec.sequence
      card.controller = ec.controller
      card.position = ec.position
    } else if (card.position !== ec.position) {
      duelStore.updateCardPosition(card.instanceId, ec.position)
      card.position = ec.position
    }

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
    if (!ec.card) {
      console.warn(
        `[useDuelEngineStore] 引擎卡 ${ec.instanceId} (code=${ec.code}) 缺少 CDB 数据，无法补进棋盘。`
      )
      continue
    }
    duelStore.addCardToZone(
      ec.card,
      ec.controller,
      ec.location,
      ec.sequence,
      ec.position,
      undefined,
      ec.instanceId
    )
    currentCards.push({
      instanceId: ec.instanceId,
      code: ec.card.id,
      card: ec.card,
      controller: ec.controller,
      owner: ec.owner,
      location: ec.location,
      sequence: ec.sequence,
      position: ec.position,
      overlayMaterials: [...ec.overlayMaterials]
    })
  }

  duelStore.setPlayerLp(0, boardState.players[0].lp)
  duelStore.setPlayerLp(1, boardState.players[1].lp)
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
