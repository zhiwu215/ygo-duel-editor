import { CardLocation, FieldCard } from '@shared/index'
import type { Answer, EngineRequest, RequestCard } from '@shared/engine/protocol'
import { resolveCardName } from './cardNames'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export type DuelSelectionKind = 'card' | 'tribute' | 'sum' | 'unselect'
export type DuelSelectionMode = 'point' | 'modal'

export const ATTACK_TARGET_DESC_HINT = 549

export interface DerivedSelection {
  kind: DuelSelectionKind
  candidates: RequestCard[]
  selected: RequestCard[]
  min: number
  max: number
  canCancel: boolean
  canFinish: boolean
  mode: DuelSelectionMode
  attackTarget?: boolean
}

const POINT_LOCATIONS: ReadonlySet<number> = new Set<number>([
  CardLocation.HAND,
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.FZONE
])

function clampSelectRange(
  min: number,
  max: number,
  poolSize: number
): { min: number; max: number } {
  return { min: Math.max(0, min), max: max > 0 ? max : poolSize }
}

function resolveMode(cards: RequestCard[]): DuelSelectionMode {
  return cards.length > 0 && cards.every((card) => POINT_LOCATIONS.has(card.location))
    ? 'point'
    : 'modal'
}

export function requestCardKey(card: {
  code: number
  controller: number
  location: number
  sequence: number
}): string {
  return `${card.controller}:${card.location}:${card.sequence}:${card.code}`
}

export function isSameRequestCard(
  a: { code: number; controller: number; location: number; sequence: number },
  b: { code: number; controller: number; location: number; sequence: number }
): boolean {
  return (
    a.code === b.code &&
    a.controller === b.controller &&
    a.location === b.location &&
    a.sequence === b.sequence
  )
}

export function deriveSelection(
  request: EngineRequest | null | undefined
): DerivedSelection | null {
  if (!request) return null
  const data = request.data

  if (data.kind === 'card' || data.kind === 'tribute') {
    return {
      kind: data.kind,
      candidates: data.cards,
      selected: [],
      ...clampSelectRange(data.min, data.max, data.cards.length),
      canCancel: data.cancelable,
      canFinish: false,
      mode: resolveMode(data.cards),
      attackTarget: data.kind === 'card' && request.descHint === ATTACK_TARGET_DESC_HINT
    }
  }

  if (data.kind === 'sum') {
    return {
      kind: 'sum',
      candidates: data.cards,
      selected: [],
      ...clampSelectRange(data.min, data.max, data.cards.length),
      canCancel: false,
      canFinish: false,
      mode: resolveMode(data.cards)
    }
  }

  if (data.kind === 'unselect') {
    const all = [...data.selectable, ...data.unselectable]
    return {
      kind: 'unselect',
      candidates: data.selectable,
      selected: data.unselectable,
      ...clampSelectRange(data.min, data.max, all.length),
      canCancel: data.cancelable,
      canFinish: data.finishable,
      mode: resolveMode(all)
    }
  }

  return null
}

export function submitAnswer(answer: Answer): void {
  void useDuelEngineStore.getState().submitAnswer(answer)
}

export function submitSelection(derived: DerivedSelection, selected: RequestCard[]): void {
  switch (derived.kind) {
    case 'card':
      submitAnswer({ kind: 'card', cards: selected })
      return
    case 'tribute':
      submitAnswer({ kind: 'tribute', cards: selected })
      return
    case 'sum':
      submitAnswer({ kind: 'sum', cards: selected })
      return
    case 'unselect':
      submitAnswer({ kind: 'unselect', card: selected[0] ?? null })
      return
  }
}

export function cancelSelection(derived: DerivedSelection): void {
  switch (derived.kind) {
    case 'card':
      submitAnswer({ kind: 'card', cards: null })
      return
    case 'tribute':
      submitAnswer({ kind: 'tribute', cards: null })
      return
    case 'unselect':
      submitAnswer({ kind: 'unselect', card: null })
      return
    case 'sum':
      return
  }
}

export interface PickedSelection {
  selected: RequestCard[]
  min: number
  max: number
  ready: boolean
}

export function pickSelected(
  candidates: RequestCard[],
  selectedKeys: string[],
  min: number,
  max: number
): PickedSelection {
  const range = clampSelectRange(min, max, candidates.length)
  const selectedKeySet = new Set(selectedKeys)
  const selected = candidates.filter((card) => selectedKeySet.has(requestCardKey(card)))
  return {
    selected,
    min: range.min,
    max: range.max,
    ready: selected.length >= range.min && selected.length <= range.max
  }
}

export interface CardSelectionMatch {
  derived: DerivedSelection
  requestCard: RequestCard
  chosen: boolean
}

export type CardSelectionRole = 'none' | 'source' | 'chosen' | 'legal' | 'dim' | 'target'

export function resolveCardSelectionMatch(
  request: EngineRequest | null | undefined,
  card: { code: number; controller: number; location: number; sequence: number },
  selectedKeys: string[]
): CardSelectionMatch | null {
  const derived = deriveSelection(request)
  if (!derived || derived.mode !== 'point') return null
  const pool =
    derived.kind === 'unselect' ? [...derived.candidates, ...derived.selected] : derived.candidates
  const requestCard = pool.find((c) => isSameRequestCard(c, card))
  if (!requestCard) return null
  const chosen =
    derived.kind === 'unselect'
      ? derived.selected.some((c) => isSameRequestCard(c, requestCard))
      : selectedKeys.includes(requestCardKey(requestCard))
  return { derived, requestCard, chosen }
}

export function resolveCardRole(selectionMatch: CardSelectionMatch | null): CardSelectionRole {
  if (selectionMatch) {
    if (selectionMatch.derived.attackTarget) return 'target'
    return selectionMatch.chosen ? 'chosen' : 'legal'
  }
  return 'none'
}

export function requestCardName(cards: FieldCard[], requestCard: RequestCard): string {
  const exact = cards.find(
    (card) =>
      card.controller === requestCard.controller &&
      card.location === requestCard.location &&
      card.sequence === requestCard.sequence
  )
  return exact?.card?.name || resolveCardName(requestCard.code)
}
