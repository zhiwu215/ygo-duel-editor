/**
 * 布景冒烟：验证首个操作前场面的记录与还原。
 * 1. 首个动作步骤记录时保存操作前盘面与 LP
 * 2. 布景优先按首个步骤反推，不依赖可能过期的初始快照
 * 3. 进入布景模式还原手牌、怪兽区、回合阶段与当前步骤指针
 * 4. 仅查看布景保留步骤；修改布景后完成会清空步骤，作为新起点
 */
import { CardLocation, CardPosition, CdbCard, DuelPhase, normalizeDuelState } from '@shared/index'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { resolveOpeningScene, SCENE_STEP_INDEX } from '../../src/renderer/src/utils/openingScene'

function assert(condition: boolean, message: string): asserts condition {
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
    title: '布景',
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
    state: { ...base, initialBoardSnapshot: undefined, initialLp: undefined },
    currentStepIndex: null,
    selectedStepId: null,
    duelStarted: false,
    currentTurn: 1,
    currentPhase: 'DP' as DuelPhase
  }))
  for (let i = 0; i < 4; i++) {
    useDuelStore
      .getState()
      .addCardToZone(
        fakeCard(1000000 + i),
        0,
        CardLocation.HAND,
        i,
        CardPosition.FACEDOWN,
        'duelist_0_0'
      )
  }
  for (let i = 0; i < 10; i++) {
    useDuelStore
      .getState()
      .addCardToZone(
        fakeCard(2000000 + i),
        0,
        CardLocation.DECK,
        i,
        CardPosition.FACEDOWN_DEFENSE,
        'duelist_0_0'
      )
  }
  useDuelStore.getState().clearUndoHistory()
}

function countAt(location: number): number {
  return useDuelStore.getState().state.cards.filter((c) => c.location === location).length
}

function markerFirstScene(): void {
  setup()
  useDuelStore.getState().insertPhaseChange()
  const handCard = useDuelStore
    .getState()
    .state.cards.find((c) => c.location === CardLocation.HAND)!
  useDuelStore.getState().moveCard(handCard.instanceId, CardLocation.MZONE, 0)
  assert(useDuelStore.getState().state.steps?.length === 2, '阶段推进 + 召唤应记录 2 条步骤')
  assert(useDuelStore.getState().enterSceneMode(), '首条步骤是阶段推进时仍应能进入布景')
  assert(countAt(CardLocation.HAND) === 4, '布景应还原阶段推进前的 4 张手牌')
  assert(countAt(CardLocation.MZONE) === 0, '布景应清空召唤出的怪兽')
  console.log('[scene] 阶段推进在前的布景通过')
}

function sceneModeTest(): void {
  setup()
  assert(useDuelStore.getState().enterSceneMode(), '无步骤时应能进入布景')
  const first = useDuelStore.getState().state.cards.find((c) => c.location === CardLocation.HAND)!
  useDuelStore.getState().moveCard(first.instanceId, CardLocation.MZONE, 0)
  assert(useDuelStore.getState().sceneEditing, '布景编辑中标记应保持')
  assert(useDuelStore.getState().state.steps?.length === 0, '布景中移动卡片不应记录步骤')

  assert(useDuelStore.getState().exitSceneMode(), '完成布景应成功')
  const afterExit = useDuelStore.getState()
  assert(!afterExit.sceneEditing, '完成布景后应退出布景编辑')
  assert(afterExit.currentStepIndex === SCENE_STEP_INDEX, '完成布景后应停在布景')
  assert(
    afterExit.state.initialBoardSnapshot?.filter((c) => c.location === CardLocation.MZONE)
      .length === 1,
    '完成布景应保存当前摆放'
  )
  assert(afterExit.state.steps?.length === 0, '完成布景不应凭空产生步骤')

  const second = afterExit.state.cards.find((c) => c.location === CardLocation.HAND)!
  useDuelStore.getState().moveCard(second.instanceId, CardLocation.MZONE, 1)
  assert(useDuelStore.getState().state.steps?.length === 1, '退出布景后操作应正常记录步骤')
  assert(useDuelStore.getState().currentStepIndex === 0, '第一条步骤应成为当前步骤')

  assert(useDuelStore.getState().enterSceneMode(), '有步骤后应能再次进入布景')
  assert(!useDuelStore.getState().isSceneDirty(), '刚进入布景不应视为已修改')
  const third = useDuelStore.getState().state.cards.find((c) => c.location === CardLocation.HAND)!
  useDuelStore.getState().moveCard(third.instanceId, CardLocation.MZONE, 2)
  assert(useDuelStore.getState().state.steps?.length === 1, '再次布置布景也不应记录步骤')
  assert(useDuelStore.getState().isSceneDirty(), '移动卡片后布景应标记为已修改')
  assert(useDuelStore.getState().exitSceneMode(), '再次完成布景应成功')
  const afterSecond = useDuelStore.getState()
  assert(!useDuelStore.getState().isSceneDirty(), '完成布景后不应保留修改标记')
  assert(
    afterSecond.state.initialBoardSnapshot?.filter((c) => c.location === CardLocation.MZONE)
      .length === 2,
    '再次完成布景应保存新的摆放'
  )
  assert(afterSecond.state.steps?.length === 0, '修改布景后完成应清空原有步骤，作为新的起点')
  assert(afterSecond.selectedStepId === null, '修改布景后应清空步骤选中状态')
  assert(afterSecond.currentStepIndex === SCENE_STEP_INDEX, '再次完成布景后应停在布景')
  console.log('[scene] 布景编辑模式通过')
}

