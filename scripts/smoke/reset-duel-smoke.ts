/**
 * 清空重置冒烟：重置后应回到编排起点（第 1 回合 · DP），
 * 清空卡片/步骤/预览状态与文件关联，并清掉撤销历史。
 */
import { CardLocation, CdbCard, DuelPhase, normalizeDuelState } from '@shared/index'
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
    title: '清空重置',
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
    state: base,
    currentProjectPath: null,
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null,
    duelStarted: false,
    currentTurn: 1,
    currentPhase: 'DP' as DuelPhase,
    currentChain: 0,
    activeTurnPlayer: 0 as 0 | 1,
    sceneEditing: false
  }))
  useDuelStore
    .getState()
    .addCardToZone(fakeCard(9000001), 0, CardLocation.HAND, 0, undefined, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(fakeCard(9000002), 0, CardLocation.GRAVE, 0, undefined, 'duelist_0_0')
  useDuelStore.getState().insertPhaseChange()
  useDuelStore.setState({
    currentProjectPath: 'D:/tmp/reset-duel.ygo',
    currentTurn: 3,
    currentPhase: 'M1' as DuelPhase,
    currentChain: 2,
    currentStepIndex: 0,
    selectedStepId: 'step_placeholder',
    duelStarted: true
  })
  useDuelStore.getState().clearUndoHistory()
}

function checkResetDuel(): void {
  const before = useDuelStore.getState()
  assert((before.state.steps?.length ?? 0) > 0, '重置前应有步骤')
  assert(before.currentPhase === 'M1', '重置前阶段应为 M1')

  before.resetDuel()
  const after = useDuelStore.getState()

  assert(after.currentTurn === 1, `重置后回合数应为 1，实际 ${after.currentTurn}`)
  assert(after.currentPhase === 'DP', `重置后阶段应为 DP，实际 ${after.currentPhase}`)
  assert(after.currentChain === 0, `重置后连锁应为 0，实际 ${after.currentChain}`)
  assert(after.currentStepIndex === null, '重置后步骤播放头应回到初始')
  assert(after.selectedStepId === null, '重置后不应保留选中的步骤')
  assert(after.previewReturn === null, '重置后不应保留步骤预览')
  assert(after.duelStarted === false, '重置后应回到未开始对局的状态')
  assert(after.currentProjectPath === null, '重置后应断开文件关联')
  assert((after.state.steps?.length ?? 0) === 0, '重置后步骤应清空')
  assert(after.state.cards.length === 0, `重置后卡片应清空，实际 ${after.state.cards.length} 张`)
  assert(useDuelStore.temporal.getState().pastStates.length === 0, '重置后撤销历史应清空')
  assert(after.state.matchConfig?.mode === '1v1', '重置后应保留对阵模式')
}

installGlobals()
setup()
checkResetDuel()
console.log('[reset-duel] ALL PASSED')
