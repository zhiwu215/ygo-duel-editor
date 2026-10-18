import type { StateCreator } from 'zustand'
import {
  AgentBoardLpTarget,
  CdbCard,
  CardLocation,
  CardPosition,
  CardType,
  DeckData,
  DuelPuzzleState,
  DuelStep,
  Duelist,
  FieldCard,
  LightweightCardSnapshot,
  PlayerState,
  ResolvedBoardPlacement,
  allocateCustomCounterId,
  createDefaultDuelists,
  createInitialDuelState,
  createLightweightSnapshot,
  replayStepsBoard
} from '@shared/index'
import { alertDialog } from '../useDialogStore'
import { fetchCardDataByCodes } from '../../utils/cardData'
import { resolveCardName } from '../../utils/cardNames'
import type { DuelStore } from './types'

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

interface BoardLayoutResult {
  players: [PlayerState, PlayerState]
  duelists: Duelist[]
  cards: FieldCard[]

  initialSnapshot: LightweightCardSnapshot[] | null
  selectedInstanceId: string | null
  hoveredCard: CdbCard | null
}

export interface BoardSlice {
  state: DuelPuzzleState

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

  applyDuelScreenplay: (params: {
    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
    cards: ResolvedBoardPlacement[]
    steps: Array<Omit<DuelStep, 'id'>>
    clearExisting: boolean
  }) => void

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
  addOverlayMaterial: (targetInstanceId: string, matCode: number) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void

  overlayOnTop: (
    targetInstanceId: string,
    newCardData: CdbCard,
    sourceCardInstanceId?: string
  ) => void

  swapHostWithMaterial: (targetInstanceId: string, matIndex: number) => void

  detachMaterialToLocation: (
    targetInstanceId: string,
    matIndex: number,
    targetLocation: number
  ) => void

  setCardCounter: (instanceId: string, counterType: number, count: number) => void
  removeCardCounter: (instanceId: string, counterType: number) => void

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

  registerCustomCounter: (name: string) => number
  setCardCustomStats: (instanceId: string, customAtk?: number, customDef?: number) => void

  setCardData: (instanceId: string, card: CdbCard) => void

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

