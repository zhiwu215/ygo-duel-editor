import type { StateCreator } from 'zustand'
import {
  CdbCard,
  CardLocation,
  CardPosition,
  FieldCard,
  LOCATION_NAMES,
  createLightweightSnapshot,
  resolveTargetPosition
} from '@shared/index'
import { FIELD_ZONE_SEQ } from './setupSlice'
import { useStagingStore } from '../useStagingStore'
import { useDuelEngineStore } from '../useDuelEngineStore'
import {
  moveActionType,
  recordEditorStep,
  resolveMoveStepLabel,
  StepLabel
} from './editorStepRecorder'
import type { DuelStore } from './types'

export interface MoveCardParams {
  instanceId: string
  toLocation: number
  toSequence: number
  toController?: 0 | 1
  customPos?: number
  targetDuelistId?: string
}

export function findZoneOccupant(
  cards: FieldCard[],
  controller: 0 | 1,
  location: number,
  sequence: number
): FieldCard | undefined {
  if (location !== CardLocation.SZONE || sequence !== FIELD_ZONE_SEQ) return undefined
  return cards.find(
    (c) =>
      c.controller === controller &&
      c.location === CardLocation.SZONE &&
      c.sequence === FIELD_ZONE_SEQ
  )
}

function applyMoveCard(prev: DuelStore, params: MoveCardParams): Partial<DuelStore> {
  const { instanceId, toLocation, toSequence, toController, customPos, targetDuelistId } = params
  const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
  if (!targetCard) return {}

  const ctrl = toController !== undefined ? toController : targetCard.controller

  const isPileZone =
    toLocation === CardLocation.HAND ||
    toLocation === CardLocation.GRAVE ||
    toLocation === CardLocation.DECK ||
    toLocation === CardLocation.EXTRA ||
    toLocation === CardLocation.REMOVED

  const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === ctrl)
  const pileDuelistId = isPileZone
    ? targetDuelistId ||
      targetCard.duelistId ||
      teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
      teamDuelists[0]?.id ||
      (ctrl === 0 ? 'duelist_0_0' : 'duelist_1_0')
    : undefined

  let seq = toSequence
  let updatedCards = prev.state.cards

  if (isPileZone) {
    const targetPiles = prev.state.cards
      .filter(
        (c) =>
          c.controller === ctrl &&
          c.location === toLocation &&
          c.instanceId !== instanceId &&
          c.duelistId === pileDuelistId
      )
      .sort((a, b) => a.sequence - b.sequence)

    const insertIdx =
      toSequence !== undefined && toSequence >= 0 && toSequence <= targetPiles.length
        ? toSequence
        : targetPiles.length
    seq = insertIdx

    if (insertIdx < targetPiles.length) {
      const seqShiftMap = new Map<string, number>()
      targetPiles.forEach((c, idx) => {
        if (idx >= insertIdx) {
          seqShiftMap.set(c.instanceId, idx + 1)
        }
      })
      updatedCards = prev.state.cards.map((c) => {
        if (seqShiftMap.has(c.instanceId)) {
          return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
        }
        return c
      })
    }
  }

  const newPos = resolveTargetPosition(
    toLocation,
    customPos,
    targetCard.location,
    targetCard.position
  )

  const finalCards = updatedCards.map((c) => {
    if (c.instanceId === instanceId) {
      return {
        ...c,
        location: toLocation,
        sequence: seq,
        controller: ctrl,
        position: newPos,
        duelistId: isPileZone ? pileDuelistId : c.duelistId
      }
    }
    return c
  })

  return {
    currentChain: prev.currentChain,
    state: {
      ...prev.state,
      cards: finalCards
    }
  }
}

export interface PlacementSlice {
  addCardToZone: (
    card: CdbCard,
    controller: 0 | 1,
    location: number,
    sequence: number,
    position?: number,
    duelistId?: string,
    engineInstanceId?: string
  ) => void

  moveCard: (
    instanceId: string,
    toLocation: number,
    toSequence: number,
    toController?: 0 | 1,
    customPos?: number,
    targetDuelistId?: string,
    stepLabel?: StepLabel
  ) => void
  moveCards: (moves: MoveCardParams[]) => void
  removeCard: (instanceId: string) => void
  clearPile: (controller: 0 | 1, location: number) => void
  updateCardPosition: (instanceId: string, position: number) => void
  setPlacedCardPosition: (instanceId: string, position: number) => void

  reorderPileCards: (
    controller: 0 | 1,
    location: number,
    fromIndex: number,
    toIndex: number,
    duelistId?: string
  ) => void

  reorderHandCards: (
    controller: 0 | 1,
    duelistId: string,
    movingInstanceId: string,
    targetInstanceId: string,
    insertAfter: boolean
  ) => void
}

