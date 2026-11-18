import { createDuelFromYrp, type OcgcoreWrapper } from 'koishipro-core.js'
import { YGOProMsgRetry } from 'ygopro-msg-encode'

export type ReplayVerification =
  | { status: 'verified'; step: number }
  | { status: 'mismatch' | 'incomplete'; step: number; reason: string }

export function verifyYrpReplay(wrapper: OcgcoreWrapper, yrpBytes: Uint8Array): ReplayVerification {
  let duel: ReturnType<typeof createDuelFromYrp>['duel'] | null = null
  let next = 0
  try {
    const created = createDuelFromYrp(wrapper, yrpBytes)
    duel = created.duel
    const frames = created.yrp.responses.filter((frame) => frame.length > 0)
    const advance = (): Uint8Array | undefined => {
      if (next >= frames.length) return undefined
      const frame = frames[next]
      next += 1
      return frame
    }
    for (const result of duel.advance(advance)) {
      if (result.message instanceof YGOProMsgRetry) {
        return { status: 'mismatch', step: next, reason: '引擎拒绝了已记录的应答。' }
      }
    }
    if (next !== frames.length) {
      return { status: 'mismatch', step: next, reason: '回放提前结束，仍有应答未使用。' }
    }
    return { status: 'verified', step: next }
  } catch (err) {
    console.error('[replay-verifier] 回放校验未能完成:', err)
    return {
      status: 'incomplete',
      step: next,
      reason: err instanceof Error ? err.message : String(err)
    }
  } finally {
    duel?.endDuel()
  }
}