function main(): void {
  installGlobals()
  setup()

  const handCard = useDuelStore
    .getState()
    .state.cards.find((c) => c.location === CardLocation.HAND)!
  useDuelStore.getState().moveCard(handCard.instanceId, CardLocation.MZONE, 0)

  const afterStep = useDuelStore.getState()
  assert(afterStep.state.steps?.length === 1, '首次召唤应记录 1 条步骤')
  assert(afterStep.currentStepIndex === 0, '首个步骤应成为当前步骤')
  assert(countAt(CardLocation.MZONE) === 1, '召唤后场上应有 1 张怪兽')
  assert(
    afterStep.state.initialBoardSnapshot?.filter((c) => c.location === CardLocation.HAND).length ===
      4,
    '布景快照应保留召唤前的 4 张手牌'
  )
  assert(
    afterStep.state.initialBoardSnapshot?.filter((c) => c.location === CardLocation.MZONE)
      .length === 0,
    '布景快照不应包含召唤后的怪兽'
  )
  assert(afterStep.state.initialLp?.[0] === 8000, '布景应记录初始 LP')

  useDuelStore.setState((prev) => ({
    ...prev,
    state: {
      ...prev.state,
      initialBoardSnapshot: [
        {
          instanceId: 'stale',
          code: 1,
          controller: 0,
          location: CardLocation.HAND,
          sequence: 0,
          position: CardPosition.FACEDOWN,
          overlayMaterials: []
        }
      ]
    }
  }))
  const scene = resolveOpeningScene(useDuelStore.getState().state)
  assert(scene !== null, '应能按首个步骤反推出布景')
  assert(
    scene.cards.filter((c) => c.location === CardLocation.HAND).length === 4,
    '布景应以首个步骤反推结果为准'
  )
  assert(scene.turn === 1 && scene.phase === 'DP', '布景应还原到首个步骤所在回合与阶段')

  assert(useDuelStore.getState().enterSceneMode(), '进入布景应成功')
  assert(!useDuelStore.getState().isSceneDirty(), '仅查看布景不应视为已修改')
  const preview = useDuelStore.getState()
  assert(preview.sceneEditing, '进入布景后应处于布景编辑')
  assert(preview.currentStepIndex === SCENE_STEP_INDEX, '布景下当前步骤指针应为布景')
  assert(countAt(CardLocation.HAND) === 4, '布景应把手牌还原为 4 张')
  assert(countAt(CardLocation.MZONE) === 0, '布景应清空召唤出的怪兽')
  assert(preview.currentTurn === 1 && preview.currentPhase === 'DP', '布景应还原回合与阶段')
  assert(preview.state.steps?.length === 1, '查看布景不应删除步骤')
  assert(useDuelStore.getState().exitSceneMode(), '完成布景应成功')
  const afterScene = useDuelStore.getState()
  assert(!afterScene.sceneEditing, '完成布景后应退出布景编辑')
  assert(afterScene.state.steps?.length === 1, '仅查看布景不应清空原有步骤')
  assert(afterScene.currentStepIndex === SCENE_STEP_INDEX, '完成布景后应停在布景')

  const nextHandCard = afterScene.state.cards.find(
    (c) => c.location === CardLocation.HAND && c.instanceId !== handCard.instanceId
  )!
  useDuelStore.getState().moveCard(nextHandCard.instanceId, CardLocation.MZONE, 1)
  const branched = useDuelStore.getState()
  assert(branched.state.steps?.length === 2, '从布景继续编排应新增 1 条步骤')
  assert(branched.currentStepIndex === 0, '从布景新增的步骤应排在首位')
  assert(
    branched.state.steps?.[0].cardCode === nextHandCard.code,
    '从布景新增的步骤应作为第一个操作'
  )

  markerFirstScene()
  sceneModeTest()

  console.log('[scene] ALL PASSED')
}

main()
