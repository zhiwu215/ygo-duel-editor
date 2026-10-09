import type {
  DuelPhase,
  DuelPuzzleState,
  EnginePendingSelect,
  EngineProbeOptionsResult,
  EngineProbeReplay,
  EngineSelectCandidate,
  EngineProbeEntry,
  EngineProbeActivateOption,
  FieldCard
} from '@shared/index'
import { CardLocation, CardPosition, CardType, isCustomCardId } from '@shared/index'

export type RuleCheckKind =
  | 'SUMMON'
  | 'SP_SUMMON'
  | 'SET_MONSTER'
  | 'SET_SPELL'
  | 'ACTIVATE'
  | 'ATTACK'
  | 'REPOSITION'
  | 'TO_GRAVE'
  | 'BANISH'

export interface CardActionOptions {
  canSummon: boolean
  canSpSummon: boolean
  canMonsterSet: boolean
  canSpellSet: boolean
  canActivate: boolean
  activateOptions: EngineProbeActivateOption[]
  canRepos: boolean
  canAttack: boolean
  hasAnyAction: boolean
}

export interface RuleCheckApi {
  active: boolean
  degraded: boolean
  warnings: string[]
  allows: (card: FieldCard, kind: RuleCheckKind) => boolean
  getActions: (card: FieldCard) => CardActionOptions
  probe: EngineProbeOptionsResult | null
}

export function duelStateProbeKey(
  state: DuelPuzzleState,
  currentPhase: DuelPhase,
  replay?: EngineProbeReplay
): string {
  const cardsSig = state.cards
    .map(
      (c) =>
        `${c.code}.${c.controller}.${c.location}.${c.sequence}.${c.position}.${(
          c.overlayMaterials ?? []
        ).join('+')}`
    )
    .join('|')
  const logSig = replay
    ? `log${replay.actions.length}:${replay.actions
        .map((a) => (a.selections ? a.selections.length : -1))
        .join('.')}`
    : 'nolog'
  return [
    cardsSig,
    state.masterRule,
    state.turnPlayer,
    currentPhase,
    state.players[0]?.lp ?? 0,
    state.players[1]?.lp ?? 0,
    state.firstTurnAttack ? 1 : 0,
    logSig
  ].join('#')
}

function listContains(
  probe: EngineProbeOptionsResult,
  kind: Exclude<RuleCheckKind, 'ATTACK' | 'TO_GRAVE' | 'BANISH'>,
  card: FieldCard
): boolean {
  const list =
    probe[
      kind === 'SUMMON'
        ? 'summon'
        : kind === 'SP_SUMMON'
          ? 'spSummon'
          : kind === 'SET_MONSTER'
            ? 'monsterSet'
            : kind === 'SET_SPELL'
              ? 'spellSet'
              : kind === 'ACTIVATE'
                ? 'activate'
                : 'posChange'
    ]
  return list.some(
    (entry) =>
      entry.code === card.code &&
      entry.controller === card.controller &&
      entry.location === card.location &&
      (entry.sequence === undefined || entry.sequence === card.sequence)
  )
}

function attackContains(probe: EngineProbeOptionsResult, card: FieldCard): boolean {
  return probe.attack.some(
    (entry) =>
      entry.code === card.code &&
      entry.controller === card.controller &&
      entry.location === CardLocation.MZONE &&
      (entry.sequence === undefined || entry.sequence === card.sequence)
  )
}

export function getFallbackActions(card: FieldCard): CardActionOptions {
  const cdb = card.card
  const isMonster = cdb ? (cdb.type & CardType.MONSTER) !== 0 : card.location === CardLocation.MZONE
  const isHand = card.location === CardLocation.HAND
  const isField =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE
  const isPile =
    card.location === CardLocation.GRAVE ||
    card.location === CardLocation.REMOVED ||
    card.location === CardLocation.EXTRA

  let canSummon = false
  let canSpSummon = false
  let canMonsterSet = false
  let canSpellSet = false
  let canActivate = false
  let canRepos = false
  let canAttack = false

  if (isHand) {
    if (isMonster) {
      canSummon = true
      canSpSummon = true
      canMonsterSet = true
      canActivate = cdb ? (cdb.type & CardType.EFFECT) !== 0 : true
    } else {
      canActivate = true
      canSpellSet = true
    }
  } else if (isField) {
    if (isMonster) {
      canRepos = true
      canAttack = card.position !== CardPosition.FACEDOWN_DEFENSE
      canActivate = cdb ? (cdb.type & CardType.EFFECT) !== 0 : true
    } else {
      canActivate = true
    }
  } else if (isPile) {
    canSpSummon = isMonster
    canActivate = true
  }

  const hasAnyAction =
    canSummon || canSpSummon || canMonsterSet || canSpellSet || canActivate || canRepos || canAttack

  return {
    canSummon,
    canSpSummon,
    canMonsterSet,
    canSpellSet,
    canActivate,
    activateOptions: [],
    canRepos,
    canAttack,
    hasAnyAction
  }
}

