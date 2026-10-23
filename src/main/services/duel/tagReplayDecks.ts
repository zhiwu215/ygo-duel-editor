import { CardLocation, isStandardTag } from '@shared/index'
import type { DuelPuzzleState, FieldCard } from '@shared/index'
import type { YrpTagDeck } from '../yrpWriter'

export interface TagReplayData {
  decks: YrpTagDeck[]
  startLp: number
  startHand: number
  drawCount: number
}

const TAG_SEATS = ['duelist_0_0', 'duelist_0_1', 'duelist_1_1', 'duelist_1_0'] as const

const PRIVATE_PILES = new Set<number>([CardLocation.DECK, CardLocation.EXTRA, CardLocation.HAND])

function cardsOf(state: DuelPuzzleState, duelistId: string): FieldCard[] {
  return state.cards.filter((card) => card.code > 0 && card.duelistId === duelistId)
}

function pack(cards: FieldCard[], location: number): number[] {
  return cards
    .filter((card) => card.location === location)
    .sort((a, b) => a.sequence - b.sequence)
    .map((card) => card.code)
}

function deckOf(state: DuelPuzzleState, duelistId: string): YrpTagDeck {
  const cards = cardsOf(state, duelistId)
  return {
    main: [
      ...pack(cards, CardLocation.DECK).reverse(),
      ...pack(cards, CardLocation.HAND).reverse()
    ],
    extra: [...pack(cards, CardLocation.EXTRA).reverse()]
  }
}

export function buildTagReplayData(state: DuelPuzzleState): TagReplayData {
  if (!isStandardTag(state.matchConfig)) {
    throw new Error('2v2 回放仅支持标准双打。')
  }
  const outside = state.cards.filter((card) => card.code > 0 && !PRIVATE_PILES.has(card.location))
  if (outside.length > 0) {
    throw new Error('2v2 回放暂不支持带初始场面的对局；请从空场开局后再导出。')
  }

  const main0Hand = cardsOf(state, 'duelist_0_0').filter(
    (card) => card.location === CardLocation.HAND
  ).length
  const main1Hand = cardsOf(state, 'duelist_1_0').filter(
    (card) => card.location === CardLocation.HAND
  ).length
  if (main0Hand !== main1Hand) {
    throw new Error('2v2 回放要求双方先锋的起始手牌数相同。')
  }
  if (main0Hand === 0) {
    throw new Error('2v2 回放需要双方先锋至少有 1 张起始手牌。')
  }

  const lp0 = Number(state.players[0]?.lp ?? 8000)
  const lp1 = Number(state.players[1]?.lp ?? 8000)
  if (lp0 !== lp1) {
    throw new Error('2v2 回放要求双方队伍的初始 LP 相同。')
  }

  const decks = TAG_SEATS.map((duelistId) => deckOf(state, duelistId))
  if (decks.some((deck) => deck.main.length === 0)) {
    throw new Error('2v2 回放需要四名决斗者都配置卡组。')
  }

  return { decks, startLp: lp0, startHand: main0Hand, drawCount: 1 }
}
