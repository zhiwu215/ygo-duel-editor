/**
 * 撤销粒度冒烟：验证「一次用户操作 = 一条撤销记录」。
 * 1. 点击「开始 → 抽 5 张」抽满起手后，一次撤销应把手牌、抽卡步骤、duelStarted 全部还原
 * 2. 点击「开始 → 不抽牌」不抽牌，只开始对局，一次撤销应只还原 duelStarted
 * 3. 单张移动（含步骤记录）一次撤销即可还原
 */
import { CardLocation, CardPosition, CdbCard, DuelPhase, normalizeDuelState } from '@shared/index'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function fakeCard(id: number): CdbCard {
  return {
    id,
    name: `Card ${id}`,
    type: 1,
    atk: 1000,
    def: 1000,
    level: 4,
    race: 0,
    attribute: 0,
    ot: 0,
    alias: 0,
    setcode: 0,
    category: 0
  } as unknown as CdbCard
}

function installGlobals(): void {
  ;(globalThis as unknown as { window: unknown }).window = { api: {} }
  ;(globalThis as unknown as { document: unknown }).document = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }
}

function setup(): void {
  const base = normalizeDuelState({
    version: '1.2.0',
    title: '撤销粒度',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
  useDuelStore.setState((prev) => ({
    ...prev,
    state: { ...base, initialBoardSnapshot: [] },
    currentStepIndex: null,
    selectedStepId: null,
    duelStarted: false,
    currentTurn: 1,
    currentPhase: 'DP' as DuelPhase
  }))
  for (const team of [0, 1] as const) {
    const duelistId = `duelist_${team}_0`
    for (let i = 0; i < 10; i++) {
      useDuelStore
        .getState()
        .addCardToZone(
          fakeCard(1000000 + team * 100 + i),
          team,
          CardLocation.DECK,
          i,
          CardPosition.FACEDOWN,
          duelistId
        )
    }
  }
  useDuelStore.getState().clearUndoHistory()
}

function countAt(location: number): number {
  return useDuelStore.getState().state.cards.filter((c) => c.location === location).length
}

function undoCount(): number {
  return useDuelStore.temporal.getState().pastStates.length
}

function stepCount(): number {
  return useDuelStore.getState().state.steps?.length ?? 0
}

function checkOpeningDrawUndo(): void {
  useDuelStore.getState().startDuel(true)
  assert(
    countAt(CardLocation.HAND) === 10,
    `开局后手牌应为 10 张，实际 ${countAt(CardLocation.HAND)}`
  )
  assert(stepCount() === 10, `开局后应有 10 条抽卡步骤，实际 ${stepCount()} 条`)
  assert(useDuelStore.getState().duelStarted, '开局后 duelStarted 应为 true')
  assert(undoCount() === 1, `开局应只产生 1 条撤销记录，实际 ${undoCount()} 条`)

  useDuelStore.temporal.getState().undo()
  assert(
    countAt(CardLocation.HAND) === 0,
    `撤销后手牌应为 0 张，实际 ${countAt(CardLocation.HAND)} 张`
  )
  assert(
    countAt(CardLocation.DECK) === 20,
    `撤销后卡组应回到 20 张，实际 ${countAt(CardLocation.DECK)} 张`
  )
  assert(stepCount() === 0, `撤销后抽卡步骤应清空，实际 ${stepCount()} 条`)
  assert(!useDuelStore.getState().duelStarted, '撤销后 duelStarted 应回到 false')

  useDuelStore.temporal.getState().redo()
  assert(
    countAt(CardLocation.HAND) === 10,
    `重做后手牌应为 10 张，实际 ${countAt(CardLocation.HAND)} 张`
  )
  assert(stepCount() === 10, `重做后抽卡步骤应恢复，实际 ${stepCount()} 条`)
  assert(useDuelStore.getState().duelStarted, '重做后 duelStarted 应回到 true')
  useDuelStore.temporal.getState().undo()
}

function checkSkipOpeningDrawUndo(): void {
  useDuelStore.getState().startDuel(false)
  assert(
    countAt(CardLocation.HAND) === 0,
    `不抽牌开局后手牌应保持 0 张，实际 ${countAt(CardLocation.HAND)} 张`
  )
  assert(stepCount() === 0, `不抽牌开局不应产生步骤，实际 ${stepCount()} 条`)
  assert(useDuelStore.getState().duelStarted, '不抽牌开局后 duelStarted 应为 true')
  assert(undoCount() === 1, `不抽牌开局应只产生 1 条撤销记录，实际 ${undoCount()} 条`)

  useDuelStore.temporal.getState().undo()
  assert(!useDuelStore.getState().duelStarted, '撤销后 duelStarted 应回到 false')
  assert(countAt(CardLocation.HAND) === 0, '撤销后手牌应保持 0 张')
  assert(stepCount() === 0, '撤销后不应产生步骤')
}

function checkSingleMoveUndo(): void {
  const top = useDuelStore
    .getState()
    .state.cards.filter((c) => c.location === CardLocation.DECK && c.controller === 0)
    .sort((a, b) => a.sequence - b.sequence)[0]
  assert(Boolean(top), '卡组中应存在可移动的卡')
  useDuelStore.getState().moveCard(top.instanceId, CardLocation.HAND, 0)
  assert(
    countAt(CardLocation.HAND) === 1,
    `移动后手牌应为 1 张，实际 ${countAt(CardLocation.HAND)} 张`
  )
  assert(stepCount() === 1, `移动后应有 1 条步骤，实际 ${stepCount()} 条`)
  assert(undoCount() === 1, `单张移动应只产生 1 条撤销记录，实际 ${undoCount()} 条`)

  useDuelStore.temporal.getState().undo()
  assert(
    countAt(CardLocation.HAND) === 0,
    `撤销后手牌应为 0 张，实际 ${countAt(CardLocation.HAND)} 张`
  )
  assert(stepCount() === 0, `撤销后步骤应清空，实际 ${stepCount()} 条`)
}

installGlobals()
setup()
checkOpeningDrawUndo()
checkSkipOpeningDrawUndo()
checkSingleMoveUndo()
console.log('[undo] ALL PASSED')
