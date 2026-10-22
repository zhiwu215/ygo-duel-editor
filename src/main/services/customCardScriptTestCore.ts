import {
  createOcgcoreWrapper,
  DirScriptReader,
  MapScriptReader,
  OcgcoreDuelRule,
  OcgcoreMessageType,
  SlientAdvancor,
  type Advancor
} from 'koishipro-core.js'
import {
  IndexResponse,
  YGOProMsgSelectCard,
  YGOProMsgSelectChain,
  YGOProMsgSelectOption,
  YGOProMsgSelectPosition,
  YGOProMsgSelectYesNo,
  type CardData
} from 'ygopro-msg-encode'
import type {
  CustomCard,
  CustomScriptTestCheck,
  CustomScriptTestPlan,
  CustomScriptTestReport
} from '@shared/index'
import { resolveScriptTestLocation, resolveScriptTestPosition } from './customCardScriptTestPlan'

export interface CustomCardScriptTestCoreInput {
  card: CustomCard
  cardData: Partial<CardData>
  cardDataMap: Record<number, Partial<CardData>>
  script: string
  scriptDirs: string[]
  plan: CustomScriptTestPlan
}

function includeScriptNames(plan: CustomScriptTestPlan): string[] {
  return [...new Set([`c${plan.cardCode}.lua`, ...plan.includeScripts])]
}

function normalizeScriptName(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/?(?:script\/)?/, '')
}

function scriptContentMap(card: CustomCard, script: string): Map<string, string> {
  const map = new Map<string, string>()
  const name = `c${card.id}.lua`
  map.set(name, script)
  map.set(name.toLowerCase(), script)
  return map
}

function resolveSeed(plan: CustomScriptTestPlan): number[] {
  if (Array.isArray(plan.seed)) return plan.seed.length > 0 ? plan.seed : [42]
  return [typeof plan.seed === 'number' ? plan.seed : 42]
}

function assertFieldCount(
  check: Extract<CustomScriptTestCheck, { kind: 'assert-field-count' }>,
  actual: number
): void {
  if (check.equals !== undefined && actual !== check.equals) {
    throw new Error(`期望 ${check.location} 数量为 ${check.equals}，实际为 ${actual}`)
  }
  if (check.min !== undefined && actual < check.min) {
    throw new Error(`期望 ${check.location} 数量至少为 ${check.min}，实际为 ${actual}`)
  }
  if (check.max !== undefined && actual > check.max) {
    throw new Error(`期望 ${check.location} 数量至多为 ${check.max}，实际为 ${actual}`)
  }
}

function createResponseAdvancor(plan: CustomScriptTestPlan): Advancor {
  const pending = [...(plan.responses ?? [])]
  const fallback = SlientAdvancor()
  return (message) => {
    const take = <T extends (typeof pending)[number]['kind']>(
      kind: T
    ): Extract<(typeof pending)[number], { kind: T }> | null => {
      const index = pending.findIndex((item) => item.kind === kind)
      if (index < 0) return null
      const [response] = pending.splice(index, 1)
      return response as Extract<(typeof pending)[number], { kind: T }>
    }

    if (message instanceof YGOProMsgSelectCard) {
      const response = take('select-card')
      if (response) {
        return message.prepareResponse(
          response.cards.map((card) => ({
            ...(card.index !== undefined ? { index: card.index } : {}),
            ...(card.code !== undefined ? { code: card.code } : {}),
            ...(card.controller !== undefined ? { controller: card.controller } : {}),
            ...(card.location !== undefined
              ? { location: resolveScriptTestLocation(card.location) }
              : {}),
            ...(card.sequence !== undefined ? { sequence: card.sequence } : {})
          }))
        )
      }
    } else if (message instanceof YGOProMsgSelectYesNo) {
      const response = take('yes-no')
      if (response) return message.prepareResponse(response.value)
    } else if (message instanceof YGOProMsgSelectChain) {
      const response = take('chain')
      if (response) {
        return message.prepareResponse(
          response.index !== undefined
            ? IndexResponse(response.index)
            : response.code !== undefined
              ? { code: response.code }
              : null
        )
      }
    } else if (message instanceof YGOProMsgSelectOption) {
      const response = take('option')
      if (response) return message.prepareResponse(response.index)
    } else if (message instanceof YGOProMsgSelectPosition) {
      const response = take('position')
      if (response) {
        return message.prepareResponse(resolveScriptTestPosition(response.position))
      }
    }
    return fallback(message)
  }
}

