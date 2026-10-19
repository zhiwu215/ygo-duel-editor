import { OcgcoreDuelOptionFlag, OcgcoreDuelRule, _OcgcoreConstants } from 'koishipro-core.js'
import { CardLocation } from '@shared/index'
import type { DuelPuzzleState, EngineDuelInitParams } from '@shared/index'
import type { SessionState } from './session-state'

const { OcgcoreScriptConstants } = _OcgcoreConstants

const FIELD_ZONE_SEQUENCE = 5

const MASTER_RULE_TO_DUEL_RULE: Record<number, OcgcoreDuelRule> = {
  2: OcgcoreDuelRule.Rule2,
  3: OcgcoreDuelRule.MasterRule3,
  4: OcgcoreDuelRule.NewMasterRule,
  5: OcgcoreDuelRule.MasterRule2020
}

export function getPzoneSzoneSequence(masterRule: number): [number, number] {
  return masterRule >= 4 ? [0, 4] : [6, 7]
}

export function buildStartDuelOptions(
  masterRule: number,
  firstTurnAttack: boolean
): {
  rule: OcgcoreDuelRule
  flags: OcgcoreDuelOptionFlag[]
} {
  const rule = MASTER_RULE_TO_DUEL_RULE[masterRule] ?? OcgcoreDuelRule.MasterRule2020
  const flags = [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
  if (firstTurnAttack) {
    flags.push(OcgcoreDuelOptionFlag.AttackFirstTurn)
  }
  return { rule, flags }
}

function newEngineCard(
  state: SessionState,
  card: {
    code: number
    owner: number
    player: number
    location: number
    sequence: number
    position: number
  }
): void {
  state.duel!.newCard(card)
}

export function setupFromPuzzleState(state: SessionState, puzzleState: DuelPuzzleState): void {
  const p0Lp = Number(puzzleState.players[0]?.lp ?? 8000)
  const p1Lp = Number(puzzleState.players[1]?.lp ?? 8000)
  state.fieldReader.reset([p0Lp, p1Lp], puzzleState.turnPlayer)

  state.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: 0, drawCount: 1 })
  state.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: 0, drawCount: 1 })

  const pzoneSeq = getPzoneSzoneSequence(puzzleState.masterRule)

  const fieldCards = puzzleState.cards.filter((c) => c.code > 0)
  const handSequenceByInstance = new Map<string, number>()
  for (const controller of [0, 1] as const) {
    puzzleState.cards
      .filter((c) => c.controller === controller && c.location === CardLocation.HAND)
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((c, index) => handSequenceByInstance.set(c.instanceId, index))
  }
  const handFallback: [number, number] = [0, 0]
  let unsupportedPendulum = 0

  const takenSzone = new Set<number>()
  for (const card of fieldCards) {
    if (card.location === CardLocation.SZONE) takenSzone.add(card.sequence)
    if (card.location === CardLocation.FZONE) takenSzone.add(FIELD_ZONE_SEQUENCE)
  }

  for (const card of fieldCards) {
    if (card.location === CardLocation.DECK || card.location === CardLocation.EXTRA) {
      continue
    }
    if (card.location === CardLocation.PZONE) {
      const seq = pzoneSeq[card.sequence]
      if (seq === undefined || takenSzone.has(seq)) {
        unsupportedPendulum++
        continue
      }
      takenSzone.add(seq)
      newEngineCard(state, {
        code: card.code,
        owner: card.owner ?? card.controller,
        player: card.controller,
        location: CardLocation.SZONE,
        sequence: seq,
        position: OcgcoreScriptConstants.POS_FACEUP
      })
      continue
    }
    const isFieldZone = card.location === CardLocation.FZONE
    const sequence =
      card.location === CardLocation.HAND
        ? (handSequenceByInstance.get(card.instanceId) ?? handFallback[card.controller]++)
        : isFieldZone
          ? FIELD_ZONE_SEQUENCE
          : card.sequence
    newEngineCard(state, {
      code: card.code,
      owner: card.owner ?? card.controller,
      player: card.controller,
      location: isFieldZone ? CardLocation.SZONE : card.location,
      sequence,
      position: card.position
    })
  }

  for (const location of [CardLocation.DECK, CardLocation.EXTRA]) {
    const pile = fieldCards
      .filter((c) => c.location === location)
      .sort((a, b) => a.controller - b.controller || a.sequence - b.sequence)
    const pileIndex: [number, number] = [0, 0]
    for (const card of pile) {
      newEngineCard(state, {
        code: card.code,
        owner: card.owner ?? card.controller,
        player: card.controller,
        location: card.location,
        sequence: pileIndex[card.controller]++,
        position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
      })
    }
  }

  let unsupportedOverlay = 0
  for (const card of fieldCards) {
    if (card.location !== CardLocation.MZONE || !card.overlayMaterials?.length) continue
    unsupportedOverlay += card.overlayMaterials.filter((matCode) => matCode > 0).length
  }

  const { rule, flags } = buildStartDuelOptions(
    puzzleState.masterRule,
    Boolean(puzzleState.firstTurnAttack)
  )
  state.duel!.startDuel({ rule, flags })
  state.accumulatedLogs.push(`决斗开始！(MR${puzzleState.masterRule})`)
  if (unsupportedPendulum > 0) {
    state.accumulatedLogs.push(
      `有 ${unsupportedPendulum} 张灵摆区卡片未能还原（物理格冲突或规则版本不支持）`
    )
  }
  if (unsupportedOverlay > 0) {
    state.accumulatedLogs.push(
      `引擎无法还原 ${unsupportedOverlay} 张超量素材（ocgcore 建卡不接受 LOCATION_OVERLAY）`
    )
  }
}

