import type { DuelPuzzleState } from '../types/duel'
import { reversePileSequences } from './pileSequences'

interface FingerprintCard {
  id: string
  code: number
  controller: 0 | 1
  owner: 0 | 1
  location: number
  sequence: number
  position: number
  overlayMaterials: number[]
  duelistId?: string
  counters?: [number, number][]
}

interface BoardFingerprintPayload {
  masterRule: number
  turnPlayer: 0 | 1
  firstTurnAttack: boolean
  lp: [number, number]
  cards: FingerprintCard[]
}

export interface BoardFingerprintOptions {
  enginePileOrder?: boolean
}

function fingerprintCounters(counters: Record<number, number>): [number, number][] {
  return Object.entries(counters)
    .map(([code, count]) => [Number(code), count] as [number, number])
    .sort((left, right) => left[0] - right[0])
}

export function computeBoardFingerprint(
  state: DuelPuzzleState,
  options?: BoardFingerprintOptions
): string {
  const cards = options?.enginePileOrder ? reversePileSequences(state.cards) : state.cards
  const payload: BoardFingerprintPayload = {
    masterRule: state.masterRule,
    turnPlayer: state.turnPlayer,
    firstTurnAttack: Boolean(state.firstTurnAttack),
    lp: [state.players[0]?.lp ?? 0, state.players[1]?.lp ?? 0],
    cards: [...cards]
      .sort((left, right) =>
        left.instanceId < right.instanceId ? -1 : left.instanceId > right.instanceId ? 1 : 0
      )
      .map((card) => ({
        id: card.instanceId,
        code: card.code,
        controller: card.controller,
        owner: card.owner,
        location: card.location,
        sequence: card.sequence,
        position: card.position,
        overlayMaterials: [...(card.overlayMaterials ?? [])],
        ...(card.duelistId ? { duelistId: card.duelistId } : {}),
        ...(card.counters ? { counters: fingerprintCounters(card.counters) } : {})
      }))
  }
  return JSON.stringify(payload)
}

export function boardFingerprintMatches(
  saved: string | undefined,
  current: string | undefined
): boolean {
  return Boolean(saved) && saved === current
}
