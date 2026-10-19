import { MasterRule } from './rules'
import { Duelist, DuelPuzzleState, DuelType, FieldCard, MatchConfig } from './duel'
import { LightweightCardSnapshot } from './story'

export function createLightweightSnapshot(cards: FieldCard[]): LightweightCardSnapshot[] {
  return cards.map((c) => ({
    instanceId: c.instanceId,
    code: c.code,
    controller: c.controller,
    owner: c.owner,
    location: c.location,
    sequence: c.sequence,
    position: c.position,
    overlayMaterials: [...(c.overlayMaterials || [])],
    duelistId: c.duelistId,
    customAtk: c.customAtk,
    customDef: c.customDef
  }))
}

export function getMatchScenarioKey(config: MatchConfig): string {
  if (config.mode === '1v1') return '1v1'
  if (config.mode === 'tag') return 'tag'
  return `custom_${config.team0Count}_${config.team1Count}`
}

export function isExportableMatch(config?: MatchConfig): boolean {
  if (!config) return true
  if (config.mode === '1v1') return true
  if (config.mode === 'tag') return true
  if (config.mode === 'custom') {
    return (
      (config.team0Count === 1 && config.team1Count === 1) ||
      (config.team0Count === 2 && config.team1Count === 2)
    )
  }
  return false
}

export function createDefaultDuelists(team0Count: number, team1Count: number): Duelist[] {
  const duelists: Duelist[] = []
  let currentOrder = 1
  const maxCount = Math.max(team0Count, team1Count)
  const orderedList: { team: 0 | 1; idx: number }[] = []
  for (let step = 0; step < maxCount; step++) {
    if (step < team0Count) orderedList.push({ team: 0, idx: step })
    if (step < team1Count) orderedList.push({ team: 1, idx: step })
  }

  for (let i = 0; i < team0Count; i++) {
    const orderIdx = orderedList.findIndex((item) => item.team === 0 && item.idx === i)
    const turnOrder = orderIdx !== -1 ? orderIdx + 1 : currentOrder++
    duelists.push({
      id: `duelist_0_${i}`,
      team: 0,
      name: team0Count === 1 ? '我方' : `我方 ${i + 1}`,
      lp: 8000,
      isFirst: turnOrder === 1,
      turnOrder
    })
  }
  for (let j = 0; j < team1Count; j++) {
    const orderIdx = orderedList.findIndex((item) => item.team === 1 && item.idx === j)
    const turnOrder = orderIdx !== -1 ? orderIdx + 1 : currentOrder++
    duelists.push({
      id: `duelist_1_${j}`,
      team: 1,
      name: team1Count === 1 ? '对方' : `对方 ${j + 1}`,
      lp: 8000,
      isFirst: turnOrder === 1,
      turnOrder
    })
  }
  return duelists
}

export function createInitialDuelState(
  masterRule: MasterRule = 5,
  duelType: DuelType = 'full'
): DuelPuzzleState {
  const matchConfig: MatchConfig = {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1,
    sharedLp: false
  }

  const duelists = createDefaultDuelists(1, 1)

  return {
    version: '1.2.0',
    title: '未命名对局',
    hint: '',
    duelType,
    masterRule,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    duelists,
    matchConfig,
    scenarios: {},
    turnPlayer: 0,
    firstTurnAttack: false,
    cards: [],
    steps: []
  }
}

export function normalizeDuelState(state: DuelPuzzleState): DuelPuzzleState {
  const matchConfig: MatchConfig = state.matchConfig || {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1,
    sharedLp: false
  }

  let duelists = state.duelists
  if (!duelists || duelists.length === 0) {
    duelists = createDefaultDuelists(matchConfig.team0Count, matchConfig.team1Count)
    if (state.players?.[0])
      duelists.filter((d) => d.team === 0).forEach((d) => (d.lp = state.players[0].lp))
    if (state.players?.[1])
      duelists.filter((d) => d.team === 1).forEach((d) => (d.lp = state.players[1].lp))
  }

  const hasOrders = duelists.some((d) => typeof d.turnOrder === 'number')
  if (!hasOrders) {
    let nextOrder = 2
    duelists.forEach((d) => {
      if (d.isFirst) {
        d.turnOrder = 1
      } else {
        d.turnOrder = nextOrder++
      }
    })
  }

  const firstDuelist =
    duelists.find((d) => d.turnOrder === 1) || duelists.find((d) => d.isFirst) || duelists[0]
  if (firstDuelist) {
    duelists.forEach((d) => {
      d.isFirst = d.id === firstDuelist.id
      if (d.isFirst) d.turnOrder = 1
    })
  }

  const team0Duelists = duelists.filter((d) => d.team === 0)
  const team1Duelists = duelists.filter((d) => d.team === 1)

  const updatedCards = state.cards.map((card) => {
    if (card.duelistId) return card
    const defaultDuelist = card.controller === 0 ? team0Duelists[0] : team1Duelists[0]
    return {
      ...card,
      duelistId: defaultDuelist?.id || (card.controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
    }
  })

  return {
    ...state,
    version: state.version || '1.2.0',
    duelType: state.duelType || 'full',
    title: state.title || '未命名对局',
    hint: state.hint || '',
    matchConfig,
    duelists,
    scenarios: state.scenarios || {},
    cards: updatedCards
  }
}