export function setupFromDeckParams(state: SessionState, params: EngineDuelInitParams): void {
  const p0Lp = params.p0Lp ?? 8000
  const p1Lp = params.p1Lp ?? 8000
  state.fieldReader.reset([p0Lp, p1Lp], 0)

  const DEFAULT_DECK = [
    89631139, 89631139, 89631139, 46986414, 46986414, 46986414, 70781052, 70781052, 70781052,
    26082229, 26082229, 72302403, 72302403, 72302403, 53129443, 44095762, 44095762, 44095762,
    83764718, 83764718, 83764718, 6368038, 6368038, 6368038, 12580477, 12580477, 12580477, 74677422,
    74677422, 74677422, 4064256, 4064256, 4064256, 89943723, 89943723, 89943723, 10000000, 10000010,
    10000020
  ]

  const p0Deck = params.p0Deck && params.p0Deck.length > 0 ? params.p0Deck : DEFAULT_DECK
  const p1Deck = params.p1Deck && params.p1Deck.length > 0 ? params.p1Deck : DEFAULT_DECK
  if (!params.p0Deck?.length || !params.p1Deck?.length) {
    state.accumulatedLogs.push('未提供卡组，使用默认测试卡组')
  }
  const p0Extra = params.p0Extra || []
  const p1Extra = params.p1Extra || []

  const p0StartHand = params.p0StartHand ?? (p0Deck.length > 0 ? 5 : 0)
  const p1StartHand = params.p1StartHand ?? (p1Deck.length > 0 ? 5 : 0)

  state.duel!.setPlayerInfo({ player: 0, lp: p0Lp, startHand: p0StartHand, drawCount: 1 })
  state.duel!.setPlayerInfo({ player: 1, lp: p1Lp, startHand: p1StartHand, drawCount: 1 })

  for (const code of [...p0Deck].reverse()) {
    newEngineCard(state, {
      code,
      owner: 0,
      player: 0,
      location: OcgcoreScriptConstants.LOCATION_DECK,
      sequence: 0,
      position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
    })
  }
  for (const code of p0Extra) {
    newEngineCard(state, {
      code,
      owner: 0,
      player: 0,
      location: OcgcoreScriptConstants.LOCATION_EXTRA,
      sequence: 0,
      position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
    })
  }
  for (const code of [...p1Deck].reverse()) {
    newEngineCard(state, {
      code,
      owner: 1,
      player: 1,
      location: OcgcoreScriptConstants.LOCATION_DECK,
      sequence: 0,
      position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
    })
  }
  for (const code of p1Extra) {
    newEngineCard(state, {
      code,
      owner: 1,
      player: 1,
      location: OcgcoreScriptConstants.LOCATION_EXTRA,
      sequence: 0,
      position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
    })
  }

  state.duel!.startDuel({
    rule: OcgcoreDuelRule.MasterRule2020,
    flags: [OcgcoreDuelOptionFlag.PseudoShuffle]
  })
  state.accumulatedLogs.push('决斗开始！')
}
