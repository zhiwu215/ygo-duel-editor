import { createDuelFromYrp, type OcgcoreWrapper, type ScriptReader } from 'koishipro-core.js'
import {
  YGOProMsgResponseBase,
  YGOProMsgRetry,
  YGOProMsgTossCoin,
  YGOProMsgTossDice
} from 'ygopro-msg-encode'
import {
  isRandomAskPending,
  manualTossHintIndex,
  manualTossHintType,
  readRecordedTosses,
  recordedTossMessage
} from './random-control'

export interface TossReplayWindow {
  messages: Buffer[]
  tosses: Buffer[]
}

export function* readTossReplayTrace(
  wrapper: OcgcoreWrapper,
  replay: Uint8Array,
  scriptName: string,
  script: Uint8Array,
  retainedResponses?: Uint8Array[]
): Generator<TossReplayWindow> {
  const reader: ScriptReader = (path) => (path.endsWith(`/${scriptName}`) ? script : null)
  wrapper.scriptReaders.unshift(reader)
  try {
    const { duel, yrp } = createDuelFromYrp(wrapper, replay)
    try {
      let next = 0
      let tossHint: number | undefined
      let messages: Buffer[] = []
      let tosses: Buffer[] = []
      for (let loop = 0; loop < 100000; loop++) {
        const result = duel.process()
        const batch = result.messages ?? []
        if (batch.some((message) => message instanceof YGOProMsgRetry)) {
          throw new Error('引擎拒绝了回放应答。')
        }

        const hintIndex = tossHint === undefined ? -1 : manualTossHintIndex(batch, tossHint)
        if (hintIndex >= 0) tossHint = undefined
        const query = batch.find((message) => message instanceof YGOProMsgResponseBase)
        const manualToss = query && isRandomAskPending(duel) ? manualTossHintType(query) : undefined
        for (const recorded of readRecordedTosses(duel)) {
          tosses.push(Buffer.from(recordedTossMessage(recorded).toPayload()))
        }
        let parsedLength = 0
        for (const [index, message] of batch.entries()) {
          const bytes = message.toPayload()
          parsedLength += bytes.length
          if (index === hintIndex || (manualToss !== undefined && message === query)) continue
          const payload = Buffer.from(bytes)
          if (message instanceof YGOProMsgTossCoin || message instanceof YGOProMsgTossDice) {
            tosses.push(payload)
          } else {
            messages.push(payload)
          }
        }
        if (parsedLength !== result.raw.length) throw new Error('回放消息解析不完整。')

        if (query || result.status === 2 || duel.ended) {
          const response = query ? yrp.responses[next] : undefined
          if (manualToss === undefined || !response) {
            yield { messages, tosses }
            messages = []
            tosses = []
          }
          if (!response) {
            if (next !== yrp.responses.length) throw new Error('回放提前结束，仍有应答未使用。')
            return
          }
          if (manualToss === undefined) retainedResponses?.push(response)
          tossHint = manualToss
          next++
          duel.setResponse(response)
        }
      }
      throw new Error('回放超过引擎推进步数上限。')
    } finally {
      duel.endDuel()
    }
  } finally {
    wrapper.scriptReaders.splice(wrapper.scriptReaders.indexOf(reader), 1)
  }
}
