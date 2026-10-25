import { duelSession } from '../../src/main/services/duel/duel-session'
import { autoAnswer } from './autoAnswer'

export async function settleToIdle(limit = 80): Promise<void> {
  let guard = 0
  while (duelSession.getPendingRequest()?.kind !== 'idle' && guard++ < limit) {
    const pending = duelSession.getPendingRequest()
    if (!pending) throw new Error('引擎没有待答请求')
    const res = duelSession.submitAnswer(autoAnswer(pending))
    if (res.retry) throw new Error('引擎拒绝了自动回答')
  }
  if (duelSession.getPendingRequest()?.kind !== 'idle') {
    throw new Error('未能推进到 idle')
  }
}
