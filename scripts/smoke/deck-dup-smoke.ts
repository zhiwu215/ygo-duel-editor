/**
 * 复现冒烟：残局初始化（卡组+手牌预置卡）后连续结束回合，
 * 检查 FieldReader 读场时手牌/卡组数量与实例 id 是否稳定（不重复、不漂移）
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

declare const __filename: string
const coreRequire = createRequire(__filename)
import { cdbService } from './cdb-shim'
import { readEngineCardData } from '../../src/main/services/duel/card-reader'
import { createSessionState } from '../../src/main/services/duel/session-state'
import { setupFromPuzzleState } from '../../src/main/services/duel/session-setup'
import type { DuelPuzzleState } from '@shared/index'
import { CardLocation, CardPosition } from '@shared/index'
import type { Answer } from '@shared/engine/protocol'

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'
const BLUE_EYES = 89631139
const POT = 55144522

async function main(): Promise<void> {
  await cdbService.ready()

  const wasmDir = path.join(
    path.dirname(coreRequire.resolve('koishipro-core.js')),
    'vendor/wasm_cjs'
  )
  const { createOcgcoreWrapper } = await import('koishipro-core.js')
  const DirScriptReader =
    (scriptRoot: string) =>
    (scriptPath: string): Uint8Array | null => {
      const normalized = scriptPath.replace(/^\.\//, '').replace(/^script\//, '')
      try {
        return new Uint8Array(fs.readFileSync(path.join(scriptRoot, normalized)))
      } catch {
        return null
      }
    }
  const ygopro = await import('ygopro-msg-encode')
  const { routeRequest } = await import('../../src/main/services/duel/request-router')
  const { encodeAnswer } = await import('../../src/main/services/duel/answer-encoder')

  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(wasmDir, 'libocgcore.wasm')))
  const wrapper = await createOcgcoreWrapper({ wasmBinary })
  wrapper.setMessageHandler(() => {})
  wrapper.setCardReader((code) => readEngineCardData(code))
  wrapper.setScriptReader(DirScriptReader(GAME_DIR + '/script'), true)

  const state = createSessionState()
  state.ownedWrapper = wrapper

  const puzzle: DuelPuzzleState = {
    masterRule: 5,
    turnPlayer: 0,
    firstTurnAttack: false,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    cards: [
      {
        instanceId: 'editor-deck-1',
        code: POT,
        controller: 0,
        owner: 0,
        location: CardLocation.DECK,
        sequence: 0,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      },
      ...Array.from({ length: 18 }, (_, i) => ({
        instanceId: `editor-deck-be-${i}`,
        code: BLUE_EYES,
        controller: 0,
        owner: 0,
        location: CardLocation.DECK,
        sequence: i + 1,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      })),
      {
        instanceId: 'editor-hand-1',
        code: BLUE_EYES,
        controller: 0,
        owner: 0,
        location: CardLocation.HAND,
        sequence: 0,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      },
      {
        instanceId: 'editor-hand-2',
        code: POT,
        controller: 0,
        owner: 0,
        location: CardLocation.HAND,
        sequence: 1,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      }
    ] as DuelPuzzleState['cards']
  } as unknown as DuelPuzzleState

  state.ocgcore = wrapper
  state.duel = wrapper.createDuelV2([12345, 67890])
  setupFromPuzzleState(state, puzzle)

  const isInteractive = (msg: unknown): boolean =>
    msg instanceof ygopro.YGOProMsgSelectIdleCmd ||
    msg instanceof ygopro.YGOProMsgSelectBattleCmd ||
    msg instanceof ygopro.YGOProMsgSelectChain ||
    msg instanceof ygopro.YGOProMsgSelectYesNo ||
    msg instanceof ygopro.YGOProMsgSelectEffectYn

  const autoAnswer = (request: ReturnType<typeof routeRequest>): Answer => {
    switch (request.kind) {
      case 'rps':
        return { kind: 'rps', hand: 'paper' }
      case 'idle':
        return { kind: 'idle', cmd: 'TO_EP' }
      case 'battle':
        return { kind: 'battle', cmd: 'TO_EP' }
      case 'yesno':
        return { kind: 'yesno', yes: false }
      case 'chain':
        return { kind: 'chain', card: null }
      default:
        return { kind: 'chain', card: null }
    }
  }

  const dump = (label: string): void => {
    const board = state.fieldReader.readBoard(state.duel!)
    const p0 = board.players[0]
    const p1 = board.players[1]
    const fmt = (cards: { code: number; instanceId: string }[]): string =>
      cards.map((c) => `${c.code}(${c.instanceId})`).join(', ') || '（空）'
    console.log(`\n=== ${label} ===`)
    console.log(`  回合 ${board.turn} phase=${board.phaseName}`)
    console.log(`  我方手牌 (${p0.hand.length}):`, fmt(p0.hand))
    console.log(`  我方卡组 (${p0.deck.length}):`, fmt(p0.deck))
    console.log(`  对方手牌 (${p1.hand.length}):`, fmt(p1.hand))
    console.log(`  对方卡组 (${p1.deck.length}):`, fmt(p1.deck))
  }

  dump('开局')

  for (let turn = 1; turn <= 6; turn++) {
    let guard = 0
    while (true) {
      if (++guard > 20000) throw new Error('process overflow')
      const res = state.duel!.process()
      for (const msg of res.messages ?? []) {
        state.fieldReader.applyMetaMessage(msg)
      }
      if (state.duel!.ended) break
      let answered = false
      for (const msg of res.messages ?? []) {
        if (!isInteractive(msg)) continue
        const request = routeRequest(msg, { id: `req-${guard}`, seq: guard, descHint: undefined })
        const answer = autoAnswer(request)
        console.log(`    [answer] turn${turn} ${request.kind}`)
        state.duel!.setResponse(encodeAnswer(msg, answer))
        answered = true
      }
      if ((res.messages ?? []).some((m) => m.constructor?.name === 'YGOProMsgRetry')) {
        console.log('    [RETRY] 引擎拒绝响应，停止推进')
        break
      }
      if (res.status === 1 && !answered) break
    }
    dump(`结束回合后 #${turn}`)
  }

  wrapper.finalize()
  process.exit(0)
}

main().catch((e) => {
  console.error('[smoke] FAILED', e)
  process.exit(1)
})
