import type {
  DuelPhase,
  DuelPuzzleState,
  EnginePendingSelect,
  EngineProbeOptionsResult,
  EngineProbeReplay,
  EngineSelectCandidate,
  FieldCard
} from '@shared/index'
import { CardLocation } from '@shared/index'

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

export interface RuleCheckApi {
  active: boolean
  degraded: boolean
  warnings: string[]
  allows: (card: FieldCard, kind: RuleCheckKind) => boolean
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
      entry.location === card.location
  )
}

function attackContains(probe: EngineProbeOptionsResult, card: FieldCard): boolean {
  return probe.attack.some(
    (entry) =>
      entry.code === card.code &&
      entry.controller === card.controller &&
      entry.location === CardLocation.MZONE
  )
}

export function enginePromptUsesModal(prompt: EnginePendingSelect): boolean {
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