export function getCardAvailableActions(
  probe: EngineProbeOptionsResult | null,
  card: FieldCard,
  turnPlayer: 0 | 1,
  active: boolean
): CardActionOptions {
  const isCustom = Boolean(card.card?.isCustom || isCustomCardId(card.code))

  if (active && probe && card.controller === turnPlayer) {
    const match = (entry: EngineProbeEntry): boolean =>
      entry.code === card.code &&
      entry.controller === card.controller &&
      entry.location === card.location &&
      (card.location === CardLocation.HAND ||
        entry.sequence === undefined ||
        entry.sequence === card.sequence)

    const canSummon = probe.summon.some(match)
    const canSpSummon = probe.spSummon.some(match)
    const canMonsterSet = probe.monsterSet.some(match)
    const canSpellSet = probe.spellSet.some(match)
    const canRepos = probe.posChange.some(match)
    const canAttack = probe.attack.some(
      (entry) =>
        entry.code === card.code &&
        entry.controller === card.controller &&
        entry.location === CardLocation.MZONE &&
        (entry.sequence === undefined || entry.sequence === card.sequence)
    )

    const activateEntry = probe.activate.find(match)
    const canActivate = Boolean(activateEntry)
    const activateOptions = activateEntry?.options ?? []

    const hasAnyAction =
      canSummon ||
      canSpSummon ||
      canMonsterSet ||
      canSpellSet ||
      canActivate ||
      canRepos ||
      canAttack

    if (hasAnyAction || !isCustom) {
      return {
        canSummon,
        canSpSummon,
        canMonsterSet,
        canSpellSet,
        canActivate,
        activateOptions,
        canRepos,
        canAttack,
        hasAnyAction
      }
    }
  }

  if (isCustom || !active || !probe) {
    return getFallbackActions(card)
  }

  return {
    canSummon: false,
    canSpSummon: false,
    canMonsterSet: false,
    canSpellSet: false,
    canActivate: false,
    activateOptions: [],
    canRepos: false,
    canAttack: false,
    hasAnyAction: false
  }
}

export function enginePromptUsesModal(prompt: EnginePendingSelect): boolean {
  if (prompt.kind === 'YESNO' || prompt.kind === 'OPTION' || prompt.kind === 'POSITION') {
    return true
  }
  return prompt.candidates.some(
    (c) =>
      c.location === CardLocation.DECK ||
      c.location === CardLocation.EXTRA ||
      c.location === CardLocation.GRAVE ||
      c.location === CardLocation.REMOVED
  )
}

export function engineCandidateIndex(
  candidates: EngineSelectCandidate[],
  cards: FieldCard[],
  card: FieldCard
): number {
  const exact = candidates.findIndex(
    (c) =>
      c.code === card.code &&
      c.controller === card.controller &&
      c.location === card.location &&
      c.sequence === card.sequence
  )
  if (exact >= 0) return exact
  const fieldMatch = candidates.findIndex(
    (c) =>
      c.controller === card.controller &&
      c.location === card.location &&
      c.sequence === card.sequence
  )
  if (fieldMatch >= 0) return fieldMatch
  if (card.location !== CardLocation.HAND) return -1
  const sameCodeCandidates = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(
      ({ candidate }) =>
        candidate.code === card.code &&
        candidate.controller === card.controller &&
        candidate.location === CardLocation.HAND
    )
    .sort((a, b) => a.candidate.sequence - b.candidate.sequence)
  if (sameCodeCandidates.length === 0) return -1
  const handPeers = cards
    .filter(
      (o) =>
        o.code === card.code && o.controller === card.controller && o.location === CardLocation.HAND
    )
    .sort((a, b) => a.sequence - b.sequence)
  const peerIndex = handPeers.findIndex((o) => o.instanceId === card.instanceId)
  if (peerIndex < 0) return -1
  return sameCodeCandidates[Math.min(peerIndex, sameCodeCandidates.length - 1)].index
}

export function ruleCheckAllows(
  active: boolean,
  turnPlayer: 0 | 1,
  probe: EngineProbeOptionsResult | null,
  card: FieldCard,
  kind: RuleCheckKind
): boolean {
  if (!active || !probe) return true
  if (card.controller !== turnPlayer) return true
  if (kind === 'TO_GRAVE' || kind === 'BANISH') return false
  if (kind === 'ATTACK') return attackContains(probe, card)
  return listContains(probe, kind, card)
}
