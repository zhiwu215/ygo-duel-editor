import { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { isSameZoneSlot } from './engineCardPosition'

export interface CardEngineActions {
  requestKind: 'idle' | 'battle' | 'chain'
  summon?: RequestCard
  spSummon?: RequestCard
  mset?: RequestCard
  sset?: RequestCard
  repos?: RequestCard
  activate: RequestCard[]
  attack?: RequestCard
  chain?: RequestCard
}

interface EngineCardIdentity {
  controller: 0 | 1
  location: number
  sequence: number
  duelistId?: string
}

function isRequestCardAt(
  requestCard: RequestCard,
  card: EngineCardIdentity,
  masterRule: number
): boolean {
  return (
    requestCard.controller === card.controller &&
    isSameZoneSlot(masterRule, requestCard, card) &&
    (!requestCard.duelistId || requestCard.duelistId === card.duelistId)
  )
}

function matchCards(
  list: RequestCard[] | undefined,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  },
  masterRule: number
): RequestCard[] {
  if (!list) return []
  return list.filter((item) => isRequestCardAt(item, card, masterRule))
}

function matchCard(
  list: RequestCard[] | undefined,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  },
  masterRule: number
): RequestCard | undefined {
  return matchCards(list, card, masterRule)[0]
}

export function deriveCardEngineActions(
  request: EngineRequest | null,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  } | null,
  masterRule: number
): CardEngineActions | null {
  if (!request || !card) return null
  const d = request.data
  if (d.kind !== 'idle' && d.kind !== 'battle' && d.kind !== 'chain') return null
  const key = {
    code: card.code,
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    duelistId: card.duelistId
  }

  if (d.kind === 'idle') {
    return {
      requestKind: 'idle',
      summon: matchCard(d.summonable, key, masterRule),
      spSummon: matchCard(d.spSummonable, key, masterRule),
      mset: matchCard(d.msetable, key, masterRule),
      sset: matchCard(d.ssetable, key, masterRule),
      repos: matchCard(d.reposable, key, masterRule),
      activate: matchCards(d.activatable, key, masterRule),
      attack: undefined
    }
  }

  if (d.kind === 'battle') {
    return {
      requestKind: 'battle',
      summon: undefined,
      spSummon: undefined,
      mset: undefined,
      sset: undefined,
      repos: undefined,
      activate: matchCards(d.activatable, key, masterRule),
      attack: matchCard(d.attackable, key, masterRule)
    }
  }

  if (d.kind === 'chain') {
    return {
      requestKind: 'chain',
      summon: undefined,
      spSummon: undefined,
      mset: undefined,
      sset: undefined,
      repos: undefined,
      activate: [],
      chain: matchCard(d.chains, key, masterRule)
    }
  }

  return null
}

export function hasCardEngineActions(
  request: EngineRequest | null,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  } | null,
  masterRule: number
): boolean {
  const actions = deriveCardEngineActions(request, card, masterRule)
  if (!actions) return false
  return Boolean(
    actions.summon ||
    actions.spSummon ||
    actions.mset ||
    actions.sset ||
    actions.repos ||
    actions.attack ||
    actions.chain ||
    actions.activate.length > 0
  )
}

export function hasCardEngineActivate(
  request: EngineRequest | null,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  } | null,
  masterRule: number
): boolean {
  return (deriveCardEngineActions(request, card, masterRule)?.activate.length ?? 0) > 0
}
