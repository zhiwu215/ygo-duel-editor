import {
  CardLocation,
  CardPosition,
  createStandardTagDuelists,
  decodeSessionOp
} from '@shared/index'
import type {
  Answer,
  DuelPuzzleState,
  EngineDuelInitParams,
  EngineRequest,
  FieldCard
} from '@shared/index'
import { buildTagReplayData } from '../../src/main/services/duel/tagReplayDecks'
import { duelSession } from '../../src/main/services/duel/duel-session'
import {
  buildReplayTimeline,
  parseYrpReplay,
  setupReplayDuel
} from '../../src/main/services/duel/replay-session'
import { createSessionState } from '../../src/main/services/duel/session-state'
import { buildDuelFlag, buildYrpTagFile } from '../../src/main/services/yrpWriter'
import { buildPuzzleStateFromEngineBoard } from '../../src/renderer/src/utils/engineBoardToPuzzle'
import { buildReplayMatchState } from '../../src/renderer/src/utils/replayMatch'
import { cdbService } from './cdb-shim'
import { getOcgcoreEngine } from './ocgcore-engine-shim'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function buildTagPuzzle(): DuelPuzzleState {
  const duelists = createStandardTagDuelists()
  const cards: FieldCard[] = []
  let instance = 0
  const add = (
    duelistId: string,
    controller: 0 | 1,
    location: number,
    sequence: number,
    code: number,
    position: number
  ): void => {
    cards.push({
      instanceId: `tag-smoke-${++instance}`,
      code,
      controller,
      owner: controller,
      location,
      sequence,
      position,
      overlayMaterials: [],
      duelistId
    })
  }

  for (const duelist of duelists) {
    for (let i = 0; i < 5; i++) {
      add(duelist.id, duelist.team, CardLocation.HAND, i, 89631139, CardPosition.FACEDOWN)
    }
    for (let i = 0; i < 12; i++) {
      add(
        duelist.id,
        duelist.team,
        CardLocation.DECK,
        i,
        i % 2 === 0 ? 89631139 : 46986414,
        CardPosition.FACEDOWN_DEFENSE
      )
    }
    for (let i = 0; i < 3; i++) {
      add(
        duelist.id,
        duelist.team,
        CardLocation.EXTRA,
        i,
        i % 2 === 0 ? 46986414 : 74677422,
        CardPosition.FACEDOWN_DEFENSE
      )
    }
  }

  return {
    version: '1.2.0',
    title: '2v2 回放冒烟',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 5, startHand: 5 },
      { lp: 8000, maxHand: 5, startHand: 5 }
    ],
    turnPlayer: 0,
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
    }
  }
}

