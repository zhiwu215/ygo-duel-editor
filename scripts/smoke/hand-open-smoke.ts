/**
 * 手牌公开冒烟：编辑模式不再手动切换手牌公开，也不再生成「变更表示形式」步骤；
 * 公开状态只由引擎/导入步骤带来的 position 决定。场上表示形式变更仍记录 CHANGE_POS。
 */
import { CardLocation, CardPosition, CdbCard, DuelPhase, normalizeDuelState } from '@shared/index'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { getDropPosOverride } from '../../src/renderer/src/utils/zoneDrop'

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
    title: '手牌公开',
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
    currentStepIndex: null,
    selectedStepId: null,
    previewReturn: null,
    duelStarted: true,
    currentTurn: 1,
    currentPhase: 'DP' as DuelPhase,
    currentChain: 0,
    activeTurnPlayer: 0 as 0 | 1,
    sceneEditing: false
  }))
  useDuelStore
    .getState()
    .addCardToZone(fakeCard(9200001), 0, CardLocation.HAND, 0, undefined, 'duelist_0_0')
  useDuelStore
    .getState()
    .addCardToZone(
      fakeCard(9200002),
      0,
      CardLocation.MZONE,
      0,
      CardPosition.FACEUP_ATTACK,
      'duelist_0_0'
    )
  useDuelStore.getState().clearUndoHistory()
}

function cardOf(code: number): { instanceId: string; position: number } {
  const card = useDuelStore.getState().state.cards.find((item) => item.code === code)
  if (!card) throw new Error(`断言失败: 找不到测试卡 ${code}`)
  return card
}

function checkHandPublic(): void {
  const hand = cardOf(9200001)
  useDuelStore.getState().updateCardPosition(hand.instanceId, CardPosition.FACEUP)
  assert(cardOf(9200001).position === CardPosition.FACEUP, '手牌公开状态应能由 position 表示')
  assert(
    (useDuelStore.getState().state.steps || []).length === 0,
    '手动改手牌公开状态不应生成任何步骤'
  )

  useDuelStore.getState().updateCardPosition(hand.instanceId, CardPosition.FACEDOWN)
  assert(cardOf(9200001).position === CardPosition.FACEDOWN, '手牌应能回到里侧')
  assert((useDuelStore.getState().state.steps || []).length === 0, '手牌收回公开同样不应生成步骤')
}

function checkDropOverride(): void {
  assert(getDropPosOverride(CardLocation.HAND, true) === undefined, '拖放不再用 Ctrl 手动手牌公开')
}

function checkFieldPosition(): void {
  const monster = cardOf(9200002)
  useDuelStore.getState().updateCardPosition(monster.instanceId, CardPosition.FACEUP_DEFENSE)
  const steps = useDuelStore.getState().state.steps || []
  const changePos = steps.filter((step) => step.actionType === 'CHANGE_POS')
  assert(changePos.length === 1, `场上表示形式变更应记录 CHANGE_POS，实际 ${changePos.length} 条`)
  assert(changePos[0].fromPosition === CardPosition.FACEUP_ATTACK, '变更表示形式应记录原表示')
}

installGlobals()
setup()
checkHandPublic()
checkDropOverride()
checkFieldPosition()
console.log('[hand-open] ALL PASSED')