export const createPlacementSlice: StateCreator<DuelStore, [], [], PlacementSlice> = (
  set,
  get
) => ({
  addCardToZone: (card, controller, location, sequence, customPos, duelistId, engineInstanceId) => {
    const placedInstanceId =
      engineInstanceId ?? `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const pos = resolveTargetPosition(location, customPos)
    useStagingStore.getState().pushOp(
      {
        type: 'add',
        instanceId: placedInstanceId,
        code: card.id,
        controller,
        location,
        sequence,
        position: pos,
        duelistId
      },
      card
    )
    set((prev) => {
      const isPileZone =
        location === CardLocation.HAND ||
        location === CardLocation.GRAVE ||
        location === CardLocation.DECK ||
        location === CardLocation.EXTRA ||
        location === CardLocation.REMOVED

      const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
      const isOwnerScopedZone =
        location === CardLocation.HAND ||
        location === CardLocation.DECK ||
        location === CardLocation.EXTRA ||
        location === CardLocation.GRAVE ||
        location === CardLocation.REMOVED
      let assignedDuelistId = duelistId
      if (isOwnerScopedZone && !assignedDuelistId) {
        assignedDuelistId =
          teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
          teamDuelists[0]?.id ||
          (controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
      }

      const existingPile = prev.state.cards
        .filter((c) => {
          if (c.controller !== controller || c.location !== location) return false

          if (isOwnerScopedZone && assignedDuelistId) {
            return c.duelistId === assignedDuelistId
          }
          return true
        })
        .sort((a, b) => a.sequence - b.sequence)

      let targetSeq = isPileZone ? existingPile.length : sequence
      let updatedCards = prev.state.cards

      if (isPileZone) {
        const insertIdx =
          sequence !== undefined && sequence >= 0 && sequence <= existingPile.length
            ? sequence
            : existingPile.length
        targetSeq = insertIdx

        if (insertIdx < existingPile.length) {
          const seqShiftMap = new Map<string, number>()
          existingPile.forEach((c, idx) => {
            if (idx >= insertIdx) {
              seqShiftMap.set(c.instanceId, idx + 1)
            }
          })
          updatedCards = prev.state.cards.map((c) => {
            if (seqShiftMap.has(c.instanceId)) {
              return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
            }
            return c
          })
        }
      }

      const filteredCards = isPileZone
        ? updatedCards
        : updatedCards.filter(
            (c) =>
              !(c.controller === controller && c.location === location && c.sequence === sequence)
          )

      const newCard: FieldCard = {
        instanceId: placedInstanceId,
        code: card.id,
        card,
        controller,
        owner: controller,
        location,
        sequence: targetSeq,
        position: pos,
        overlayMaterials: [],
        duelistId: isOwnerScopedZone ? assignedDuelistId : undefined
      }

      return {
        state: {
          ...prev.state,
          cards: [...filteredCards, newCard]
        },
        selectedCardId: newCard.instanceId,
        hoveredCard: card
      }
    })
  },

  moveCard: (
    instanceId,
    toLocation,
    toSequence,
    toController,
    customPos,
    targetDuelistId,
    stepLabel
  ) => {
    const fromCard = get().state.cards.find((c) => c.instanceId === instanceId)
    const effectivePos = resolveTargetPosition(
      toLocation,
      customPos,
      fromCard?.location,
      fromCard?.position
    )
    useStagingStore.getState().pushOp({
      type: 'move',
      instanceId,
      toLocation,
      toSequence,
      toController,
      customPos: effectivePos
    })
    set((prev) => ({
      ...applyMoveCard(prev, {
        instanceId,
        toLocation,
        toSequence,
        toController,
        customPos: effectivePos,
        targetDuelistId
      })
    }))
    if (fromCard) {
      const name = fromCard.card?.name
      const resolvedLabel =
        stepLabel ??
        resolveMoveStepLabel(fromCard.location, toLocation, effectivePos, fromCard.card?.name)
      recordEditorStep({
        actionType: resolvedLabel?.actionType ?? moveActionType(toLocation),
        controller: toController ?? fromCard.controller,
        cardCode: fromCard.code,
        cardName: name,
        fromLocation: fromCard.location,
        fromSequence: fromCard.sequence,
        toLocation,
        toSequence,
        fromController: fromCard.controller,
        toController: toController ?? fromCard.controller,
        fromPosition: fromCard.position,
        toPosition: effectivePos,
        description:
          resolvedLabel?.description ??
          (name
            ? `将【${name}】移至${LOCATION_NAMES[toLocation] ?? '区域'}`
            : `移动卡片至${LOCATION_NAMES[toLocation] ?? '区域'}`),
        op: {
          type: 'move',
          instanceId,
          toLocation,
          toSequence,
          toController,
          customPos: effectivePos
        }
      })
    }
  },

  moveCards: (moves) => {
    const fromCards = new Map(
      get()
        .state.cards.filter((c) => moves.some((m) => m.instanceId === c.instanceId))
        .map((c) => [c.instanceId, c])
    )
    const effectiveMoves = moves.map((m) => {
      const fromCard = fromCards.get(m.instanceId)
      return {
        ...m,
        customPos: resolveTargetPosition(
          m.toLocation,
          m.customPos,
          fromCard?.location,
          fromCard?.position
        )
      }
    })
    const staging = useStagingStore.getState()
    for (const m of effectiveMoves) {
      staging.pushOp({
        type: 'move',
        instanceId: m.instanceId,
        toLocation: m.toLocation,
        toSequence: m.toSequence,
        toController: m.toController,
        customPos: m.customPos
      })
    }
    set((prev) => {
      let acc = prev
      for (const m of effectiveMoves) {
        acc = { ...acc, ...applyMoveCard(acc, m) }
      }
      return acc
    })
    for (const m of effectiveMoves) {
      const fromCard = fromCards.get(m.instanceId)
      if (!fromCard) continue
      const name = fromCard.card?.name
      recordEditorStep({
        actionType: moveActionType(m.toLocation),
        controller: m.toController ?? fromCard.controller,
        cardCode: fromCard.code,
        cardName: name,
        fromLocation: fromCard.location,
        fromSequence: fromCard.sequence,
        toLocation: m.toLocation,
        toSequence: m.toSequence,
        fromController: fromCard.controller,
        toController: m.toController ?? fromCard.controller,
        description: name
          ? `将【${name}】移至${LOCATION_NAMES[m.toLocation] ?? '区域'}`
          : `移动卡片至${LOCATION_NAMES[m.toLocation] ?? '区域'}`,
        op: { type: 'move', ...m }
      })
    }
  },

  removeCard: (instanceId) => {
    useStagingStore.getState().pushOp({ type: 'remove', instanceId })
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
      },
      selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
      hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId
    }))
  },

  clearPile: (controller, location) => {
    const pileCards = get().state.cards.filter(
      (c) => c.controller === controller && c.location === location
    )
    if (pileCards.length === 0) return
    const staging = useStagingStore.getState()
    for (const card of pileCards) {
      staging.pushOp({ type: 'remove', instanceId: card.instanceId })
    }
    const removedIds = new Set(pileCards.map((c) => c.instanceId))
    set((prev) => {
      const duelists =
        location === CardLocation.DECK
          ? (prev.state.duelists || []).map((d) =>
              d.team === controller ? { ...d, deckId: undefined } : d
            )
          : prev.state.duelists
      return {
        state: {
          ...prev.state,
          cards: prev.state.cards.filter((c) => !removedIds.has(c.instanceId)),
          duelists
        },
        selectedCardId:
          prev.selectedCardId && removedIds.has(prev.selectedCardId) ? null : prev.selectedCardId,
        hoveredInstanceId:
          prev.hoveredInstanceId && removedIds.has(prev.hoveredInstanceId)
            ? null
            : prev.hoveredInstanceId
      }
    })
  },

  updateCardPosition: (instanceId, position) => {
    const oldPos = get().state.cards.find((c) => c.instanceId === instanceId)?.position
    useStagingStore.getState().pushOp({ type: 'position', instanceId, position })
    set((prev) => {
      const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
      if (!targetCard) return prev
      if (targetCard.position === position) return prev

      const updatedCards = prev.state.cards.map((c) =>
        c.instanceId === instanceId ? { ...c, position } : c
      )

      return {
        state: {
          ...prev.state,
          cards: updatedCards
        }
      }
    })
    if (oldPos !== undefined && oldPos !== position) {
      const card = get().state.cards.find((c) => c.instanceId === instanceId)
      if (card) {
        const name = card.card?.name
        const isSpellTrapZone =
          card.location === CardLocation.SZONE ||
          card.location === CardLocation.FZONE ||
          card.location === CardLocation.PZONE
        const isActivation =
          isSpellTrapZone && oldPos === CardPosition.FACEDOWN && position === CardPosition.FACEUP
        recordEditorStep(
          isActivation
            ? {
                actionType: 'ACTIVATE',
                controller: card.controller,
                cardCode: card.code,
                cardName: name,
                fromLocation: card.location,
                fromSequence: card.sequence,
                toLocation: card.location,
                toSequence: card.sequence,
                description: name ? `发动【${name}】` : '发动魔法陷阱',
                op: { type: 'position', instanceId, position }
              }
            : {
                actionType: 'CHANGE_POS',
                controller: card.controller,
                cardCode: card.code,
                cardName: name,
                fromLocation: card.location,
                fromSequence: card.sequence,
                toLocation: card.location,
                toSequence: card.sequence,
                fromPosition: oldPos,
                toPosition: position,
                description: name ? `【${name}】变更表示形式` : '变更表示形式',
                op: { type: 'position', instanceId, position }
              }
        )
      }
    }
  },

  setPlacedCardPosition: (instanceId, position) => {
    if (useDuelEngineStore.getState().isInitialized) {
      get().updateCardPosition(instanceId, position)
      return
    }
    const steps = get().state.steps || []
    const stepIndex = get().currentStepIndex
    const targetIndex = stepIndex === null ? steps.length - 1 : stepIndex
    const step = steps[targetIndex]
    const card = get().state.cards.find((c) => c.instanceId === instanceId)
    const moveOp = step?.manualOps?.find((op) => op.type === 'move')
    if (
      !card ||
      !step ||
      !moveOp ||
      targetIndex !== steps.length - 1 ||
      step.instanceId !== instanceId ||
      step.toLocation !== card.location
    ) {
      get().updateCardPosition(instanceId, position)
      return
    }
    const label = resolveMoveStepLabel(step.fromLocation, card.location, position, step.cardName)
    useStagingStore.getState().pushOp({ type: 'position', instanceId, position })
    set((prev) => {
      const cards = prev.state.cards.map((c) =>
        c.instanceId === instanceId ? { ...c, position } : c
      )
      const manualOps = step.manualOps!.map((op) =>
        op.type === 'move' ? { ...op, customPos: position } : op
      )
      const updatedStep = {
        ...step,
        ...(label
          ? { actionType: label.actionType, description: label.description ?? step.description }
          : {}),
        toPosition: position,
        manualOps,
        boardAfter: createLightweightSnapshot(cards)
      }
      return {
        state: {
          ...prev.state,
          cards,
          steps: (prev.state.steps || []).map((s) => (s.id === step.id ? updatedStep : s))
        }
      }
    })
  },

  reorderPileCards: (controller, location, fromIndex, toIndex, duelistId) =>
    set((prev) => {
      const pile = prev.state.cards
        .filter(
          (card) =>
            card.controller === controller &&
            card.location === location &&
            (!duelistId || card.duelistId === duelistId)
        )
        .sort((a, b) => a.sequence - b.sequence)

      if (
        fromIndex < 0 ||
        fromIndex >= pile.length ||
        toIndex < 0 ||
        toIndex >= pile.length ||
        fromIndex === toIndex
      ) {
        return prev
      }

      const reordered = [...pile]
      const [movedCard] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, movedCard)

      const seqMap = new Map<string, number>()
      reordered.forEach((c, idx) => {
        seqMap.set(c.instanceId, idx)
      })

      return {
        state: {
          ...prev.state,
          cards: prev.state.cards.map((c) => {
            if (seqMap.has(c.instanceId)) {
              return { ...c, sequence: seqMap.get(c.instanceId)! }
            }
            return c
          })
        }
      }
    }),

  reorderHandCards: (controller, duelistId, movingInstanceId, targetInstanceId, insertAfter) => {
    set((prev) => {
      if (movingInstanceId === targetInstanceId) return prev

      const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
      const fallbackDuelistId = teamDuelists[0]?.id ?? `duelist_${controller}_0`
      const belongsToDuelist = (card: FieldCard): boolean =>
        card.duelistId === duelistId || (!card.duelistId && fallbackDuelistId === duelistId)
      const hand = prev.state.cards
        .filter(
          (card) =>
            card.controller === controller &&
            card.location === CardLocation.HAND &&
            belongsToDuelist(card)
        )
        .sort((a, b) => a.sequence - b.sequence)
      const fromIndex = hand.findIndex((card) => card.instanceId === movingInstanceId)
      const targetIndex = hand.findIndex((card) => card.instanceId === targetInstanceId)
      if (fromIndex < 0 || targetIndex < 0) return prev

      const reordered = [...hand]
      const [movingCard] = reordered.splice(fromIndex, 1)
      const adjustedTargetIndex = reordered.findIndex(
        (card) => card.instanceId === targetInstanceId
      )
      const insertIndex = adjustedTargetIndex + (insertAfter ? 1 : 0)
      reordered.splice(insertIndex, 0, movingCard)
      if (reordered.every((card, index) => card.instanceId === hand[index].instanceId)) {
        return prev
      }

      useStagingStore.getState().pushOp({
        type: 'move',
        instanceId: movingInstanceId,
        toLocation: CardLocation.HAND,
        toSequence: insertIndex
      })

      const sequenceById = new Map<string, number>()
      reordered.forEach((card, index) => sequenceById.set(card.instanceId, index))
      return {
        state: {
          ...prev.state,
          cards: prev.state.cards.map((card) => {
            const sequence = sequenceById.get(card.instanceId)
            return sequence === undefined ? card : { ...card, sequence }
          })
        }
      }
    })
  }
})
