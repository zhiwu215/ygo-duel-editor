import { OcgcoreDuel } from 'koishipro-core.js'
import {
  IndexResponse,
  YGOProMsgDamage,
  YGOProMsgDraw,
  YGOProMsgHint,
  YGOProMsgNewTurn,
  YGOProMsgRecover,
  YGOProMsgRetry,
  YGOProMsgSelectChain,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectUnselectCard,
  YGOProMsgShuffleDeck,
  YGOProMsgShuffleHand
} from 'ygopro-msg-encode'
import { cdbService } from '../../db/cdbService'
import type { SessionState } from './session-state'
import { isInteractiveQuery } from './message-parser'
import { routeRequest } from './request-router'

const HINT_TYPE_SELECTMSG = 3

const MAX_PROCESS_LOOPS = 10000

export interface DrawEvent {
  player: 0 | 1
  codes: number[]
}

function resolveAutoResponse(state: SessionState, msg: unknown): Uint8Array | null {
  if (state.replaying) return null

  if (msg instanceof YGOProMsgSelectChain) {
    if (state.timingPolicy.chain === 'all') return null
    const forced = msg.chains.some((chain) => chain.forced === 1)
    if (forced) {
      if (state.timingPolicy.chain === 'ignore' && msg.chains.length === 1) {
        return msg.prepareResponse(IndexResponse(0))
      }
      return null
    }
    if (msg.chains.length === 0) return msg.defaultResponse()
    return state.timingPolicy.chain === 'ignore' ? msg.defaultResponse() : null
  }

  if (msg instanceof YGOProMsgSelectEffectYn && state.timingPolicy.effectYn === 'never') {
    return msg.prepareResponse(false)
  }

  return null
}

function collectLogs(state: SessionState, msgs: unknown[]): void {
  for (const msg of msgs) {
    if (msg instanceof YGOProMsgDraw) {
      const names = msg.cards
        .map((c: number) => cdbService.getCardById(c)?.name || String(c))
        .join(', ')
      state.accumulatedLogs.push(`Player ${msg.player} 抽了 ${msg.count} 张卡: [${names}]`)
    } else if (msg instanceof YGOProMsgNewTurn) {
      state.accumulatedLogs.push(`--- 回合推进 (Player ${msg.player} 回合) ---`)
    } else if (msg instanceof YGOProMsgDamage) {
      state.accumulatedLogs.push(`Player ${msg.player} 受到 ${msg.value} 点伤害！`)
    } else if (msg instanceof YGOProMsgRecover) {
      state.accumulatedLogs.push(`Player ${msg.player} 恢复了 ${msg.value} 点 LP`)
    }
  }
}

export function advanceEngine(state: SessionState): Uint8Array[] {
  const duel: OcgcoreDuel | null = state.duel
  if (!duel) return []

  state.lastAdvanceRetried = false
  state.lastDrawEvents = []
  state.lastDeckShuffles = []
  const autoResponses: Uint8Array[] = []
  let loops = 0

  while (true) {
    loops++
    if (loops > MAX_PROCESS_LOOPS) {
      throw new Error('引擎推进步数超出上限，可能陷入死循环。')
    }

    const res = duel.process()
    const msgs = res.messages ?? []
    let autoCandidate: Uint8Array | null = null
    const manualQueries: unknown[] = []

    if (msgs.length > 0) {
      for (const msg of msgs) {
        state.fieldReader.applyMetaMessage(msg)
        if (msg instanceof YGOProMsgHint && msg.type === HINT_TYPE_SELECTMSG) {
          state.lastHintDesc = msg.desc
        }
        if (msg instanceof YGOProMsgShuffleHand) {
          state.accumulatedEvents.push({ kind: 'shuffle-hand', player: msg.player === 1 ? 1 : 0 })
        }
        if (msg instanceof YGOProMsgDraw) {
          state.lastDrawEvents.push({
            player: msg.player === 1 ? 1 : 0,
            codes: msg.cards.map((code: number) => code & 0x7fffffff)
          })
        }
        if (msg instanceof YGOProMsgShuffleDeck) {
          state.lastDeckShuffles.push(msg.player === 1 ? 1 : 0)
        }
      }
      collectLogs(state, msgs)

      for (const msg of msgs) {
        if (!isInteractiveQuery(msg)) continue
        const auto = resolveAutoResponse(state, msg)
        if (auto) {
          autoCandidate = auto
        } else {
          manualQueries.push(msg)
        }
      }

      for (const msg of manualQueries) {
        state.currentPendingMsg = msg
        state.currentPendingRequest = routeRequest(msg, {
          id: `req-${state.requestSeq}`,
          seq: state.requestSeq,
          descHint: state.lastHintDesc
        })
        state.lastHintDesc = undefined
      }

      if (msgs.some((m) => m instanceof YGOProMsgRetry)) {
        state.lastAdvanceRetried = true
        state.accumulatedLogs.push('引擎拒绝了上一次响应 (RETRY)。')
        break
      }
    }

    const autoResponse = manualQueries.length === 0 ? autoCandidate : null
    if (autoResponse) {
      state.currentPendingMsg = null
      state.currentPendingRequest = null
      duel.setResponse(autoResponse)
      autoResponses.push(autoResponse)
      continue
    }

    if (res.status === 1) {
      break
    }
    if (res.status === 2 || duel.ended) {
      state.currentPendingMsg = null
      state.currentPendingRequest = null
      break
    }
  }

  return autoResponses
}

export function isAutoFinishableUnselect(state: SessionState, answeredMsg: unknown): boolean {
  const msg = state.currentPendingMsg
  if (!(msg instanceof YGOProMsgSelectUnselectCard)) return false
  if (msg === answeredMsg) return true
  const data = state.currentPendingRequest?.data
  return (
    data?.kind === 'unselect' &&
    data.finishable &&
    data.selectable.length === 0 &&
    data.unselectable.length > 0
  )
}
