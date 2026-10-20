import assert from 'assert'
import {
  CardLocation,
  CardPosition,
  DuelStep,
  LightweightCardSnapshot,
  defaultPositionForLocation,
  replayManualSteps,
  resolveTargetPosition
} from '@shared/index'

function runEditorBattleSmoke(): void {
  console.log('[editor-battle-smoke] 开始验证编排模式战斗阶段与位置推断逻辑...')

  // 1. 验证默认表示形式
  assert.strictEqual(
    defaultPositionForLocation(CardLocation.MZONE),
    CardPosition.FACEUP_ATTACK,
    '怪兽区默认应为表侧攻击表示'
  )
  assert.strictEqual(
    defaultPositionForLocation(CardLocation.SZONE),
    CardPosition.FACEDOWN,
    '魔陷区默认应为里侧盖放'
  )
  assert.strictEqual(
    defaultPositionForLocation(CardLocation.HAND),
    CardPosition.FACEDOWN,
    '手牌默认应为里侧'
  )
  assert.strictEqual(
    defaultPositionForLocation(CardLocation.GRAVE),
    CardPosition.FACEUP,
    '墓地默认应为表侧'
  )

  // 2. 验证目标位置推导
  assert.strictEqual(
    resolveTargetPosition(CardLocation.MZONE, undefined, CardLocation.HAND, CardPosition.FACEDOWN),
    CardPosition.FACEUP_ATTACK,
    '从手牌移到怪兽区，未指定 customPos 时应自动转为表侧攻击'
  )
  assert.strictEqual(
    resolveTargetPosition(CardLocation.MZONE, CardPosition.FACEDOWN_DEFENSE, CardLocation.HAND, CardPosition.FACEDOWN),
    CardPosition.FACEDOWN_DEFENSE,
    '若显式指定 customPos 为里侧守备，则应尊重显式值'
  )
  assert.strictEqual(
    resolveTargetPosition(CardLocation.MZONE, undefined, CardLocation.MZONE, CardPosition.FACEUP_DEFENSE),
    CardPosition.FACEUP_DEFENSE,
    '怪兽区内部移动，未指定 customPos 时应保持原表示形式'
  )

  // 3. 验证 replayManualSteps 回放：从手牌移到怪兽区后再攻击，不能变成盖放
  const initial: LightweightCardSnapshot[] = [
    {
      instanceId: 'cyber_dragon',
      code: 70095154,
      controller: 0,
      owner: 0,
      location: CardLocation.HAND,
      sequence: 0,
      position: CardPosition.FACEDOWN,
      overlayMaterials: []
    }
  ]

  const steps: DuelStep[] = [
    {
      id: 'step_summon',
      turn: 1,
      turnPlayer: 0,
      phase: 'M1',
      actionPlayer: 0,
      actionType: 'PLACE',
      instanceId: 'cyber_dragon',
      description: '将【电子龙】放置到怪兽区',
      manualOps: [
        {
          type: 'move',
          instanceId: 'cyber_dragon',
          toLocation: CardLocation.MZONE,
          toSequence: 0
        }
      ]
    },
    {
      id: 'step_attack',
      turn: 1,
      turnPlayer: 0,
      phase: 'BP',
      actionPlayer: 0,
      actionType: 'ATTACK',
      instanceId: 'cyber_dragon',
      description: '【电子龙】直接攻击'
    }
  ]

  const { steps: derivedSteps } = replayManualSteps(initial, steps, [8000, 8000], 0, 'DP')

  assert.strictEqual(derivedSteps.length, 2)

  const summonCard = derivedSteps[0].boardAfter?.find((c) => c.instanceId === 'cyber_dragon')
  assert(summonCard, '移动后卡片应存在于 boardAfter 中')
  assert.strictEqual(summonCard.location, CardLocation.MZONE, '卡片应在怪兽区')
  assert.strictEqual(
    summonCard.position,
    CardPosition.FACEUP_ATTACK,
    '从手牌移到怪兽区后，回放状态必须是表侧攻击表示，不能是 FACEDOWN'
  )

  const attackCard = derivedSteps[1].boardAfter?.find((c) => c.instanceId === 'cyber_dragon')
  assert(attackCard, '攻击后卡片应存在于 boardAfter 中')
  assert.strictEqual(attackCard.location, CardLocation.MZONE, '卡片依然在怪兽区')
  assert.strictEqual(
    attackCard.position,
    CardPosition.FACEUP_ATTACK,
    '攻击后卡片必须保持表侧攻击表示，绝对不能变成盖放 (FACEDOWN)'
  )

  // 4. 验证直接添加怪兽到怪兽区未指定 position 时的行为
  const addSteps: DuelStep[] = [
    {
      id: 'step_add',
      turn: 1,
      turnPlayer: 0,
      phase: 'M1',
      actionPlayer: 0,
      actionType: 'PLACE',
      instanceId: 'blue_eyes',
      description: '放置青眼白龙',
      manualOps: [
        {
          type: 'add',
          instanceId: 'blue_eyes',
          code: 89631139,
          controller: 0,
          location: CardLocation.MZONE,
          sequence: 1
        }
      ]
    }
  ]
  const { steps: derivedAdd } = replayManualSteps([], addSteps, [8000, 8000], 0, 'DP')
  const addedCard = derivedAdd[0].boardAfter?.find((c) => c.instanceId === 'blue_eyes')
  assert(addedCard, '添加的卡片应存在')
  assert.strictEqual(
    addedCard.position,
    CardPosition.FACEUP_ATTACK,
    '添加怪兽到怪兽区时未指定 position，默认必须是表侧攻击表示'
  )

  console.log('[editor-battle-smoke] 验证全部通过！')
}

runEditorBattleSmoke()
