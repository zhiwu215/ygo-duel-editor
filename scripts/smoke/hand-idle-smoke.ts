/**
 * 手牌位置冒烟测试：手牌卡以 FACEDOWN / FACEUP 建场后，
 * 核心 SELECT_IDLE_CMD 是否仍列出 可召唤/可特召/可发动
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

declare const __filename: string
const coreRequire = createRequire(__filename)
import { cdbService } from './cdb-shim'
import { readEngineCardData } from '../../src/main/services/duel/card-reader'
import { FieldReader } from '../../src/main/services/duel/field-reader'
import { CardLocation } from '@shared/constants/locations'
import type { Answer } from '@shared/engine/protocol'

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'

const BLUE_EYES = 89631139
const TYPE_MONSTER = 0x1
const TYPE_EFFECT = 0x20

function pickLowMonster(): number {
  const candidates = cdbService.findCardsByType(TYPE_MONSTER | TYPE_EFFECT, 50)
  for (const c of candidates) {
    const level = Number(c.level ?? 0) & 0xff
    const full = cdbService.getCardById(c.id)
    if (level > 0 && level <= 4 && full?.name) {
      console.log('[smoke] 测试用手卡:', c.id, full.name, 'level', level)
      return c.id
    }
  }
  throw new Error('cdb 中找不到数据完整的低星怪兽')
}

async function main(): Promise<void> {
  await cdbService.ready()
  console.log('[smoke] cdb loaded, cards:', cdbService.size)

  const { OcgcoreDuelRule, OcgcoreDuelOptionFlag, _OcgcoreConstants } = coreRequire(
    'koishipro-core.js'
  )
  const { OcgcoreScriptConstants } = _OcgcoreConstants
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

  function autoAnswer(request: ReturnType<typeof routeRequest>): Answer {
    if (!request) return { kind: 'chain', card: null }
    const d = request.data
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
      case 'card':
        return d.cancelable ? { kind: 'card', cards: null } : { kind: 'card', cards: d.cards.slice(0, Math.max(1, d.min)) }
      case 'tribute':
        return d.cancelable ? { kind: 'tribute', cards: null } : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
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
        return { kind: 'unselect', card: null }
      case 'announce':
        return d.announceType === 'number' ? { kind: 'announce', value: d.numbers![0] } : { kind: 'announce', value: 1 }
      case 'counter':
        return { kind: 'counter', counters: [] }
      default:
        return { kind: 'chain', card: null }
    }
  }

  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(wasmDir, 'libocgcore.wasm')))
  const wrapper = await createOcgcoreWrapper({ wasmBinary })
  wrapper.setMessageHandler(() => {})
  wrapper.setCardReader((code) => readEngineCardData(code))
  wrapper.setScriptReader(DirScriptReader(GAME_DIR + '/script'), true)

  const LOW_MONSTER = pickLowMonster()

    const isInteractive = (msg: unknown): boolean =>
      msg instanceof ygopro.YGOProMsgSelectIdleCmd ||
      msg instanceof ygopro.YGOProMsgSelectBattleCmd ||
      msg instanceof ygopro.YGOProMsgSelectCard ||
      msg instanceof ygopro.YGOProMsgSelectTribute ||
      msg instanceof ygopro.YGOProMsgSelectChain ||
      msg instanceof ygopro.YGOProMsgSelectPlace ||
      msg instanceof ygopro.YGOProMsgSelectPosition ||
      msg instanceof ygopro.YGOProMsgSelectYesNo ||
      msg instanceof ygopro.YGOProMsgSelectEffectYn ||
      msg instanceof ygopro.YGOProMsgSelectOption ||
      msg instanceof ygopro.YGOProMsgAnnounceNumber ||
      msg instanceof ygopro.YGOProMsgAnnounceCard ||
      msg instanceof ygopro.YGOProMsgRockPaperScissors

    const runCase = async (label: string, positions: number[]): Promise<void> => {
    const duel = wrapper.createDuelV2([12345, 67890, 11111, 22222])
    duel.setPlayerInfo({ player: 0, lp: 8000, startHand: 2, drawCount: 1 })
    duel.setPlayerInfo({ player: 1, lp: 8000, startHand: 0, drawCount: 1 })

    for (const owner of [0, 1]) {
      for (let i = 0; i < 5; i++) {
        duel.newCard({
          code: BLUE_EYES,
          owner,
          player: owner,
          location: CardLocation.DECK,
          sequence: 0,
          position: OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE
        })
      }
    }

    positions.forEach((pos, index) => {
      duel.newCard({
        code: LOW_MONSTER,
        owner: 0,
        player: 0,
        location: CardLocation.HAND,
        sequence: index,
        position: pos
      })
    })

    duel.startDuel({
      rule: OcgcoreDuelRule.MasterRule2020,
      flags: [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
    })

    const reader = new FieldReader()
    reader.reset([8000, 8000], 0)

    let pending: InstanceType<typeof ygopro.YGOProMsgSelectIdleCmd> | null = null
    let loops = 0
    while (true) {
      if (++loops > 5000) throw new Error('process loop overflow')
      const res = duel.process()
      for (const msg of res.messages ?? []) {
        reader.applyMetaMessage(msg)
        if (msg instanceof ygopro.YGOProMsgSelectIdleCmd) pending = msg
      }
      if (pending || res.status === 1 || duel.ended) break
    }

    while (!pending && !duel.ended) {
      let waiting: unknown = null
      let inner = 0
      while (true) {
        if (++inner > 5000) throw new Error('process loop overflow')
        const res = duel.process()
        for (const msg of res.messages ?? []) {
          reader.applyMetaMessage(msg)
          if (msg instanceof ygopro.YGOProMsgSelectIdleCmd) {
            pending = msg
          } else if (isInteractive(msg) && !waiting) {
            waiting = msg
          }
        }
        if (pending || waiting || res.status === 1 || duel.ended) break
      }
      if (pending || duel.ended || !waiting) break
      const request = routeRequest(waiting, { id: `req-${loops}`, seq: loops, descHint: undefined })
      const answer = autoAnswer(request)
      duel.setResponse(encodeAnswer(waiting, answer))
    }

    if (!pending) {
      console.log(`[${label}] 没有 SELECT_IDLE_CMD (ended=${duel.ended})`)
      return
    }
    const board = reader.readBoard(duel)
    const dump = (cards: { code: number; location: number; sequence: number }[]): string =>
      cards.map((c) => `${c.code}@loc${c.location}#${c.sequence}pos${c.position}`).join(', ') || '（空）'
    console.log(`[${label}] idle.player=${pending.player} phase=${board.phaseName} turn=${board.turn}`)
    console.log(
      '  我方手牌:',
      board.players[0].hand.map((c) => `${c.code}@pos${c.position}`).join(', ') || '（空）'
    )
    const handCard = board.players[0].hand.find((c) => c.code === LOW_MONSTER)
    if (handCard) {
      const q = duel.queryCard({
        player: 0,
        location: handCard.location,
        sequence: handCard.sequence,
        queryFlag: 0xefffff
      })
      console.log('  核心内手卡查询:', JSON.stringify(q, (k, v) => (typeof v === 'bigint' ? String(v) : v)).slice(0, 300))
    }
    console.log(
      `  RAW: ${JSON.stringify(pending, (k, v) => (typeof v === 'bigint' ? String(v) : v)).slice(0, 400)}`
    )
    console.log('  summonable :', dump(pending.summonableCards))
    console.log('  spsummon   :', dump(pending.spSummonableCards))
    console.log('  activatable:', dump(pending.activatableCards))
    console.log('  msetable   :', dump(pending.msetableCards))
    console.log('  ssetable   :', dump(pending.ssetableCards))
  }

  await runCase('手牌 FACEDOWN', [OcgcoreScriptConstants.POS_FACEDOWN])
  await runCase('手牌 FACEUP  ', [OcgcoreScriptConstants.POS_FACEUP])
  await runCase('手牌混合    ', [
    OcgcoreScriptConstants.POS_FACEDOWN,
    OcgcoreScriptConstants.POS_FACEUP
  ])

  console.log(
    '[constants]',
    Object.entries(OcgcoreScriptConstants)
      .filter(([k]) => k.startsWith('POS'))
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
  )

  wrapper.finalize()
  process.exit(0)
}

main().catch((e) => {
  console.error('[smoke] FAILED', e)
  process.exit(1)
})
