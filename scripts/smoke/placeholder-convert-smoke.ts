import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  normalizeDuelState,
  Duelist,
  FieldCard,
  CardLocation,
  CardPosition,
  EngineCard,
  EngineCardRef,
  EngineRequest,
  PLACEHOLDER_CARD_CODE,
  PLACEHOLDER_MONSTER_CARD_CODE,
  PLACEHOLDER_SPELL_TRAP_CARD_CODE
} from '@shared/index'
import { cdbService } from './cdb-shim'
import { settleToIdle } from './settleToIdle'

let fieldId = 0

function makeCard(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number
): FieldCard {
  return {
    instanceId: `card-${++fieldId}`,
    code,
    controller,
    owner: controller,
    location,
    sequence,
    position,
    overlayMaterials: []
  }
}

function buildPuzzle(): ReturnType<typeof normalizeDuelState> {
  const p0Deck = [97997309, 23434538, 14558127, 70342110, 66518841]
  const p1Deck = [23434538, 14558127, 70342110, 66518841, 97997309]
  const cards: FieldCard[] = [
    ...p0Deck.map((code, i) =>
      makeCard(code, 0, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    ),
    ...p1Deck.map((code, i) =>
      makeCard(code, 1, CardLocation.DECK, i, CardPosition.FACEDOWN_DEFENSE)
    )
  ]
  const duelists: Duelist[] = [
    { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
    { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
  ]
  return normalizeDuelState({
    version: '1.2.0',
    title: '占位卡转换联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: true,
    cards,
    steps: [],
    duelists,
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
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

function idleOf(request: EngineRequest | null): Extract<EngineRequest['data'], { kind: 'idle' }> {
  if (request?.data.kind !== 'idle') throw new Error('当前请求不是 idle')
  return request.data
}

function fmt(cards: { code: number; location: number; sequence: number }[]): string {
  return cards.length === 0
    ? '（空）'
    : cards.map((c) => `${c.code}@loc${c.location}#${c.sequence}`).join(', ')
}

async function startWithPlaceholder(): Promise<EngineCard> {
  await duelSession.startDuel({ puzzleState: buildPuzzle() })
  await settleToIdle()
  await duelSession.inject({
    op: 'add-card',
    player: 0,
    code: PLACEHOLDER_CARD_CODE,
    to: 'hand'
  })
  await settleToIdle()
  const hand = duelSession.getBoardState().players[0].hand
  const card = hand.find((c) => c.code === PLACEHOLDER_CARD_CODE)
  assert(Boolean(card), '占位卡应进入手牌')
  assert(Boolean(card!.card), '占位卡应带编辑器显示数据')
  return card!
}

async function runMonsterConversion(): Promise<void> {
  console.log('\n=== 未定 -> 怪兽 ===')
  const card = await startWithPlaceholder()
  const before = idleOf(duelSession.getPendingRequest())
  assert(
    before.ssetable.some((c) => c.code === PLACEHOLDER_CARD_CODE),
    '未定占位卡应出现在魔陷盖放列表'
  )
  const res = await duelSession.replaceCard(refOf(card), PLACEHOLDER_MONSTER_CARD_CODE)
  assert(!res.error, `转换为怪兽占位失败: ${res.error ?? ''}`)
  const data = idleOf(res.pendingRequest)
  console.log('转换后 summonable:', fmt(data.summonable), 'msetable:', fmt(data.msetable))
  assert(
    data.summonable.some((c) => c.code === PLACEHOLDER_MONSTER_CARD_CODE),
    '怪兽占位应出现在可召唤列表'
  )
  assert(
    data.msetable.some((c) => c.code === PLACEHOLDER_MONSTER_CARD_CODE),
    '怪兽占位应出现在怪兽盖放列表'
  )
  assert(
    !data.ssetable.some((c) => c.code === PLACEHOLDER_MONSTER_CARD_CODE),
    '怪兽占位不应出现在魔陷盖放列表'
  )
  const target = data.summonable.find((c) => c.code === PLACEHOLDER_MONSTER_CARD_CODE)!
  let submit = duelSession.submitAnswer({ kind: 'idle', cmd: 'SUMMON', card: target })
  if (submit.pendingRequest?.data.kind === 'place') {
    const place = submit.pendingRequest.data
    submit = duelSession.submitAnswer({
      kind: 'place',
      places: place.places.slice(0, Math.max(1, place.count))
    })
  }
  const onField = submit.boardState.players[0].mzone.find(
    (c) => c?.code === PLACEHOLDER_MONSTER_CARD_CODE
  )
  assert(Boolean(onField), '怪兽占位应被召唤到怪兽区')
  console.log('召唤后怪兽区:', onField ? `pos${onField.position}` : '无')
  console.log('[placeholder-convert-smoke] 未定 -> 怪兽: OK')
}

async function runSpellTrapConversion(): Promise<void> {
  console.log('\n=== 未定 -> 魔陷 ===')
  const card = await startWithPlaceholder()
  const res = await duelSession.replaceCard(refOf(card), PLACEHOLDER_SPELL_TRAP_CARD_CODE)
  assert(!res.error, `转换为魔陷占位失败: ${res.error ?? ''}`)
  const data = idleOf(res.pendingRequest)
  console.log('转换后 ssetable:', fmt(data.ssetable))
  assert(
    data.ssetable.some((c) => c.code === PLACEHOLDER_SPELL_TRAP_CARD_CODE),
    '魔陷占位应出现在魔陷盖放列表'
  )
  assert(
    !data.summonable.some((c) => c.code === PLACEHOLDER_SPELL_TRAP_CARD_CODE),
    '魔陷占位不应出现在可召唤列表'
  )
  const target = data.ssetable.find((c) => c.code === PLACEHOLDER_SPELL_TRAP_CARD_CODE)!
  let submit = duelSession.submitAnswer({ kind: 'idle', cmd: 'SSET', card: target })
  if (submit.pendingRequest?.data.kind === 'place') {
    const place = submit.pendingRequest.data
    submit = duelSession.submitAnswer({
      kind: 'place',
      places: place.places.slice(0, Math.max(1, place.count))
    })
  }
  const onField = submit.boardState.players[0].szone.find(
    (c) => c?.code === PLACEHOLDER_SPELL_TRAP_CARD_CODE
  )
  assert(Boolean(onField), '魔陷占位应被盖放到魔陷区')
  console.log('盖放后魔陷区:', onField ? `pos${onField.position}` : '无')
  console.log('[placeholder-convert-smoke] 未定 -> 魔陷: OK')
}

async function main(): Promise<void> {
  await cdbService.ready()
  await runMonsterConversion()
  await runSpellTrapConversion()
  console.log('\n[placeholder-convert-smoke] ALL CHECKS PASSED')
  process.exit(0)
}

main().catch((err) => {
  console.error('[placeholder-convert-smoke] FAILED', err)
  process.exit(1)
})
