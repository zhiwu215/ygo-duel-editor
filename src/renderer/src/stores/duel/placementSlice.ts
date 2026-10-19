import type { StateCreator } from 'zustand'
import {
  CdbCard,
  CardLocation,
  CardPosition,
  CardType,
  DuelStep,
  FieldCard,
  createLightweightSnapshot
} from '@shared/index'
import { alertDialog } from '../useDialogStore'
import { resolveCardName } from '../../utils/cardNames'
import { FIELD_ZONE_SEQ, isFieldSpellCard } from './setupSlice'
import type { DuelStore } from './types'
import { isAutoRecordingPaused } from './recordingGate'

export type PendingPlacementMode = 'ACTIVATE' | 'SET' | 'SUMMON'

export interface PendingPlacementSlot {
  location: number
  sequence: number
  controller: 0 | 1
  displaces?: boolean
}

export interface PendingPlacement {
  sourceId: string
  sourceName: string
  sourceController: 0 | 1
  mode: PendingPlacementMode
  cardType: number
  allowedSlots: PendingPlacementSlot[]
  effectIndex?: number
}

export interface MoveCardParams {
  instanceId: string
  toLocation: number
  toSequence: number
  toController?: 0 | 1
  customPos?: number
  targetDuelistId?: string
  chainResponse?: boolean
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

  let assignedDuelistId = targetDuelistId
  if (isPileZone && !assignedDuelistId) {
    const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === ctrl)
    assignedDuelistId =
      targetCard.duelistId ||
      teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
      teamDuelists[0]?.id ||
      (ctrl === 0 ? 'duelist_0_0' : 'duelist_1_0')
  }

  let seq = toSequence
  let updatedCards = prev.state.cards

  if (isPileZone) {
    const targetPiles = prev.state.cards
      .filter((c) => {
        if (c.controller !== ctrl || c.location !== toLocation || c.instanceId === instanceId) {
          return false
        }
        if (isPileZone && assignedDuelistId) {
          return c.duelistId === assignedDuelistId
        }
        return true
      })
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

  const sameZone = targetCard.location === toLocation
  let newPos = targetCard.position
  if (customPos !== undefined) {
    newPos = customPos
  } else if (!sameZone) {
    if (toLocation === CardLocation.SZONE) {
      newPos = CardPosition.FACEDOWN
    } else if (toLocation === CardLocation.MZONE) {
      newPos = CardPosition.FACEUP_ATTACK
    } else if (toLocation === CardLocation.HAND) {
      newPos = CardPosition.FACEDOWN
    } else if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) {
      newPos = CardPosition.FACEDOWN
    } else if (
      toLocation === CardLocation.GRAVE ||
      toLocation === CardLocation.REMOVED ||
      toLocation === CardLocation.PZONE
    ) {
      newPos = CardPosition.FACEUP
    }
  }

  const finalCards = updatedCards.map((c) => {
    if (c.instanceId === instanceId) {
      return {
        ...c,
        location: toLocation,
        sequence: seq,
        controller: ctrl,
        position: newPos,
        duelistId: isPileZone ? assignedDuelistId : c.duelistId
      }
    }
    return c
  })

  return {
    currentChain: prev.currentChain,
    state: {
      ...prev.state,
      cards: finalCards,
      initialBoardSnapshot: prev.state.initialBoardSnapshot || createLightweightSnapshot(finalCards)
    }
  }
}

