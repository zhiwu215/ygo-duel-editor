/**
 * 装备卡攻守传导专项冒烟：团结之力装备到电子龙后，
 * 引擎全量查询 → FieldReader → resolveEngineCardStats 是否把修改后的攻守带出来。
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

declare const __filename: string
const coreRequire = createRequire(__filename)
import { cdbService } from './cdb-shim'
import { readEngineCardData } from '../../src/main/services/duel/card-reader'
import { FieldReader } from '../../src/main/services/duel/field-reader'
import { resolveEngineCardStats } from '@shared/engine/engineStats'
import type { EngineCard } from '@shared/types/duelEngine'
import type { Answer } from '@shared/engine/protocol'

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'

const UNITED_WE_STAND = 56747793
const CYBER_DRAGON = 70095154
const BLUE_EYES = 89631139
const SABER_SAURUS = 37265642
const ORICHALCOS = 7634581
const APOLLOUSA = 4280258
const RED_EYES = 74677422

const HINTMSG_EQUIP = 518
const CYBER_ATK_AFTER_EQUIP = 2100 + 800 * 2
const CYBER_DEF_AFTER_EQUIP = 1600 + 800 * 2

async function main(): Promise<void> {
  await cdbService.ready()

  const { OcgcoreDuelRule, OcgcoreDuelOptionFlag } = coreRequire('koishipro-core.js')
  const wasmDir = path.join(
    path.dirname(coreRequire.resolve('koishipro-core.js')),
    'vendor/wasm_cjs'
  )
  const { createOcgcoreWrapper } = await import('koishipro-core.js')
  const ygopro = await import('ygopro-msg-encode')
  const { routeRequest } = await import('../../src/main/services/duel/request-router')
  const { encodeAnswer } = await import('../../src/main/services/duel/answer-encoder')

  const readScript =
    (scriptRoot: string) =>
    (scriptPath: string): Uint8Array | null => {
      const normalized = scriptPath.replace(/^\.\//, '').replace(/^script\//, '')
      try {
        return new Uint8Array(fs.readFileSync(path.join(scriptRoot, normalized)))
      } catch {
        return null
      }
    }

  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(wasmDir, 'libocgcore.wasm')))
  const wrapper = await createOcgcoreWrapper({ wasmBinary })
  wrapper.setMessageHandler((_: unknown, message: string, type: number) => {
    if (type === 2) console.log(`[core-error] ${message}`)
  })
  wrapper.setCardReader((code: number) => readEngineCardData(code))
  wrapper.setScriptReader(readScript(path.join(GAME_DIR, 'script')), true)

  const duel = wrapper.createDuelV2([111, 222, 333, 444])
  duel.setPlayerInfo({ player: 0, lp: 8000, startHand: 5, drawCount: 1 })
  duel.setPlayerInfo({ player: 1, lp: 8000, startHand: 5, drawCount: 1 })

  duel.newCard({
    code: UNITED_WE_STAND,
    owner: 0,
    player: 0,
    location: 0x02,
    sequence: 0,
    position: 0x2
  })
  for (let i = 1; i < 5; i++) {
    duel.newCard({
      code: BLUE_EYES,
      owner: 0,
      player: 0,
      location: 0x02,
      sequence: i,
      position: 0x2
    })
  }
  duel.newCard({ code: BLUE_EYES, owner: 0, player: 0, location: 0x04, sequence: 0, position: 0x1 })
  duel.newCard({
    code: CYBER_DRAGON,
    owner: 0,
    player: 0,
    location: 0x04,
    sequence: 1,
    position: 0x1
  })
  duel.newCard({
    code: SABER_SAURUS,
    owner: 1,
    player: 1,
    location: 0x04,
    sequence: 0,
    position: 0x1
  })
  duel.newCard({
    code: ORICHALCOS,
    owner: 1,
    player: 1,
    location: 0x04,
    sequence: 1,
    position: 0x1
  })
  duel.newCard({ code: APOLLOUSA, owner: 1, player: 1, location: 0x04, sequence: 2, position: 0x1 })
  duel.newCard({ code: RED_EYES, owner: 1, player: 1, location: 0x04, sequence: 3, position: 0x8 })
  for (const player of [0, 1] as const) {
    for (let i = 0; i < 10; i++) {
      duel.newCard({
        code: BLUE_EYES,
        owner: player,
        player,
        location: 0x01,
        sequence: i,
        position: 0x8
      })
    }
  }

  duel.startDuel({
    rule: OcgcoreDuelRule.MasterRule2020,
    flags: [OcgcoreDuelOptionFlag.PseudoShuffle, OcgcoreDuelOptionFlag.RevealDeckSeq]
  })

  const reader = new FieldReader()
  reader.reset([8000, 8000], 0)

  const INTERACTIVE = [
    ygopro.YGOProMsgSelectIdleCmd,
    ygopro.YGOProMsgSelectBattleCmd,
    ygopro.YGOProMsgSelectCard,
    ygopro.YGOProMsgSelectTribute,
    ygopro.YGOProMsgSelectChain,
    ygopro.YGOProMsgSelectPlace,
    ygopro.YGOProMsgSelectPosition,
    ygopro.YGOProMsgSelectYesNo,
    ygopro.YGOProMsgSelectEffectYn,
    ygopro.YGOProMsgSelectOption,
    ygopro.YGOProMsgAnnounceNumber,
    ygopro.YGOProMsgAnnounceCard,
    ygopro.YGOProMsgRockPaperScissors
  ]

  let pendingMsg: unknown = null
  let descHint: number | undefined
  let loops = 0

  const advanceToWait = (): void => {
    pendingMsg = null
    loops = 0
    while (true) {
      if (++loops > 5000) throw new Error('process loop overflow')
      const res = duel.process()
      for (const msg of res.messages ?? []) {
        reader.applyMetaMessage(msg)
        if (msg instanceof ygopro.YGOProMsgHint && msg.type === 3) descHint = msg.desc
        if (INTERACTIVE.some((ctor) => msg instanceof ctor)) pendingMsg = msg
      }
      if (res.status === 1 || duel.ended) break
    }
  }

  advanceToWait()

  let activated = false
  let equipped = false
  let steps = 0

  while (pendingMsg && !duel.ended && steps < 60) {
    const request = routeRequest(pendingMsg, { id: `req-${steps}`, seq: steps, descHint })
    descHint = undefined
    if (!request) throw new Error('路由失败')
    if (equipped && request.kind === 'idle') break
    steps++

    const d = request.data
    let answer: Answer
    if (d.kind === 'idle') {
      const spell = d.activatable.find((c) => c.code === UNITED_WE_STAND)
      if (spell && !activated) {
        activated = true
        answer = { kind: 'idle', cmd: 'ACTIVATE', card: spell }
      } else {
        answer = { kind: 'idle', cmd: 'TO_EP' }
      }
    } else if (d.kind === 'place') {
      answer = { kind: 'place', places: [d.places[0]] }
    } else if (d.kind === 'card') {
      const target =
        d.cards.find((c) => c.code === CYBER_DRAGON && c.controller === 0) ?? d.cards[0]
      if (request.descHint === HINTMSG_EQUIP) equipped = true
      answer = { kind: 'card', cards: [target] }
    } else if (d.kind === 'chain') {
      answer = { kind: 'chain', card: null }
    } else if (d.kind === 'yesno') {
      answer = { kind: 'yesno', yes: false }
    } else if (d.kind === 'unselect') {
      answer = { kind: 'unselect', card: null }
    } else if (d.kind === 'position') {
      answer = { kind: 'position', position: d.positions[0] }
    } else if (d.kind === 'option') {
      answer = { kind: 'option', index: 0 }
    } else if (d.kind === 'sort') {
      answer = { kind: 'sort', cards: null }
    } else if (d.kind === 'tribute') {
      answer = d.cancelable
        ? { kind: 'tribute', cards: null }
        : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    } else {
      throw new Error(`未覆盖 kind=${d.kind}`)
    }

    duel.setResponse(encodeAnswer(pendingMsg, answer))
    advanceToWait()
  }

  const failures: string[] = []
  const assert = (condition: boolean, message: string): void => {
    if (!condition) failures.push(message)
    console.log(`  ${condition ? '✅' : '❌'} ${message}`)
  }

  const board = reader.readBoard(duel)
  const find = (code: number, controller: 0 | 1): EngineCard | undefined =>
    board.allCards.find((c) => c.code === code && c.controller === controller)

  const cyber = find(CYBER_DRAGON, 0)
  const saurus = find(SABER_SAURUS, 1)
  const orichalcos = find(ORICHALCOS, 1)
  const apollousa = find(APOLLOUSA, 1)
  const redEyes = find(RED_EYES, 1)

  if (!cyber || !saurus || !orichalcos || !apollousa || !redEyes) {
    console.log('[atk-smoke] FAILED: 场地读取缺少目标卡片')
    process.exit(1)
  }

  assert(equipped, '团结之力装备对象选择已出现')
  assert(
    cyber.atk === CYBER_ATK_AFTER_EQUIP,
    `引擎攻守：电子龙 atk=${cyber.atk}（期望 ${CYBER_ATK_AFTER_EQUIP}）`
  )
  assert(
    cyber.def === CYBER_DEF_AFTER_EQUIP,
    `引擎攻守：电子龙 def=${cyber.def}（期望 ${CYBER_DEF_AFTER_EQUIP}）`
  )
  assert(cyber.baseAtk === 2100, `引擎基础攻：电子龙 baseAtk=${cyber.baseAtk}（期望 2100）`)

  const cyberStats = resolveEngineCardStats(cyber)
  assert(
    cyberStats?.customAtk === CYBER_ATK_AFTER_EQUIP,
    `传导：电子龙 customAtk=${cyberStats?.customAtk}`
  )
  assert(
    cyberStats?.customDef === CYBER_DEF_AFTER_EQUIP,
    `传导：电子龙 customDef=${cyberStats?.customDef}`
  )

  const saurusStats = resolveEngineCardStats(saurus)
  assert(saurusStats?.customAtk === undefined, '传导：未被修正的剑角龙不写 customAtk')
  assert(saurusStats?.customDef === undefined, '传导：未被修正的剑角龙不写 customDef')

  const orichalcosStats = resolveEngineCardStats(orichalcos)
  assert(
    orichalcosStats?.customAtk === 2000,
    `传导：?-攻守卡用引擎基础值兜底 customAtk=${orichalcosStats?.customAtk}`
  )

  const apollousaStats = resolveEngineCardStats(apollousa)
  assert(apollousaStats?.customDef === undefined, '传导：Link 怪兽不把连接标记误当守备修正')

  const redEyesStats = resolveEngineCardStats(redEyes)
  assert(redEyesStats?.customAtk === undefined, '传导：里侧怪兽基础攻守一致时不写 customAtk')

  console.log(
    `\n[atk-smoke] 电子龙 atk=${cyber.atk}/base=${cyber.baseAtk} def=${cyber.def}/base=${cyber.baseDef}`
  )
  if (failures.length > 0) {
    console.log(`[atk-smoke] FAILED: ${failures.length} 项未通过`)
    process.exit(1)
  }
  console.log('[atk-smoke] 全部通过')
  duel.endDuel()
  wrapper.finalize()
}

main().catch((err) => {
  console.error('[atk-smoke] FAILED:', err)
  process.exit(1)
})
