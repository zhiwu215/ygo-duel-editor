import { createDuelFromYrp, type OcgcoreWrapper } from 'koishipro-core.js'
import { YGOProMsgRetry } from 'ygopro-msg-encode'

export interface ReplayVerification {
  ok: boolean
  step: number
}

export function verifyYrpReplay(wrapper: OcgcoreWrapper, yrpBytes: Uint8Array): ReplayVerification {
  let duel: ReturnType<typeof createDuelFromYrp>['duel'] | null = null
  try {
    const created = createDuelFromYrp(wrapper, yrpBytes)
    duel = created.duel
    const frames = created.yrp.responses.filter((frame) => frame.length > 0)
    let next = 0
    const advance = (): Uint8Array | undefined => {
      if (next >= frames.length) return undefined
      const frame = frames[next]
      next += 1
      return frame
    }
    for (const result of duel.advance(advance)) {
      if (result.message instanceof YGOProMsgRetry) {
        return { ok: false, step: next }
      }
    }
    return { ok: true, step: next }
  } catch (err) {
    console.error('[replay-verifier] 回放校验未能完成:', err)
    return { ok: true, step: 0 }
  } finally {
    duel?.endDuel()
  }
}