export async function runCustomCardScriptTestCore(
  input: CustomCardScriptTestCoreInput
): Promise<CustomScriptTestReport> {
  const { plan } = input
  const errors: string[] = []
  const logs: string[] = []
  let steps = 0
  let started = false

  const wrapper = await createOcgcoreWrapper()
  wrapper.setCardReader(
    (code) => (code === input.card.id ? input.cardData : (input.cardDataMap[code] ?? null)),
    true
  )
  wrapper.setScriptReader(MapScriptReader(scriptContentMap(input.card, input.script)), true)
  if (input.scriptDirs.length > 0) {
    wrapper.setScriptReader(DirScriptReader(...input.scriptDirs))
  }

  wrapper.setMessageHandler((_duel, message, type) => {
    if (type === OcgcoreMessageType.ScriptError) {
      errors.push(message)
    } else {
      logs.push(message)
    }
  }, true)

  const duel = wrapper.createDuelV2(resolveSeed(plan))
  const advancor = createResponseAdvancor(plan)
  const loadedScripts = includeScriptNames(plan)

  try {
    duel.setPlayerInfo({ player: 0, lp: 8000, startHand: 0, drawCount: 0 })
    duel.setPlayerInfo({ player: 1, lp: 8000, startHand: 0, drawCount: 0 })

    for (const card of plan.setup) {
      duel.newCard({
        code: card.code,
        owner: card.owner,
        player: card.controller,
        location: resolveScriptTestLocation(card.location),
        sequence: card.sequence ?? 0,
        position: resolveScriptTestPosition(card.position)
      })
      if (errors.length > 0) throw new Error(errors[0])
    }

    const start = (): void => {
      if (started) return
      started = true
      duel.startDuel(OcgcoreDuelRule.MasterRule2020)
      if (errors.length > 0) throw new Error(errors[0])
    }

    for (const check of plan.checks) {
      if (check.kind === 'load-script') {
        const code = check.code ?? plan.cardCode
        const name = normalizeScriptName(`c${code}.lua`)
        if (!loadedScripts.some((item) => normalizeScriptName(item) === name)) {
          throw new Error(`测试计划未包含脚本 ${name}`)
        }
      } else if (check.kind === 'start-duel') {
        start()
      } else if (check.kind === 'advance') {
        start()
        for (const _result of duel.advance(advancor)) {
          void _result
          steps += 1
          if (errors.length > 0) throw new Error(errors[0])
          if (steps >= check.maxSteps) break
        }
      } else if (check.kind === 'assert-no-redtext') {
        if (errors.length > 0) throw new Error(errors[0])
      } else if (check.kind === 'assert-lp') {
        start()
        const actual = duel.queryFieldInfo().field.players[check.player].lp
        if (actual !== check.equals) {
          throw new Error(`期望玩家 ${check.player} LP 为 ${check.equals}，实际为 ${actual}`)
        }
      } else if (check.kind === 'assert-field-count') {
        start()
        const actual = duel.queryFieldCount({
          player: check.player,
          location: resolveScriptTestLocation(check.location)
        })
        assertFieldCount(check, actual)
      }
    }

    if (errors.length > 0) throw new Error(errors[0])
    return {
      ok: true,
      summary: `测试通过（${plan.checks.length} 项检查）`,
      loadedScripts,
      logs,
      errors,
      steps
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      summary: message,
      loadedScripts,
      logs,
      errors: errors.length > 0 ? errors : [message],
      steps
    }
  } finally {
    try {
      duel.endDuel()
    } catch {}
    try {
      wrapper.finalize()
    } catch {}
  }
}
