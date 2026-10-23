import { MasterRule } from './rules'
import {
  Duelist,
  DuelPuzzleState,
  DuelSceneSnapshot,
  DuelType,
  FieldCard,
  MatchConfig
} from './duel'
import { DuelStep, LightweightCardSnapshot } from './story'

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

export function isTwoVsTwo(config?: MatchConfig): boolean {
  return Boolean(config && config.team0Count === 2 && config.team1Count === 2)
}

export function normalizeMatchConfig(config?: MatchConfig): MatchConfig {
  if (!config) return { mode: '1v1', team0Count: 1, team1Count: 1 }
  let mode = config.mode ?? '1v1'
  const team0Count = config.team0Count ?? 1
  const team1Count = config.team1Count ?? 1
  if (mode === 'custom' && team0Count === 1 && team1Count === 1) mode = '1v1'
  if (mode === 'custom' && team0Count === 2 && team1Count === 2) mode = 'tag'
  if (mode === 'tag' || (mode !== '1v1' && team0Count === 2 && team1Count === 2)) {
    const tagFormat = config.tagFormat ?? (config.sharedLp ? 'standard' : 'independent')
    return {
      mode: 'tag',
      team0Count: 2,
      team1Count: 2,
      tagFormat,
      sharedLp: tagFormat === 'standard'
    }
  }
  if (mode === '1v1') return { mode: '1v1', team0Count: 1, team1Count: 1 }
  return { mode, team0Count, team1Count, sharedLp: Boolean(config.sharedLp) }
}

export function isStandardTag(config?: MatchConfig): boolean {
  const normalized = normalizeMatchConfig(config)
  return normalized.mode === 'tag' && normalized.tagFormat === 'standard'
}

export function isIndependentLpTag(config?: MatchConfig): boolean {
  const normalized = normalizeMatchConfig(config)
  return normalized.mode === 'tag' && normalized.tagFormat === 'independent'
}

export function getMatchScenarioKey(config: MatchConfig): string {
  const normalized = normalizeMatchConfig(config)
  if (normalized.mode === '1v1') return '1v1'
  if (normalized.mode === 'tag') {
    return normalized.tagFormat === 'standard' ? 'tag_standard' : 'tag_independent'
  }
  return `custom_${normalized.team0Count}_${normalized.team1Count}`
}

export function isExportableMatch(config?: MatchConfig): boolean {
  const normalized = normalizeMatchConfig(config)
  if (normalized.mode === '1v1') return true
  if (normalized.mode === 'tag') return normalized.tagFormat === 'standard'
  return false
}

export function isInGameTestSupported(config?: MatchConfig): boolean {
  return normalizeMatchConfig(config).mode === '1v1'
}

export function isEngineSupportedMatch(config?: MatchConfig): boolean {
  const normalized = normalizeMatchConfig(config)
  return (
    normalized.mode === '1v1' || (normalized.mode === 'tag' && normalized.tagFormat === 'standard')
  )
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

const STANDARD_TAG_TURN_ORDER: Record<string, number> = {
  duelist_0_0: 1,
  duelist_1_1: 2,
  duelist_0_1: 3,
  duelist_1_0: 4
}

const STANDARD_TAG_SEAT: Record<string, 0 | 1 | 2 | 3> = {
  duelist_0_0: 0,
  duelist_1_0: 1,
  duelist_0_1: 2,
  duelist_1_1: 3
}

export function getStandardTagSeat(duelistId: string): 0 | 1 | 2 | 3 | undefined {
  return STANDARD_TAG_SEAT[duelistId]
}

export function applyStandardTagTurnOrder(duelists: Duelist[]): Duelist[] {
  return duelists.map((duelist) => {
    const turnOrder = STANDARD_TAG_TURN_ORDER[duelist.id] ?? duelist.turnOrder
    return {
      ...duelist,
      turnOrder,
      isFirst: turnOrder === 1
    }
  })
}

export function createStandardTagDuelists(): Duelist[] {
  return applyStandardTagTurnOrder(createDefaultDuelists(2, 2))
}

export function createInitialDuelState(
  masterRule: MasterRule = 5,
  duelType: DuelType = 'full'
): DuelPuzzleState {
  const matchConfig: MatchConfig = {
    mode: '1v1',
    team0Count: 1,
    team1Count: 1
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

export function normalizeDuelScenarios(
  scenarios: Record<string, DuelSceneSnapshot> | undefined
): Record<string, DuelSceneSnapshot> {
  if (!scenarios) return {}
  const normalized: Record<string, DuelSceneSnapshot> = {}
  for (const snapshot of Object.values(scenarios)) {
    const matchConfig = normalizeMatchConfig(snapshot.matchConfig)
    const key = getMatchScenarioKey(matchConfig)
    const next: DuelSceneSnapshot = {
      ...snapshot,
      matchConfig,
      steps: normalizeStepActors(snapshot.steps, snapshot.duelists.length)
    }
    if (isStandardTag(matchConfig)) {
      const teamLp = (team: 0 | 1): number =>
        snapshot.players?.[team]?.lp ??
        snapshot.duelists.find((duelist) => duelist.team === team)?.lp ??
        8000
      next.duelists = snapshot.duelists.map((duelist) => ({
        ...duelist,
        lp: teamLp(duelist.team)
      }))
    }
    if (!normalized[key]) normalized[key] = next
  }
  return normalized
}

function inferStepActionDuelistId(step: DuelStep): string | undefined {
  for (const op of step.manualOps ?? []) {
    if (op.type !== 'move' && op.type !== 'position' && op.type !== 'add') continue
    if (!op.instanceId) continue
    const card = step.boardAfter?.find((item) => item.instanceId === op.instanceId)
    if (card?.duelistId) return card.duelistId
  }
  if (step.instanceId) {
    const card = step.boardAfter?.find((item) => item.instanceId === step.instanceId)
    if (card?.duelistId) return card.duelistId
  }
  return undefined
}

function normalizeStepActors(
  steps: DuelStep[] | undefined,
  duelistCount: number
): DuelStep[] | undefined {
  if (!steps || duelistCount <= 2) return steps
  return steps.map((step) => {
    if (step.actionDuelistId) return step
    const actionDuelistId = inferStepActionDuelistId(step)
    return actionDuelistId ? { ...step, actionDuelistId } : step
  })
}

export function normalizeDuelState(state: DuelPuzzleState): DuelPuzzleState {
  const matchConfig = normalizeMatchConfig(state.matchConfig)

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

  if (isStandardTag(matchConfig) && duelists.length === 4) {
    duelists = applyStandardTagTurnOrder(duelists)
  }

  const team0Duelists = duelists.filter((d) => d.team === 0)
  const team1Duelists = duelists.filter((d) => d.team === 1)

  if (isStandardTag(matchConfig)) {
    duelists = duelists.map((duelist) => ({
      ...duelist,
      lp: state.players?.[duelist.team]?.lp ?? duelist.lp
    }))
  }

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
    scenarios: normalizeDuelScenarios(state.scenarios),
    cards: updatedCards,
    steps: normalizeStepActors(state.steps, duelists.length)
  }
}
