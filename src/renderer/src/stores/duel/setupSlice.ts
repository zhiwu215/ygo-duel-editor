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
  createDefaultDuelists,
  createLightweightSnapshot,
  replayStepsBoard
} from '@shared/index'
import { fetchCardDataByCodes } from '../../utils/cardData'
import type { DuelStore } from './types'

export const FIELD_ZONE_SEQ = 5

export function isFieldSpellCard(card: FieldCard): boolean {
  if (!card.card) return false
  const t = card.card.type
  return (t & CardType.SPELL) !== 0 && (t & CardType.FIELD) !== 0
}

interface BoardLayoutResult {
  players: [PlayerState, PlayerState]
  duelists: Duelist[]
  cards: FieldCard[]

  initialSnapshot: LightweightCardSnapshot[] | null
  selectedInstanceId: string | null
  hoveredCard: CdbCard | null
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
        .state.cards.filter(
          (card) => card.code > 0 && !card.card && !pendingCardCodes.has(card.code)
        )
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

export interface SetupSlice {
  setCardData: (instanceId: string, card: CdbCard) => void

  applyDuelScreenplay: (params: {
    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
    cards: ResolvedBoardPlacement[]
    steps: Array<Omit<DuelStep, 'id'>>
    clearExisting: boolean
  }) => void

  applyDeckToPlayer: (player: 0 | 1, deck: DeckData, drawCount?: number, duelistId?: string) => void
}

export const createSetupSlice: StateCreator<DuelStore, [], [], SetupSlice> = (set, get) => ({
  setCardData: (instanceId, card) =>
    set((prev) => ({
      state: {
        ...prev.state,
        cards: prev.state.cards.map((c) => (c.instanceId === instanceId ? { ...c, card } : c))
      }
    })),

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

  applyDeckToPlayer: (player, deck, drawCount = 0, duelistId) => {
    set((prev) => {
      const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === player)
      const multi = teamDuelists.length > 1

      const ownerScope =
        duelistId && teamDuelists.some((d) => d.id === duelistId)
          ? duelistId
          : multi
            ? (teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ?? teamDuelists[0]?.id)
            : null

      const assignDuelistId = ownerScope ?? teamDuelists[0]?.id ?? `duelist_${player}_0`

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
          sequence: i,
          position: CardPosition.FACEDOWN,
          overlayMaterials: [],
          duelistId: assignDuelistId
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
          duelistId: assignDuelistId
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
          duelistId: assignDuelistId
        })
      }

      const nextCards = [...otherCards, ...newCards]

      const nextDuelists = prev.state.duelists
        ? prev.state.duelists.map((d) =>
            d.team === player && (!ownerScope || d.id === ownerScope)
              ? { ...d, deckId: deck.id }
              : d
          )
        : prev.state.duelists

      return {
        state: {
          ...prev.state,
          cards: nextCards,
          duelists: nextDuelists,

          initialBoardSnapshot: createLightweightSnapshot(nextCards),
          initialLp: [prev.state.players[0]?.lp ?? 8000, prev.state.players[1]?.lp ?? 8000]
        },

        selectedCardId: null,
        hoveredCard: null
      }
    })
    fillMissingCardData(get)
  }
})