function autoAnswer(request: EngineRequest): Answer {
  const d = request.data
  switch (d.kind) {
    case 'rps':
      return { kind: 'rps', hand: 'paper' }
    case 'idle':
      return { kind: 'idle', cmd: d.canEp ? 'TO_EP' : d.canBp ? 'TO_BP' : 'TO_EP' }
    case 'battle':
      return { kind: 'battle', cmd: 'TO_EP' }
    case 'yesno':
      return { kind: 'yesno', yes: false }
    case 'chain':
      return { kind: 'chain', card: null }
    case 'card':
      return d.cancelable
        ? { kind: 'card', cards: null }
        : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'tribute':
      return d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    case 'place':
      return { kind: 'place', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'disfield':
      return { kind: 'disfield', places: d.places.slice(0, Math.max(1, d.count)) }
    case 'position':
      return { kind: 'position', position: d.positions[0] }
    case 'option':
      return { kind: 'option', index: 0 }
    case 'sort':
      return { kind: 'sort', cards: null }
    case 'unselect':
      return d.finishable
        ? { kind: 'unselect', card: null }
        : d.selectable.length > 0
          ? { kind: 'unselect', card: d.selectable[0] }
          : { kind: 'unselect', card: null }
    case 'announce':
      return d.announceType === 'number'
        ? { kind: 'announce', value: d.numbers![0] }
        : { kind: 'announce', value: d.availableMask ? d.availableMask & -d.availableMask : 1 }
    case 'counter':
      return { kind: 'counter', counters: [] }
    case 'sum': {
      const picked = [...d.mustSelect]
      for (const card of d.cards) {
        if (picked.length >= d.count) break
        if (!picked.some((p) => p.code === card.code && p.sequence === card.sequence)) {
          picked.push(card)
        }
      }
      return { kind: 'sum', cards: picked }
    }
    default:
      throw new Error(`autoAnswer 未覆盖 kind=${request.kind}`)
  }
}

async function main(): Promise<void> {
  await cdbService.ready()
  const puzzle = buildTagPuzzle()
  const initParams: EngineDuelInitParams = {
    puzzleState: puzzle,
    seed: [1234, 2345, 3456, 4567, 5678, 6789, 7890, 8901]
  }
  const start = await duelSession.startDuel(initParams)
  assert(start.boardState.tag === true, '内置引擎 2v2 开局应标记 tag')
  assert(start.boardState.duelists?.length === 4, '内置引擎 2v2 开局应有 4 名决斗者')

  let answers = 0
  while (answers < 80) {
    const pending = duelSession.getPendingRequest()
    if (!pending) break
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) throw new Error('2v2 开局被引擎拒绝 (RETRY)')
    answers++
  }

  const doc = duelSession.exportSessionDoc()
  const responses = doc.ops
    .map(decodeSessionOp)
    .flatMap((op) => (op.type === 'inject' ? [] : op.responses))
    .filter((response) => response.length > 0)
  assert(responses.length > 0, '2v2 对局应记录到引擎响应')

  const data = buildTagReplayData(puzzle)
  const fieldCard = {
    ...puzzle.cards[0],
    instanceId: 'field-card',
    location: CardLocation.MZONE,
    sequence: 0
  }
  let fieldRejected = false
  try {
    buildTagReplayData({ ...puzzle, cards: [...puzzle.cards, fieldCard] })
  } catch {
    fieldRejected = true
  }
  assert(fieldRejected, '带初始场面的 2v2 对局应拒绝四卡组回放导出')
  const names = ['我方 1', '我方 2', '对方 2', '对方 1']
  const bytes = buildYrpTagFile({
    names,
    seed: doc.seed,
    startLp: data.startLp,
    startHand: data.startHand,
    drawCount: data.drawCount,
    opt: buildDuelFlag(5, false, true),
    decks: data.decks,
    responses
  })

  const { yrp, bytes: yrpBytes } = parseYrpReplay(bytes, 'tag-replay-smoke.yrp')
  assert(yrp.isTag, '导出的 2v2 YRP 应带 tag 标记')
  assert(!yrp.isSingleMode, '导出的 2v2 YRP 应使用四卡组模式')
  assert(yrp.tagHostName === names[1], '导出的 2v2 YRP 应保留队友 1 的名字')
  assert(yrp.tagClientName === names[2], '导出的 2v2 YRP 应保留队友 2 的名字')

  const replayState = createSessionState()
  replayState.ocgcore = await getOcgcoreEngine()
  setupReplayDuel(replayState, yrp, yrpBytes, 'tag-replay-smoke.yrp')
  const warning = buildReplayTimeline(replayState, yrp)
  const board = replayState.fieldReader.getState()
  assert(board.tag === true, '导入 2v2 回放后应恢复 tag 棋盘')
  assert(board.duelists?.length === 4, '导入 2v2 回放后应恢复 4 名决斗者')
  assert(
    board.duelists?.some((duelist) => duelist.id === 'duelist_0_1') === true,
    '导入 2v2 回放后应保留副将 duelistId'
  )

  const puzzleFromReplay = buildPuzzleStateFromEngineBoard(board, {
    title: '2v2 回放',
    masterRule: 5
  })
  assert(puzzleFromReplay.matchConfig?.mode === 'tag', '回放转编排后应保留 tag 对阵')
  assert(puzzleFromReplay.duelists?.length === 4, '回放转编排后应保留 4 名决斗者')
  assert(
    puzzleFromReplay.cards.some((card) => card.duelistId === 'duelist_0_1') === true,
    '回放转编排后应保留副将手牌归属'
  )

  const matchState = buildReplayMatchState(
    {
      fileName: 'tag-replay-smoke.yrp',
      hostName: names[0],
      clientName: names[3],
      tagHostName: names[1],
      tagClientName: names[2],
      isTag: true,
      isSingleMode: false,
      totalSteps: responses.length,
      masterRule: 5
    },
    board
  )
  assert(matchState.matchConfig.mode === 'tag', '回放导入后应切到 2v2 对阵')
  assert(matchState.duelists.length === 4, '回放导入后应生成 4 名决斗者')
  assert(matchState.duelists[1].name === names[1], '回放导入后应按座位还原队友名')

  console.log(
    `[tag-replay-smoke] 2v2 导出/导入通过: 响应 ${responses.length} 条, 步骤 ${replayState.timeline.getAllNodes().length} 个${warning ? `, 警告: ${warning}` : ''}`
  )
}

main().catch((err) => {
  console.error('[tag-replay-smoke] FAILED:', err)
  process.exit(1)
})
