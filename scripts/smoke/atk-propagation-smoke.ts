/**
 * 装备卡攻守传导专项冒烟：团结之力（+800×己方怪兽数）装备到电子龙后，
 * 引擎的场地查询是否返回修改后的 attack/defense。
 *
 * 目的：验证 "引擎是唯一真相" 链路里，改攻效果到底有没有出现在 CardQuery 上。
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

declare const __filename: string
const coreRequire = createRequire(__filename)
import { cdbService } from './cdb-shim'
import type { Answer } from '@shared/engine/protocol'

const GAME_DIR = process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro'

const UNITED_WE_STAND = 56747793
const CYBER_DRAGON = 70095154
const BLUE_EYES = 89631139
const SABER_SAURUS = 37265642

const HINTMSG_EQUIP = 518

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

  const DirScriptReader = (scriptRoot: string) => (scriptPath: string): Uint8Array | null => {
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
  wrapper.setCardReader((code: number) => {
    const c = cdbService.getCardById(code)
    if (!c) return null
    const type = Number(c.type ?? 0)
    const isLink = (type & 0x4000000) !== 0
    return {
      code: c.id,
      alias: c.alias ?? 0,
      setcode: Number(c.setcode ?? 0),
      type,
      level: c.level ?? 0,
      race: Number(c.race ?? 0),
      attribute: Number(c.attribute ?? 0),
      attack: c.atk ?? 0,
      defense: isLink ? 0 : (c.def ?? 0),
      linkMarker: isLink ? (c.def ?? 0) : 0,
      category: 0
    }
  })
  wrapper.setScriptReader(DirScriptReader(path.join(GAME_DIR, 'script')), true)

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
  duel.newCard({
    code: BLUE_EYES,
    owner: 0,
    player: 0,
    location: 0x04,
    sequence: 0,
    position: 0x1
  })
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

  let pendingMsg: unknown = null
  let descHint: number | undefined
  let loops = 0

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

  const advanceToWait = (): void => {
    pendingMsg = null
    loops = 0
    while (true) {
      if (++loops > 5000) throw new Error('process loop overflow')
      const res = duel.process()
      for (const msg of res.messages ?? []) {
        if (msg instanceof ygopro.YGOProMsgHint && msg.type === 3) descHint = msg.desc
        if (INTERACTIVE.some((ctor) => msg instanceof ctor)) pendingMsg = msg
      }
      if (res.status === 1 || duel.ended) break
    }
  }

  let activated = false
  let equipped = false

  const dumpMzone = (label: string): void => {
    for (const player of [0, 1] as const) {
      const res = duel.queryFieldCard({
        player,
        location: 0x04,
        queryFlag: 0xefffff,
        useCache: 0
      })
      for (const card of res?.cards ?? []) {
        if (!card.code) continue
        const name = cdbService.getCardById(card.code ?? 0)?.name ?? '?'
        console.log(
          `[${label}] P${player} MZONE#${card.sequence} ${name} | attack=${card.attack} baseAttack=${card.baseAttack} | defense=${card.defense} baseDefense=${card.baseDefense} | equipCard=${JSON.stringify(card.equipCard ?? null)}`
        )
      }
    }
  }

  dumpMzone('开局')

  let steps = 0
  while (pendingMsg && !duel.ended && steps < 60) {
    steps++
    const request = routeRequest(pendingMsg, { id: `req-${steps}`, seq: steps, descHint })
    descHint = undefined
    if (!request) throw new Error(`路由失败: ${(pendingMsg as { constructor?: { name?: string } }).constructor?.name}`)
    console.log(
      `  >> P${request.player} ${request.kind}${request.descHint !== undefined ? ` hint=${request.descHint}` : ''} title=${request.title}`
    )

    const d = request.data
    let answer: Answer
    if (d.kind === 'idle') {
      console.log(
        `      activatable: ${d.activatable.map((c) => `${c.code}@${c.controller}:${c.location}:${c.sequence}`).join(', ') || '(none)'}`
      )
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
      console.log(
        `      candidates: ${d.cards.map((c) => `${c.code}@${c.controller}:${c.location}:${c.sequence}`).join(', ')}`
      )
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
      answer = d.cancelable ? { kind: 'tribute', cards: null } : { kind: 'tribute', cards: d.cards.slice(0, Math.max(1, d.min)) }
    } else {
      throw new Error(`未覆盖 kind=${d.kind}`)
    }

    duel.setResponse(encodeAnswer(pendingMsg, answer))
    advanceToWait()

    if (equipped) {
      dumpMzone('装备后')
      break
    }
  }

  if (!equipped) {
    console.log('[atk-smoke] FAILED: 未走到装备对象选择')
    process.exit(1)
  }

  const cyber = duel
    .queryFieldCard({ player: 0, location: 0x04, queryFlag: 0xefffff, useCache: 0 })
    ?.cards.find((c) => c.code === CYBER_DRAGON)
  const expected = 2100 + 800 * 2
  if (cyber?.attack !== expected) {
    console.log(`[atk-smoke] FAILED: 电子龙 attack=${cyber?.attack}，期望 ${expected}`)
    process.exit(1)
  }
  console.log(`[atk-smoke] PASSED: 引擎返回修改后攻击力 attack=${cyber.attack}`)
  duel.endDuel()
  wrapper.finalize()
}

main().catch((err) => {
  console.error('[atk-smoke] FAILED:', err)
  process.exit(1)
})
