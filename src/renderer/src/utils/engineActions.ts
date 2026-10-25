import { CardLocation } from '@shared/index'
import { EngineRequest, RequestCard } from '@shared/engine/protocol'

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

function sameCardPosition(requestCard: RequestCard, card: EngineCardIdentity): boolean {
  if (requestCard.location === card.location && requestCard.sequence === card.sequence) return true
  if (
    requestCard.location === CardLocation.FZONE &&
    card.location === CardLocation.SZONE &&
    card.sequence === 5
  ) {
    return true
  }
  return (
    requestCard.location === CardLocation.SZONE &&
    requestCard.sequence === 5 &&
    card.location === CardLocation.FZONE
  )
}

export function isRequestCardAt(requestCard: RequestCard, card: EngineCardIdentity): boolean {
  return (
    requestCard.controller === card.controller &&
    sameCardPosition(requestCard, card) &&
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
  }
): RequestCard[] {
  if (!list) return []
  return list.filter((item) => isRequestCardAt(item, card))
}

function matchCard(
  list: RequestCard[] | undefined,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  }
): RequestCard | undefined {
  return matchCards(list, card)[0]
}

export function deriveCardEngineActions(
  request: EngineRequest | null,
  card: {
    code: number
    controller: 0 | 1
    location: number
    sequence: number
    duelistId?: string
  } | null
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
      summon: matchCard(d.summonable, key),
      spSummon: matchCard(d.spSummonable, key),
      mset: matchCard(d.msetable, key),
      sset: matchCard(d.ssetable, key),
      repos: matchCard(d.reposable, key),
      activate: matchCards(d.activatable, key),
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
      activate: matchCards(d.activatable, key),
      attack: matchCard(d.attackable, key)
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
      chain: matchCard(d.chains, key)
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
  } | null
): boolean {
  const actions = deriveCardEngineActions(request, card)
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
  } | null
): boolean {
  return (deriveCardEngineActions(request, card)?.activate.length ?? 0) > 0
}