  applyDeckToPlayer: (player: 0 | 1, deck: DeckData, drawCount?: number, duelistId?: string) => void
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

const FIELD_ZONE_SEQ = 5

function isFieldSpellCard(card: FieldCard): boolean {
  if (!card.card) return false
  const t = card.card.type
  return (t & CardType.SPELL) !== 0 && (t & CardType.FIELD) !== 0
}

function findZoneOccupant(
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

function buildLayoutFromSetup(
  state: DuelPuzzleState,
  activeDuelistId: string | null,
  params: {
    lp: AgentBoardLpTarget[]
    cards: ResolvedBoardPlacement[]
    clearExisting?: boolean
  }
): BoardLayoutResult {
  const baseDuelists =
    state.duelists && state.duelists.length > 0
      ? state.duelists
      : createDefaultDuelists(
          state.matchConfig?.team0Count ?? 1,
          state.matchConfig?.team1Count ?? 1
        )

  const sharedLp = Boolean(state.matchConfig?.sharedLp)
  const nextLpBySide = new Map<0 | 1, number>()
  params.lp.forEach((t) => {
    const v = Math.max(0, Math.trunc(t.lp))
    nextLpBySide.set(t.side, v)
  })
  const duelists = baseDuelists.map((d) => {
    if (!nextLpBySide.has(d.team)) return d
    const v = nextLpBySide.get(d.team)!
    const sameTeam = baseDuelists.filter((x) => x.team === d.team)
    return sharedLp || sameTeam.length <= 1 ? { ...d, lp: v } : d
  })

  params.lp.forEach((t) => {
    if (!t.duelistName) return
    const idx = duelists.findIndex((d) => d.name === t.duelistName)
    if (idx >= 0) {
      duelists[idx] = { ...duelists[idx], lp: Math.max(0, Math.trunc(t.lp)) }
    }
  })
  const players: [PlayerState, PlayerState] = [
    nextLpBySide.has(0) ? { ...state.players[0], lp: nextLpBySide.get(0)! } : state.players[0],
    nextLpBySide.has(1) ? { ...state.players[1], lp: nextLpBySide.get(1)! } : state.players[1]
  ]

  const clearExisting = Boolean(params.clearExisting)
  let workingCards = clearExisting ? [] : [...state.cards]
  let selectedInstanceId: string | null = null
  let hoveredCard: CdbCard | null = null
  const unresolvedDuelists: string[] = []

  params.cards.forEach((c) => {
    const location = c.location
    const isPileZone =
      location === CardLocation.HAND ||
      location === CardLocation.GRAVE ||
      location === CardLocation.DECK ||
      location === CardLocation.EXTRA ||
      location === CardLocation.REMOVED
    const isOwnerScopedZone = isPileZone

    let duelistId = c.duelistId
    if (!duelistId && c.duelistName) {
      const hit = baseDuelists.find((d) => d.name === c.duelistName)
      if (hit) duelistId = hit.id
      else unresolvedDuelists.push(c.duelistName)
    }
    if (isOwnerScopedZone && !duelistId) {
      const teamDuelists = baseDuelists.filter((d) => d.team === c.controller)
      duelistId =
        teamDuelists.find((d) => d.id === activeDuelistId)?.id ||
        teamDuelists[0]?.id ||
        (c.controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
    }

    const newCard: FieldCard = {
      instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      code: c.card.id,
      card: c.card,
      controller: c.controller,
      owner: c.controller,
      location,
      sequence: 0,
      position: c.position,
      overlayMaterials: [],
      duelistId: isOwnerScopedZone ? duelistId : undefined,
      customAtk: c.customAtk,
      customDef: c.customDef
    }

    if (isPileZone) {
      const pileSize = workingCards.filter(
        (x) =>
          x.controller === c.controller &&
          x.location === location &&
          (!isOwnerScopedZone || x.duelistId === newCard.duelistId)
      ).length
      newCard.sequence = pileSize
      workingCards.push(newCard)
    } else {
      workingCards = workingCards.filter(
        (x) =>
          !(x.controller === c.controller && x.location === location && x.sequence === c.sequence)
      )
      newCard.sequence = c.sequence
      workingCards.push(newCard)
    }
    selectedInstanceId = newCard.instanceId
    hoveredCard = newCard.card ?? null
  })

  if (unresolvedDuelists.length > 0) {
    console.warn(
      '[useDuelStore] 布局落位未找到决斗者，已回落到阵营首位:',
      unresolvedDuelists.join(', ')
    )
  }

  return {
    players,
    duelists,
    cards: workingCards,
    initialSnapshot: clearExisting ? createLightweightSnapshot(workingCards) : null,
    selectedInstanceId,
    hoveredCard
  }
}

const pendingCardCodes = new Set<number>()

function fillMissingCardData(get: () => DuelStore): void {
  const missing = Array.from(
    new Set(
      get()
        .state.cards.filter((card) => card.code > 0 && !card.card && !pendingCardCodes.has(card.code))
        .map((card) => card.code)
    )
  )
  if (missing.length === 0) return
  for (const code of missing) pendingCardCodes.add(code)
  void fetchCardDataByCodes(missing)
    .then((map) => {
      const store = get()
      for (const card of store.state.cards) {
        if (!card.card && map[card.code]) store.setCardData(card.instanceId, map[card.code])
      }
    })
    .finally(() => {
      for (const code of missing) pendingCardCodes.delete(code)
    })
}

export const createBoardSlice: StateCreator<DuelStore, [], [], BoardSlice> = (set, get) => ({
  state: createInitialDuelState(5),

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
            c.controller === controller &&
            c.location === CardLocation.MZONE &&
            c.sequence === seq
        )
        if (!taken) {
          allowedSlots.push({ location: CardLocation.MZONE, sequence: seq, controller })
        }
      }
    } else {
      for (let seq = 0; seq <= 4; seq++) {
        const taken = state.cards.some(
          (c) =>
            c.controller === controller &&
            c.location === CardLocation.SZONE &&
            c.sequence === seq
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

  addCardToZone: (
    card,
    controller,
    location,
    sequence,
    customPos,
    duelistId,
    engineInstanceId
  ) =>
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
              !(
                c.controller === controller &&
                c.location === location &&
                c.sequence === sequence
              )
          )

      const newCard: FieldCard = {
        instanceId:
          engineInstanceId ??
          `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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

  applyDuelScreenplay: ({ lp, cards, steps, clearExisting }) =>
    set((prev) => {
      const layout = buildLayoutFromSetup(prev.state, prev.activeDuelistId, {
        lp,
        cards,
        clearExisting
      })
      const draft: DuelStep[] = steps.map((s, idx) => ({
        ...s,
        id: `step_${Date.now()}_${idx.toString(36)}_${Math.random().toString(36).substring(2, 7)}`
      }))
      const stepsWithBoard = replayStepsBoard(createLightweightSnapshot(layout.cards), draft)
      const turnPlayer = draft[0]?.turnPlayer ?? prev.state.turnPlayer ?? 0
      return {
        state: {
          ...prev.state,
          players: layout.players,
          duelists: layout.duelists,
          cards: layout.cards,
          steps: stepsWithBoard,
          ...(layout.initialSnapshot ? { initialBoardSnapshot: layout.initialSnapshot } : {})
        },
        selectedCardId: layout.selectedInstanceId,
        hoveredCard: layout.hoveredCard,
        currentStepIndex: null,
        currentTurn: 1,
        currentPhase: 'DP',
        currentChain: 0,
        activeTurnPlayer: turnPlayer
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

      if (prev.isAutoRecording) {
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

  addOverlayMaterial: (targetInstanceId, matCode) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            return {
              ...c,
              overlayMaterials: [...c.overlayMaterials, matCode]
            }
          }
          return c
        })
      }
    })),

  removeOverlayMaterial: (targetInstanceId, matIndex) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            const newMats = [...c.overlayMaterials]
            newMats.splice(matIndex, 1)
            return { ...c, overlayMaterials: newMats }
          }
          return c
        })
      }
    })),

  overlayOnTop: (targetInstanceId, newCardData, sourceCardInstanceId) =>
    set((prev) => {
      let sourceMats: number[] = []
      if (sourceCardInstanceId) {
        const src = prev.state.cards.find((c) => c.instanceId === sourceCardInstanceId)
        if (src && src.overlayMaterials) {
          sourceMats = src.overlayMaterials
        }
      }

      let updatedCards = prev.state.cards
      if (sourceCardInstanceId) {
        updatedCards = updatedCards.filter((c) => c.instanceId !== sourceCardInstanceId)
      }

      const finalCards = updatedCards.map((c) => {
        if (c.instanceId === targetInstanceId) {
          return {
            ...c,

            code: newCardData.id,

            card: newCardData,

            overlayMaterials: [...c.overlayMaterials, c.code, ...sourceMats]
          }
        }
        return c
      })

      let nextSteps = prev.state.steps || []
      if (prev.isAutoRecording) {
        const hostCard = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
        const pName = hostCard?.controller === 0 ? '我方' : '对方'
        nextSteps = [
          ...nextSteps,
          {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: prev.currentTurn,
            turnPlayer: prev.activeTurnPlayer,
            phase: prev.currentPhase,
            actionPlayer: hostCard?.controller ?? 0,
            actionType: 'XYZ_SUMMON',
            instanceId: targetInstanceId,
            cardCode: newCardData.id,
            cardName: newCardData.name,
            toLocation: CardLocation.MZONE,
            toSequence: hostCard?.sequence ?? 0,
            description: `${pName}以叠放怪兽为素材超量召唤【${newCardData.name}】！`,
            boardAfter: createLightweightSnapshot(finalCards)
          }
        ]
      }

      return {
        state: {
          ...prev.state,
          cards: finalCards,
          steps: nextSteps,
          initialBoardSnapshot:
            prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
        },

        selectedCardId:
          prev.selectedCardId === sourceCardInstanceId ? targetInstanceId : prev.selectedCardId
      }
    }),

  setCardData: (instanceId, card) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => (c.instanceId === instanceId ? { ...c, card } : c))
      }
    })),

  swapHostWithMaterial: (targetInstanceId, matIndex) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === targetInstanceId) {
            if (matIndex < 0 || matIndex >= c.overlayMaterials.length) return c
            const oldHostCode = c.code
            const newHostCode = c.overlayMaterials[matIndex]
            const newMats = [...c.overlayMaterials]

            newMats[matIndex] = oldHostCode
            return {
              ...c,
              code: newHostCode,

              card: undefined,
              overlayMaterials: newMats
            }
          }
          return c
        })
      }
    })),

  detachMaterialToLocation: (targetInstanceId, matIndex, targetLocation) =>
    set((prev) => {
      const host = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
      if (!host || matIndex < 0 || matIndex >= host.overlayMaterials.length) return prev
      const matCode = host.overlayMaterials[matIndex]
      const newMats = [...host.overlayMaterials]

      newMats.splice(matIndex, 1)

      const existingPile = prev.state.cards
        .filter((c) => c.controller === host.controller && c.location === targetLocation)
        .sort((a, b) => a.sequence - b.sequence)
      const targetSeq = existingPile.length

      const newCard: FieldCard = {
        instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code: matCode,
        controller: host.controller,
        owner: host.controller,
        location: targetLocation,
        sequence: targetSeq,
        position:
          targetLocation === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEUP,
        overlayMaterials: []
      }

      const finalResultCards = [
        ...prev.state.cards.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, overlayMaterials: newMats } : c
        ),

        newCard
      ]

      let nextSteps = prev.state.steps || []
      if (prev.isAutoRecording) {
        const pName = host.controller === 0 ? '我方' : '对方'
        const hostName = resolveCardName(host.code)
        nextSteps = [
          ...nextSteps,
          {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: prev.currentTurn,
            turnPlayer: prev.activeTurnPlayer,
            phase: prev.currentPhase,
            actionPlayer: host.controller,
            actionType: 'DETACH_MATERIAL',
            instanceId: targetInstanceId,
            cardCode: matCode,
            toLocation: targetLocation,
            toSequence: targetSeq,
            description: `${pName}取除【${hostName}】的超量素材`,
            boardAfter: createLightweightSnapshot(finalResultCards)
          }
        ]
      }

      return {
        state: {
          ...prev.state,
          cards: finalResultCards,
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
    }),

  setCardCounter: (instanceId, counterType, count) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId) {
            const newCounters = { ...(c.counters || {}) }
            if (count <= 0) {
              delete newCounters[counterType]
            } else {
              newCounters[counterType] = count
            }
            return { ...c, counters: newCounters }
          }
          return c
        })
      }
    })),

  removeCardCounter: (instanceId, counterType) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId && c.counters) {
            const newCounters = { ...c.counters }
            delete newCounters[counterType]
            return { ...c, counters: newCounters }
          }
          return c
        })
      }
    })),

  registerCustomCounter: (name) => {
    const trimmed = name.trim()
    const existing = get().state.customCounters || {}
    const found = Object.entries(existing).find(([, n]) => n === trimmed)
    if (found) return Number(found[0])

    const id = allocateCustomCounterId(existing)
    set((prev) => ({
      state: {
        ...prev.state,
        customCounters: { ...(prev.state.customCounters || {}), [id]: trimmed }
      }
    }))
    return id
  },

  setCardCustomStats: (instanceId, customAtk, customDef) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => {
          if (c.instanceId === instanceId) {
            return { ...c, customAtk, customDef }
          }
          return c
        })
      }
    })),

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
      const displaced = findZoneOccupant(
        state.cards,
        targetController,
        targetLocation,
        targetSeq
      )
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
          c.controller === card.controller &&
          c.location === CardLocation.MZONE &&
          c.sequence <= 4
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
          c.controller === card.controller &&
          c.location === CardLocation.MZONE &&
          c.sequence <= 4
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
            c.controller === card.controller &&
            c.location === CardLocation.MZONE &&
            c.sequence <= 4
        )
        .map((c) => c.sequence)
      defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
    } else {
      targetLocation = CardLocation.SZONE
      targetPosition = CardPosition.FACEDOWN
      const occupiedSeqs = state.cards
        .filter(
          (c) =>
            c.controller === card.controller &&
            c.location === CardLocation.SZONE &&
            c.sequence <= 4
        )
        .map((c) => c.sequence)
      defaultSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
    }

    const targetController = placement?.controller ?? card.controller
    const displaced = findZoneOccupant(
      state.cards,
      targetController,
      targetLocation,
      defaultSeq
    )
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
  },

  applyDeckToPlayer: (player, deck, drawCount = 0, duelistId) => {
    set((prev) => {
      const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === player)
      const multi = teamDuelists.length > 1

      const ownerScope =
        duelistId && teamDuelists.some((d) => d.id === duelistId)
          ? duelistId
          : multi
            ? (teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ??
              teamDuelists[0]?.id)
            : null

      const ZONES_TO_CLEAR: number[] = [
        CardLocation.HAND,
        CardLocation.DECK,
        CardLocation.EXTRA,
        CardLocation.MZONE,
        CardLocation.SZONE,
        CardLocation.GRAVE,
        CardLocation.REMOVED
      ]
      const otherCards = prev.state.cards.filter(
        (c) =>
          !(
            c.controller === player &&
            ZONES_TO_CLEAR.includes(c.location) &&
            (ownerScope ? c.duelistId === ownerScope : true)
          )
      )

      const newCards: FieldCard[] = []
      const totalMain = deck.main.length
      const actualDraw = Math.min(drawCount, totalMain)

      for (let i = 0; i < actualDraw; i++) {
        const code = deck.main[i]
        newCards.push({
          instanceId: `inst_${Date.now()}_h_${i}_${Math.random().toString(36).slice(2, 6)}`,
          code,
          controller: player,
          owner: player,
          location: CardLocation.HAND,

          sequence: 900 + i,

          position: CardPosition.FACEDOWN,
          overlayMaterials: [],
          duelistId: ownerScope ?? undefined
        })
      }

      for (let i = actualDraw; i < totalMain; i++) {
        const code = deck.main[i]
        newCards.push({
          instanceId: `inst_${Date.now()}_d_${i}_${Math.random().toString(36).slice(2, 6)}`,
          code,
          controller: player,
          owner: player,
          location: CardLocation.DECK,
          sequence: i - actualDraw,

          position: CardPosition.FACEDOWN,
          overlayMaterials: [],
          duelistId: ownerScope ?? undefined
        })
      }

      for (let i = 0; i < deck.extra.length; i++) {
        const code = deck.extra[i]
        newCards.push({
          instanceId: `inst_${Date.now()}_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
          code,
          controller: player,
          owner: player,
          location: CardLocation.EXTRA,
          sequence: i,
          position: CardPosition.FACEDOWN,
          overlayMaterials: [],
          duelistId: ownerScope ?? undefined
        })
      }

      const nextCards = [...otherCards, ...newCards]

      return {
        state: {
          ...prev.state,
          cards: nextCards,

          initialBoardSnapshot: createLightweightSnapshot(nextCards)
        },

        selectedCardId: null,
        hoveredCard: null
      }
    })
    fillMissingCardData(get)
  }
})
