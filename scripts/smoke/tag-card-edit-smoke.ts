import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  normalizeDuelState,
  createStandardTagDuelists,
  FieldCard,
  CardLocation,
  CardPosition,
  EngineBoardState,
  EngineCard,
  EngineCardRef
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { settleToIdle } from './settleToIdle'

const PRIMARY_HAND: Record<string, number> = {
  duelist_0_0: 38517737,
  duelist_0_1: 53129443,
  duelist_1_0: 46986414,
  duelist_1_1: 70781052
}
const HAND_FILLERS = [12580477, 23434538, 14558127, 70342110]
const DECK_CODES = [
  66518841, 97997309, 89631139, 38517737, 53129443, 46986414, 70781052, 12580477, 23434538, 14558127
]

let fieldId = 0

function makeCard(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number,
  duelistId?: string
): FieldCard {
  return {
    instanceId: `tag-card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    duelistId,
    overlayMaterials: []
  }
}

function buildTagPuzzle(): ReturnType<typeof normalizeDuelState> {
  const duelists = createStandardTagDuelists()
  const cards: FieldCard[] = []

  for (const duelist of duelists) {
    const handCodes = [PRIMARY_HAND[duelist.id], ...HAND_FILLERS]
    handCodes.forEach((code, index) => {
      cards.push(
        makeCard(code, duelist.team, CardLocation.HAND, index, CardPosition.FACEDOWN, duelist.id)
      )
    })
    DECK_CODES.forEach((code, index) => {
      cards.push(
        makeCard(
          code,
          duelist.team,
          CardLocation.DECK,
          index,
          CardPosition.FACEDOWN_DEFENSE,
          duelist.id
        )
      )
    })
  }

  cards.push(
    makeCard(38517737, 0, CardLocation.MZONE, 0, CardPosition.FACEUP_ATTACK),
    makeCard(89631139, 0, CardLocation.GRAVE, 0, CardPosition.FACEUP_ATTACK)
  )

  return normalizeDuelState({
    version: '1.2.0',
    title: '标准 2v2 卡片编辑联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 5, startHand: 5 },
      { lp: 8000, maxHand: 5, startHand: 5 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards,
    steps: [],
    duelists,
    matchConfig: {
      mode: 'tag',
      team0Count: 2,
      team1Count: 2,
      tagFormat: 'standard',
      sharedLp: true
    },
    scenarios: {}
  })
}

function refOf(card: EngineCard): EngineCardRef {
  return {
    controller: card.controller,
    location: card.location,
    sequence: card.sequence,
    instanceId: card.instanceId,
    duelistId: card.duelistId
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function findMainHand(board: EngineBoardState): EngineCard | undefined {
  return board.players[0].hand.find(
    (card) => card.duelistId === 'duelist_0_0' && card.code === PRIMARY_HAND.duelist_0_0
  )
}

async function main(): Promise<void> {
  await cdbService.ready()
  const start = await duelSession.startDuel({
    puzzleState: buildTagPuzzle(),
    seed: [1234, 2345, 3456, 4567, 5678, 6789, 7890, 8901]
  })
  assert(start.boardState.tag === true, '标准 2v2 应标记 tag')
  assert(start.boardState.duelists?.length === 4, '标准 2v2 应有 4 名决斗者')
  await settleToIdle(80)

  const initial = duelSession.getBoardState()
  assert(initial.players[0].hand.length >= 5, '主位应有初始手牌')
  const mainHand = findMainHand(initial)
  assert(Boolean(mainHand), '主位手牌应有 primary 卡')
  const mainProvenance = duelSession.getProvenance(refOf(mainHand!))
  assert(mainProvenance.kind === 'initial', '主位手牌来源为 initial')
  assert(
    mainProvenance.kind === 'initial' && mainProvenance.duelistId === 'duelist_0_0',
    '主位来源包含正确 duelistId'
  )
  console.log('[tag-card-edit-smoke] 主位手牌来源: OK')

  const opponentHand = initial.players[1].hand.find(
    (card) => card.duelistId === 'duelist_1_0' && card.code === PRIMARY_HAND.duelist_1_0
  )
  assert(Boolean(opponentHand), '对方主位手牌应有 primary 卡')
  const opponentProvenance = duelSession.getProvenance(refOf(opponentHand!))
  assert(opponentProvenance.kind === 'initial', '对方主位手牌来源为 initial')
  assert(
    opponentProvenance.kind === 'initial' && opponentProvenance.duelistId === 'duelist_1_0',
    '对方主位来源包含正确 duelistId'
  )
  console.log('[tag-card-edit-smoke] 对方主位手牌来源: OK')

  const partnerHand = initial.players[0].hand.find((card) => card.duelistId === 'duelist_0_1')
  if (partnerHand) {
    const partnerProvenance = duelSession.getProvenance(refOf(partnerHand))
    assert(partnerProvenance.kind === 'initial', '队友可见手牌来源为 initial')
    assert(
      partnerProvenance.kind === 'initial' && partnerProvenance.duelistId === 'duelist_0_1',
      '队友来源包含正确 duelistId'
    )
    console.log('[tag-card-edit-smoke] 队友可见手牌来源: OK')
  } else {
    console.log('[tag-card-edit-smoke] 队友手牌不在当前盘面，跳过（范围 A）')
  }

  const fieldCard = initial.players[0].mzone[0]
  assert(Boolean(fieldCard), '共享场上卡存在')
  const fieldProvenance = duelSession.getProvenance(refOf(fieldCard!))
  assert(fieldProvenance.kind === 'initial', '共享场上卡来源为 initial')
  const fieldReplace = await duelSession.replaceCard(refOf(fieldCard!), 46986414)
  assert(!fieldReplace.error, `共享场上卡替换失败: ${fieldReplace.error ?? ''}`)
  assert(
    fieldReplace.boardState!.players[0].mzone[0]?.code === 46986414,
    '共享场上卡替换后新卡出现'
  )
  console.log('[tag-card-edit-smoke] 共享场上卡替换: OK')

  const handReplace = await duelSession.replaceCard(refOf(mainHand!), 89631139)
  assert(!handReplace.error, `主位手牌替换失败: ${handReplace.error ?? ''}`)
  const replacedHand = handReplace.boardState!.players[0].hand.find(
    (card) => card.duelistId === 'duelist_0_0' && card.code === 89631139
  )
  assert(Boolean(replacedHand), '主位手牌替换后新卡出现')
  const replacedProvenance = duelSession.getProvenance(refOf(replacedHand!))
  assert(replacedProvenance.kind === 'initial', '替换后主位手牌来源仍为 initial')
  console.log('[tag-card-edit-smoke] 主位手牌替换: OK')

  const graveCard = initial.players[0].graveyard.find((card) => card.code === 89631139)
  assert(Boolean(graveCard), '共享墓地卡存在')
  const graveProvenance = duelSession.getProvenance(refOf(graveCard!))
  assert(graveProvenance.kind === 'initial', '共享墓地卡来源为 initial')
  const graveRemove = await duelSession.removeCard(refOf(graveCard!))
  assert(!graveRemove.error, `共享墓地卡移除失败: ${graveRemove.error ?? ''}`)
  assert(
    !graveRemove.boardState!.players[0].graveyard.some(
      (card) => card.instanceId === graveCard!.instanceId
    ),
    '共享墓地卡移除后消失'
  )
  console.log('[tag-card-edit-smoke] 共享墓地卡移除: OK')

  const beforeRoundTrip = duelSession.getBoardState()
  const roundTrip = await duelSession.importSessionDoc(duelSession.exportSessionDoc())
  assert(
    roundTrip.boardState.players[0].hand.length === beforeRoundTrip.players[0].hand.length,
    '标准 2v2 编辑后会话导出/导入手牌数一致'
  )
  console.log('[tag-card-edit-smoke] 编辑后会话导出/导入: OK')
  console.log('[tag-card-edit-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[tag-card-edit-smoke] FAILED:', err)
  process.exit(1)
})
