import type { StateCreator } from 'zustand'
import {
  CardLocation,
  CardPosition,
  CardType,
  DuelStep,
  createLightweightSnapshot
} from '@shared/index'
import { resolveCardName } from '../../utils/cardNames'
import { FIELD_ZONE_SEQ, isFieldSpellCard } from './setupSlice'
import { MoveCardParams, findZoneOccupant } from './placementSlice'
import type { DuelStore } from './types'

export interface ExecutionsSlice {
  executeActivateCard: (
    instanceId: string,
    placement?: { location: number; sequence: number; controller?: 0 | 1; position?: number },
    chainResponse?: boolean
  ) => void
  executeAttackCard: (instanceId: string, targetInstanceId?: string) => void
  executeReposCard: (instanceId: string) => Promise<void>
  executeNormalSummon: (instanceId: string) => void
  executeSpecialSummon: (instanceId: string) => void
  executeSetCard: (
    instanceId: string,
    placement?: { location: number; sequence: number; controller?: 0 | 1; position?: number }
  ) => void
  executeDrawCard: (controller: 0 | 1) => void
  executeSendToGrave: (instanceId: string) => void
  executeBanishCard: (instanceId: string) => void
}

export const createExecutionsSlice: StateCreator<DuelStore, [], [], ExecutionsSlice> = (
  set,
  get
) => ({
  executeActivateCard: (instanceId, placement, chainResponse = false) => {
    const { state, moveCards, updateCardPosition } = get()
    const card = state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return

    if (card.location === CardLocation.HAND) {
      let targetLocation: number = CardLocation.SZONE
      let targetSeq: number
      if (placement) {
        targetLocation = placement.location
        targetSeq = placement.sequence
      } else if (isFieldSpellCard(card)) {
        targetSeq = FIELD_ZONE_SEQ
      } else {
        const occupiedSeqs = state.cards
          .filter((c) => c.controller === card.controller && c.location === CardLocation.SZONE)
          .map((c) => c.sequence)
        targetSeq = [0, 1, 2, 3, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
      }

      const targetController = placement?.controller ?? card.controller
      const targetPos = placement?.position ?? CardPosition.FACEUP
      const displaced = findZoneOccupant(state.cards, targetController, targetLocation, targetSeq)
      const moves: MoveCardParams[] = []
      if (displaced && displaced.instanceId !== instanceId) {
        moves.push({
          instanceId: displaced.instanceId,
          toLocation: CardLocation.GRAVE,
          toSequence: 999,
          toController: displaced.controller
        })
      }
      moves.push({
        instanceId,
        toLocation: targetLocation,
        toSequence: targetSeq,
        toController: placement?.controller,
        customPos: targetPos,
        chainResponse
      })
      moveCards(moves)
    } else if (card.location === CardLocation.SZONE) {
      updateCardPosition(instanceId, CardPosition.FACEUP, chainResponse)
    } else {
      const { currentTurn, currentPhase, currentChain, activeTurnPlayer } = get()
      const nextChain = chainResponse ? currentChain + 1 : 1
      const pName = card.controller === 0 ? '我方' : '对方'
      const cName = resolveCardName(card.code)
      const newStep: DuelStep = {
        id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        turn: currentTurn,
        turnPlayer: activeTurnPlayer,
        phase: currentPhase,
        actionPlayer: card.controller,
        actionType: 'ACTIVATE',
        instanceId,
        cardCode: card.code,
        cardName: card.card?.name,
        fromLocation: card.location,
        fromSequence: card.sequence,
        chainIndex: nextChain,
        description: `${pName}发动【${cName}】效果 (Chain ${nextChain})`,
        boardAfter: createLightweightSnapshot(state.cards)
      }
      set((prev) => ({
        currentChain: nextChain,
        state: {
          ...prev.state,
          steps: [...(prev.state.steps || []), newStep],
          initialBoardSnapshot:
            prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
        }
      }))
    }
  },

  executeAttackCard: (instanceId, targetInstanceId) => {
    const { state, currentTurn, currentPhase, activeTurnPlayer } = get()
    const card = state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return

    const targetCard = targetInstanceId
      ? state.cards.find((c) => c.instanceId === targetInstanceId)
      : undefined
    const direct = !targetCard
    const pName = card.controller === 0 ? '我方' : '对方'
    const cName = resolveCardName(card.code)
    const description = direct
      ? `${pName}【${cName}】直接攻击`
      : `${pName}【${cName}】攻击【${targetCard ? resolveCardName(targetCard.code) : '怪兽'}】`

    const newStep: DuelStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      turn: currentTurn,
      turnPlayer: activeTurnPlayer,
      phase: currentPhase,
      actionPlayer: card.controller,
      actionType: 'ATTACK',
      instanceId,
      cardCode: card.code,
      cardName: card.card?.name,
      fromLocation: CardLocation.MZONE,
      fromSequence: card.sequence,
      targetInstanceId: targetCard?.instanceId,
      targetCardName: targetCard?.card?.name,
      targetPlayer: direct ? (card.controller === 0 ? 1 : 0) : undefined,
      description,
      boardAfter: createLightweightSnapshot(state.cards)
    }

    set((prev) => ({
      currentChain: 0,
      pendingPlacement: null,
      state: {
        ...prev.state,
        steps: [...(prev.state.steps || []), newStep],
        initialBoardSnapshot:
          prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
      }
    }))
  },

  executeReposCard: async (instanceId) => {
    const card = get().state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return
    const nextPos =
      card.position === CardPosition.FACEDOWN_DEFENSE
        ? CardPosition.FACEUP_ATTACK
        : card.position === CardPosition.FACEUP_ATTACK
          ? CardPosition.FACEUP_DEFENSE
          : CardPosition.FACEUP_ATTACK
    get().updateCardPosition(instanceId, nextPos)
  },

  executeNormalSummon: (instanceId) => {
    const { state, moveCard } = get()
    const card = state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return

    const occupiedSeqs = state.cards
      .filter(
        (c) =>
          c.controller === card.controller && c.location === CardLocation.MZONE && c.sequence <= 4
      )
      .map((c) => c.sequence)
    const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
    moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
  },

  executeSpecialSummon: (instanceId) => {
    const { state, moveCard } = get()
    const card = state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return

    const occupiedSeqs = state.cards
      .filter(
        (c) =>
          c.controller === card.controller && c.location === CardLocation.MZONE && c.sequence <= 4
      )
      .map((c) => c.sequence)
    const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
    moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
  },

  executeSetCard: (instanceId, placement) => {
    const { state, moveCards } = get()
    const card = state.cards.find((c) => c.instanceId === instanceId)
    if (!card) return

    const cardType = card.card?.type ?? 0
    const isMonster = card.card
      ? (cardType & CardType.MONSTER) !== 0
      : card.location === CardLocation.MZONE

    let targetLocation: number
    let targetPosition: number
    let defaultSeq: number
    if (placement) {
      targetLocation = placement.location
      targetPosition = placement.position ?? CardPosition.FACEDOWN
      defaultSeq = placement.sequence
    } else if (isFieldSpellCard(card)) {
      targetLocation = CardLocation.SZONE
      targetPosition = CardPosition.FACEDOWN
      defaultSeq = FIELD_ZONE_SEQ
    } else if (isMonster) {
      targetLocation = CardLocation.MZONE
      targetPosition = CardPosition.FACEDOWN_DEFENSE
      const occupiedSeqs = state.cards
        .filter(
          (c) =>
            c.controller === card.controller && c.location === CardLocation.MZONE && c.sequence <= 4
        )
        .map((c) => c.sequence)
      defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
    } else {
      targetLocation = CardLocation.SZONE
      targetPosition = CardPosition.FACEDOWN
      const occupiedSeqs = state.cards
        .filter(
          (c) =>
            c.controller === card.controller && c.location === CardLocation.SZONE && c.sequence <= 4
        )
        .map((c) => c.sequence)
      defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
    }

    const targetController = placement?.controller ?? card.controller
    const displaced = findZoneOccupant(state.cards, targetController, targetLocation, defaultSeq)
    const moves: MoveCardParams[] = []
    if (displaced && displaced.instanceId !== instanceId) {
      moves.push({
        instanceId: displaced.instanceId,
        toLocation: CardLocation.GRAVE,
        toSequence: 999,
        toController: displaced.controller
      })
    }
    moves.push({
      instanceId,
      toLocation: targetLocation,
      toSequence: defaultSeq,
      toController: placement?.controller,
      customPos: targetPosition
    })
    moveCards(moves)
  },

  executeSendToGrave: (instanceId) => {
    get().moveCard(instanceId, CardLocation.GRAVE, 999)
  },

  executeBanishCard: (instanceId) => {
    get().moveCard(instanceId, CardLocation.REMOVED, 999)
  },

  executeDrawCard: (controller) => {
    const { state, moveCard, activeDuelistId } = get()

    const activeDuelist = (state.duelists || []).find(
      (d) => d.id === activeDuelistId && d.team === controller
    )
    const ownerScope = activeDuelist?.id ?? null

    const deckCards = state.cards
      .filter(
        (c) =>
          c.controller === controller &&
          c.location === CardLocation.DECK &&
          (ownerScope ? c.duelistId === ownerScope : true)
      )
      .sort((a, b) => a.sequence - b.sequence)
    if (deckCards.length === 0) return

    const topCard = deckCards[0]
    moveCard(
      topCard.instanceId,
      CardLocation.HAND,
      999,
      controller,
      CardPosition.FACEDOWN,
      ownerScope ?? undefined
    )
  }
})
