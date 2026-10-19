import {
  CardLocation,
  CdbCard,
  DuelPhase,
  EngineBoardState,
  ManualOp,
  customCardToCdbCard,
  resolveEngineCardStats
} from '@shared/index'
import { useDuelStore } from '../useDuelStore'
import { useCustomCardStore } from '../useCustomCardStore'
import { findCapturedCardData } from '../useStagingStore'
import {
  isManualCapturePaused,
  pauseManualCapture,
  resumeManualCapture
} from '../duel/manualCaptureGate'
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
  pauseManualCapture()
  try {
    apply()
  } finally {
    resumeManualCapture()
    duelStore.resumeAndPushUndo(structuredClone(prevState))
  }
}

function resolveManualOpCardData(code: number): CdbCard | undefined {
  const onBoard = useDuelStore.getState().state.cards.find((c) => c.code === code && c.card)?.card
  if (onBoard) return onBoard
  const captured = findCapturedCardData(code)
  if (captured) return captured
  const custom = useCustomCardStore.getState().cards.find((c) => c.id === code)
  return custom ? customCardToCdbCard(custom) : undefined
}

function applyManualOp(op: ManualOp): void {
  const duelStore = useDuelStore.getState()
  const cardExists = (instanceId: string): boolean =>
    duelStore.state.cards.some((c) => c.instanceId === instanceId)

  if (op.type === 'move') {
    if (!cardExists(op.instanceId)) return
    duelStore.moveCard(op.instanceId, op.toLocation, op.toSequence, op.toController, op.customPos)
    return
  }
  if (op.type === 'position') {
    if (!cardExists(op.instanceId)) return
    duelStore.updateCardPosition(op.instanceId, op.position)
    return
  }
  if (op.type === 'remove') {
    if (!cardExists(op.instanceId)) return
    duelStore.removeCard(op.instanceId)
    return
  }
  if (op.type === 'add') {
    const card = resolveManualOpCardData(op.code)
    if (!card) {
      console.warn(`[boardReconcile] 手动 add 记录找不到卡 ${op.code} 的卡面数据，已跳过。`)
      return
    }
    duelStore.addCardToZone(
      card,
      op.controller,
      op.location,
      op.sequence,
      op.position,
      op.duelistId,
      op.instanceId
    )
    return
  }
  duelStore.setPlayerLp(op.player, op.value)
}

function reapplyManualOps(): void {
  const steps = useDuelStore.getState().state.steps || []
  const pending = steps.flatMap((step) => step.manualOps ?? [])
  if (pending.length === 0) return
  if (isManualCapturePaused()) {
    for (const op of pending) applyManualOp(op)
    return
  }
  pauseManualCapture()
  try {
    for (const op of pending) applyManualOp(op)
  } finally {
    resumeManualCapture()
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

  reapplyManualOps()
}
