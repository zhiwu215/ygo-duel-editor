import { OcgcoreDuelOptionFlag, OcgcoreDuelRule, _OcgcoreConstants } from 'koishipro-core.js'
import {
  CardLocation,
  FIELD_ZONE_SEQUENCE,
  createStandardTagDuelists,
  findTagHandMismatches,
  formatTagHandMismatches,
  getPzoneSzoneSequence,
  isStandardTag
} from '@shared/index'
import type { DuelPuzzleState, EngineDuelInitParams, FieldCard } from '@shared/index'
import type { SessionState } from './session-state'

const { OcgcoreScriptConstants } = _OcgcoreConstants

const MASTER_RULE_TO_DUEL_RULE: Record<number, OcgcoreDuelRule> = {
  2: OcgcoreDuelRule.Rule2,
  3: OcgcoreDuelRule.MasterRule3,
  4: OcgcoreDuelRule.NewMasterRule,
  5: OcgcoreDuelRule.MasterRule2020
}

export function buildStartDuelOptions(
  masterRule: number,
  firstTurnAttack: boolean,
  tag = false
): {
  rule: OcgcoreDuelRule
  flags: OcgcoreDuelOptionFlag[]
} {
  const rule = MASTER_RULE_TO_DUEL_RULE[masterRule] ?? OcgcoreDuelRule.MasterRule2020
  const flags = [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
  if (firstTurnAttack) {
    flags.push(OcgcoreDuelOptionFlag.AttackFirstTurn)
  }
  if (tag) {
    flags.push(OcgcoreDuelOptionFlag.TagMode)
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

function setupStandardTagFromPuzzleState(state: SessionState, puzzleState: DuelPuzzleState): void {
  const duelists =
    puzzleState.duelists && puzzleState.duelists.length === 4
      ? puzzleState.duelists
      : createStandardTagDuelists()
  const teamDuelists = (team: 0 | 1): typeof duelists =>
    duelists.filter((duelist) => duelist.team === team)
  const team0 = teamDuelists(0)
  const team1 = teamDuelists(1)
  if (team0.length !== 2 || team1.length !== 2) {
    throw new Error('标准 2v2 需要每队恰好两名决斗者。')
  }
  const memberOf = (team: 0 | 1, member: 0 | 1): (typeof duelists)[number] | undefined =>
    duelists.find((duelist) => duelist.id === `duelist_${team}_${member}`) ??
    (team === 0 ? team0 : team1)[member]
  const main0 = memberOf(0, 0)
  const tag0 = memberOf(0, 1)
  const main1 = memberOf(1, 0)
  const tag1 = memberOf(1, 1)
  if (!main0 || !tag0 || !main1 || !tag1) {
    throw new Error('标准 2v2 的决斗者座位不完整。')
  }

  const p0Lp = Number(puzzleState.players[0]?.lp ?? main0.lp ?? 8000)
  const p1Lp = Number(puzzleState.players[1]?.lp ?? main1.lp ?? 8000)
  state.fieldReader.reset([p0Lp, p1Lp], puzzleState.turnPlayer, {
    duelists: [
      { id: main0.id, team: 0, seat: 0, name: main0.name },
      { id: main1.id, team: 1, seat: 1, name: main1.name },
      { id: tag0.id, team: 0, seat: 2, name: tag0.name },
      { id: tag1.id, team: 1, seat: 3, name: tag1.name }
    ]
  })

  const cardsOf = (duelistId: string, location: number): FieldCard[] =>
    puzzleState.cards
      .filter((card) => card.code > 0 && card.duelistId === duelistId && card.location === location)
      .sort((a, b) => a.sequence - b.sequence)

  const mainHand0 = cardsOf(main0.id, CardLocation.HAND)
  const mainHand1 = cardsOf(main1.id, CardLocation.HAND)
  const mismatches = findTagHandMismatches(puzzleState)
  if (mismatches.length > 0) {
    throw new Error(formatTagHandMismatches())
  }

  state.duel!.setPlayerInfo({
    player: 0,
    lp: p0Lp,
    startHand: mainHand0.length,
    drawCount: 1
  })
  state.duel!.setPlayerInfo({
    player: 1,
    lp: p1Lp,
    startHand: mainHand1.length,
    drawCount: 1
  })

  const seeds: { key: string; code: number; instanceId: string }[] = []
  const addDeckStack = (
    duelist: (typeof duelists)[number],
    team: 0 | 1,
    tagSeat: boolean
  ): void => {
    const deck = cardsOf(duelist.id, CardLocation.DECK)
    const hand = cardsOf(duelist.id, CardLocation.HAND)
    const extra = cardsOf(duelist.id, CardLocation.EXTRA)
    for (const card of [...deck].reverse()) {
      if (tagSeat) {
        state.duel!.newTagCard({ code: card.code, owner: team, location: CardLocation.DECK })
      } else {
        state.duel!.newCard({
          code: card.code,
          owner: team,
          player: team,
          location: CardLocation.DECK,
          sequence: 0,
          position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
        })
      }
    }
    for (const card of [...hand].reverse()) {
      if (tagSeat) {
        state.duel!.newTagCard({ code: card.code, owner: team, location: CardLocation.DECK })
      } else {
        state.duel!.newCard({
          code: card.code,
          owner: team,
          player: team,
          location: CardLocation.DECK,
          sequence: 0,
          position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
        })
      }
    }
    for (const card of [...extra].reverse()) {
      if (tagSeat) {
        state.duel!.newTagCard({ code: card.code, owner: team, location: CardLocation.EXTRA })
      } else {
        state.duel!.newCard({
          code: card.code,
          owner: team,
          player: team,
          location: CardLocation.EXTRA,
          sequence: 0,
          position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
        })
      }
    }
  }

  addDeckStack(main0, 0, false)
  addDeckStack(tag0, 0, true)
  addDeckStack(main1, 1, false)
  addDeckStack(tag1, 1, true)

  const pzoneSeq = getPzoneSzoneSequence(puzzleState.masterRule)
  const takenSzone = new Map<0 | 1, Set<number>>([
    [0, new Set<number>()],
    [1, new Set<number>()]
  ])
  const pileSequences = new Map<string, number>()
  const sharedCards = puzzleState.cards.filter(
    (card) =>
      card.code > 0 &&
      card.location !== CardLocation.DECK &&
      card.location !== CardLocation.EXTRA &&
      card.location !== CardLocation.HAND
  )
  const addSharedCard = (card: FieldCard, location: number, sequence: number): void => {
    state.duel!.newCard({
      code: card.code,
      owner: card.owner ?? card.controller,
      player: card.controller,
      location,
      sequence,
      position: card.position
    })
    seeds.push({
      key: `${card.controller}:${location}:${sequence}`,
      code: card.code,
      instanceId: card.instanceId
    })
  }

  for (const card of sharedCards) {
    if (card.location === CardLocation.GRAVE || card.location === CardLocation.REMOVED) {
      const key = `${card.controller}:${card.location}`
      const sequence = pileSequences.get(key) ?? 0
      pileSequences.set(key, sequence + 1)
      addSharedCard(card, card.location, sequence)
      continue
    }
    if (card.location === CardLocation.PZONE) {
      const sequence = pzoneSeq[card.sequence]
      const taken = takenSzone.get(card.controller)!
      if (sequence === undefined || taken.has(sequence)) continue
      taken.add(sequence)
      addSharedCard(card, CardLocation.SZONE, sequence)
      continue
    }
    const isFieldZone = card.location === CardLocation.FZONE
    const sequence = isFieldZone ? FIELD_ZONE_SEQUENCE : card.sequence
    if (isFieldZone) {
      takenSzone.get(card.controller)!.add(FIELD_ZONE_SEQUENCE)
    } else if (card.location === CardLocation.SZONE) {
      takenSzone.get(card.controller)!.add(sequence)
    }
    addSharedCard(card, isFieldZone ? CardLocation.SZONE : card.location, sequence)
  }

  state.duel!.setRegistryValue('duel_mode', 'tag')
  state.duel!.setRegistryValue('player_type_0', '0')
  state.duel!.setRegistryValue('player_type_1', '1')
  state.duel!.setRegistryValue('player_name_0', main0.name)
  state.duel!.setRegistryValue('player_name_1', main1.name)
  state.duel!.setRegistryValue('player_name_2', tag0.name)
  state.duel!.setRegistryValue('player_name_3', tag1.name)

  const { rule, flags } = buildStartDuelOptions(
    puzzleState.masterRule,
    Boolean(puzzleState.firstTurnAttack),
    true
  )
  state.fieldReader.seedIdentity(seeds)
  state.duel!.startDuel({ rule, flags })
  state.accumulatedLogs.push(
    `标准 2v2 双打开始！(MR${puzzleState.masterRule}) ${main0.name}/${tag0.name} vs ${main1.name}/${tag1.name}`
  )
}

export function setupFromPuzzleState(state: SessionState, puzzleState: DuelPuzzleState): void {
  if (isStandardTag(puzzleState.matchConfig)) {
    setupStandardTagFromPuzzleState(state, puzzleState)
    return
  }
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

  const seeds: { key: string; code: number; instanceId: string }[] = []
  const createEngineCard = (
    puzzleCard: (typeof fieldCards)[number],
    location: number,
    sequence: number,
    position: number,
    seedSequence = sequence
  ): void => {
    const isPrivatePile =
      location === CardLocation.HAND ||
      location === CardLocation.DECK ||
      location === CardLocation.EXTRA
    state.duel!.newCard({
      code: puzzleCard.code,
      owner: isPrivatePile ? puzzleCard.controller : (puzzleCard.owner ?? puzzleCard.controller),
      player: puzzleCard.controller,
      location,
      sequence,
      position
    })
    seeds.push({
      key: `${puzzleCard.controller}:${location}:${seedSequence}`,
      code: puzzleCard.code,
      instanceId: puzzleCard.instanceId
    })
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
      createEngineCard(card, CardLocation.SZONE, seq, OcgcoreScriptConstants.POS_FACEUP)
      continue
    }
    const isFieldZone = card.location === CardLocation.FZONE
    const sequence =
      card.location === CardLocation.HAND
        ? (handSequenceByInstance.get(card.instanceId) ?? handFallback[card.controller]++)
        : isFieldZone
          ? FIELD_ZONE_SEQUENCE
          : card.sequence
    createEngineCard(
      card,
      isFieldZone ? CardLocation.SZONE : card.location,
      sequence,
      card.position
    )
  }

  for (const location of [CardLocation.DECK, CardLocation.EXTRA]) {
    const pile = fieldCards
      .filter((c) => c.location === location)
      .sort((a, b) => a.controller - b.controller || a.sequence - b.sequence)
    const byController: [FieldCard[], FieldCard[]] = [[], []]
    for (const card of pile) byController[card.controller].push(card)
    for (const controller of [0, 1] as const) {
      const cards = byController[controller]
      if (location === CardLocation.DECK) {
        cards.forEach((card, index) => {
          createEngineCard(
            card,
            location,
            index,
            OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE,
            cards.length - 1 - index
          )
        })
        continue
      }
      const reversed = [...cards].reverse()
      reversed.forEach((card, index) => {
        createEngineCard(card, location, 0, OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE, index)
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
  state.fieldReader.seedIdentity(seeds)
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