export interface PlacementSlice {
  pendingPlacement: PendingPlacement | null
  beginPlacement: (mode: PendingPlacementMode, sourceId: string, effectIndex?: number) => void
  cancelPlacement: () => void
  commitPlacement: (slot: PendingPlacementSlot) => void

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
    targetDuelistId?: string
  ) => void
  moveCards: (moves: MoveCardParams[]) => void
  removeCard: (instanceId: string) => void
  updateCardPosition: (instanceId: string, position: number, chainResponse?: boolean) => void

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
  pendingPlacement: null,

  beginPlacement: (mode, sourceId, effectIndex) => {
    const { state } = get()
    const card = state.cards.find((c) => c.instanceId === sourceId)
    if (!card || card.location !== CardLocation.HAND) return

    const cardType = card.card?.type ?? 0
    const isMonster = card.card !== undefined ? (cardType & CardType.MONSTER) !== 0 : false

    const allowedSlots: PendingPlacementSlot[] = []
    const controller = card.controller

    if (isFieldSpellCard(card)) {
      allowedSlots.push({
        location: CardLocation.SZONE,
        sequence: FIELD_ZONE_SEQ,
        controller,
        displaces: true
      })
    } else if (isMonster) {
      for (let seq = 0; seq <= 4; seq++) {
        const taken = state.cards.some(
          (c) =>
            c.controller === controller && c.location === CardLocation.MZONE && c.sequence === seq
        )
        if (!taken) {
          allowedSlots.push({ location: CardLocation.MZONE, sequence: seq, controller })
        }
      }
    } else {
      for (let seq = 0; seq <= 4; seq++) {
        const taken = state.cards.some(
          (c) =>
            c.controller === controller && c.location === CardLocation.SZONE && c.sequence === seq
        )
        if (!taken) {
          allowedSlots.push({ location: CardLocation.SZONE, sequence: seq, controller })
        }
      }
    }

    if (allowedSlots.length === 0) {
      void alertDialog(
        isMonster
          ? '怪兽区已占满\n5 个怪兽格都有卡，无法再召唤或覆盖怪兽。'
          : '魔陷区已占满\n5 个魔陷格都有卡，无法再发动或盖放魔法/陷阱。'
      )
      return
    }

    set({
      pendingPlacement: {
        sourceId,
        sourceName: resolveCardName(card.code),
        sourceController: controller,
        mode,
        cardType,
        allowedSlots,
        effectIndex
      },
      selectedCardId: sourceId
    })
  },

  cancelPlacement: () => set({ pendingPlacement: null }),

  commitPlacement: (slot) => {
    const { pendingPlacement } = get()
    if (!pendingPlacement) return

    if (pendingPlacement.mode === 'SUMMON') {
      get().moveCard(
        pendingPlacement.sourceId,
        slot.location,
        slot.sequence,
        slot.controller,
        CardPosition.FACEUP_ATTACK
      )
    } else if (pendingPlacement.mode === 'ACTIVATE') {
      get().executeActivateCard(pendingPlacement.sourceId, {
        location: slot.location,
        sequence: slot.sequence,
        controller: slot.controller,
        position: CardPosition.FACEUP
      })
    } else {
      get().executeSetCard(pendingPlacement.sourceId, {
        location: slot.location,
        sequence: slot.sequence,
        controller: slot.controller
      })
    }
    set({ pendingPlacement: null })
  },

  addCardToZone: (card, controller, location, sequence, customPos, duelistId, engineInstanceId) =>
    set((prev) => {
      const isPileZone =
        location === CardLocation.HAND ||
        location === CardLocation.GRAVE ||
        location === CardLocation.DECK ||
        location === CardLocation.EXTRA ||
        location === CardLocation.REMOVED

      let defaultPos: number = CardPosition.FACEUP_ATTACK
      if (
        location === CardLocation.SZONE ||
        location === CardLocation.DECK ||
        location === CardLocation.EXTRA ||
        location === CardLocation.HAND
      ) {
        defaultPos = CardPosition.FACEDOWN
      } else if (
        location === CardLocation.GRAVE ||
        location === CardLocation.REMOVED ||
        location === CardLocation.PZONE
      ) {
        defaultPos = CardPosition.FACEUP
      }
      const pos = customPos !== undefined ? customPos : defaultPos

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
        instanceId:
          engineInstanceId ?? `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
    }),

  moveCard: (instanceId, toLocation, toSequence, toController, customPos, targetDuelistId) =>
    set((prev) => ({
      ...applyMoveCard(prev, {
        instanceId,
        toLocation,
        toSequence,
        toController,
        customPos,
        targetDuelistId
      })
    })),

  moveCards: (moves) =>
    set((prev) => {
      let acc = prev
      for (const m of moves) {
        acc = { ...acc, ...applyMoveCard(acc, m) }
      }
      return acc
    }),

  removeCard: (instanceId) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
      },
      selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
      hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId,
      pendingPlacement:
        prev.pendingPlacement?.sourceId === instanceId ? null : prev.pendingPlacement
    })),

  updateCardPosition: (instanceId, position, chainResponse = false) =>
    set((prev) => {
      const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
      if (!targetCard) return prev
      const oldPos = targetCard.position
      if (oldPos === position) return prev

      const updatedCards = prev.state.cards.map((c) =>
        c.instanceId === instanceId ? { ...c, position } : c
      )

      const nextSteps = [...(prev.state.steps || [])]
      let nextChain = prev.currentChain

      if (prev.isAutoRecording && !isAutoRecordingPaused()) {
        const lastStep = nextSteps[nextSteps.length - 1]
        const isJustDropped =
          lastStep &&
          lastStep.instanceId === instanceId &&
          (lastStep.actionType === 'SET_SPELL_TRAP' ||
            lastStep.actionType === 'ACTIVATE' ||
            lastStep.actionType === 'SET_MONSTER' ||
            lastStep.actionType === 'NORMAL_SUMMON' ||
            lastStep.actionType === 'SPECIAL_SUMMON')

        const pName = targetCard.controller === 0 ? '我方' : '对方'
        const cName = resolveCardName(targetCard.code)

        if (isJustDropped) {
          if (
            targetCard.location === CardLocation.SZONE ||
            targetCard.location === CardLocation.FZONE
          ) {
            const isFacedown = Boolean(position & CardPosition.FACEDOWN)
            if (isFacedown) {
              nextSteps[nextSteps.length - 1] = {
                ...lastStep,
                actionType: 'SET_SPELL_TRAP',
                chainIndex: undefined,
                description: `${pName}覆盖魔陷【${cName}】`,
                boardAfter: createLightweightSnapshot(updatedCards)
              }
            } else {
              const chainIdx = chainResponse ? prev.currentChain + 1 : 1
              nextChain = chainIdx
              nextSteps[nextSteps.length - 1] = {
                ...lastStep,
                actionType: 'ACTIVATE',
                chainIndex: chainIdx,
                description: `${pName}发动【${cName}】(Chain ${chainIdx})`,
                boardAfter: createLightweightSnapshot(updatedCards)
              }
            }
          } else if (targetCard.location === CardLocation.MZONE) {
            const isFacedown = Boolean(position & CardPosition.FACEDOWN)
            if (isFacedown) {
              nextSteps[nextSteps.length - 1] = {
                ...lastStep,
                actionType: 'SET_MONSTER',
                description: `${pName}里侧盖放怪兽【${cName}】`,
                boardAfter: createLightweightSnapshot(updatedCards)
              }
            } else {
              nextSteps[nextSteps.length - 1] = {
                ...lastStep,
                actionType: 'NORMAL_SUMMON',
                description: `${pName}通常召唤【${cName}】`,
                boardAfter: createLightweightSnapshot(updatedCards)
              }
            }
          }
        } else {
          const newStep: DuelStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: prev.currentTurn,
            turnPlayer: prev.activeTurnPlayer,
            phase: prev.currentPhase,
            actionPlayer: targetCard.controller,
            actionType: 'CHANGE_POS',
            instanceId,
            cardCode: targetCard.code,
            cardName: targetCard.card?.name,
            fromLocation: targetCard.location,
            fromSequence: targetCard.sequence,
            toLocation: targetCard.location,
            toSequence: targetCard.sequence,
            description: `${pName}变更【${cName}】表示形式`,
            boardAfter: createLightweightSnapshot(updatedCards)
          }
          nextSteps.push(newStep)
        }
      }

      return {
        currentChain: nextChain,
        state: {
          ...prev.state,
          cards: updatedCards,
          steps: nextSteps,
          initialBoardSnapshot:
            prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
        }
      }
    }),

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

  reorderHandCards: (controller, duelistId, movingInstanceId, targetInstanceId, insertAfter) =>
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
})
