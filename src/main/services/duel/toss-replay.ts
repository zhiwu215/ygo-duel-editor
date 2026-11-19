import { randomUUID } from 'node:crypto'
import { setImmediate } from 'node:timers/promises'
import type { OcgcoreWrapper } from 'koishipro-core.js'
import { buildYrpSingleFile, type YrpSingleWriteOptions } from '../yrpWriter'
import { isTossPayload } from './random-control'
import { readTossReplayTrace, type TossReplayWindow } from './toss-replay-trace'

const MAX_SEEDS = 4096
const SEARCH_TIME_MS = 6000

function samePayloads(actual: Buffer[], expected: Buffer[]): boolean {
  return actual.length === expected.length && actual.every((data, i) => data.equals(expected[i]))
}

function traceMatches(trace: Iterable<TossReplayWindow>, expected: TossReplayWindow[]): boolean {
  let index = 0
  for (const window of trace) {
    const reference = expected[index++]
    if (
      !reference ||
      !samePayloads(window.tosses, reference.tosses) ||
      !samePayloads(window.messages, reference.messages)
    ) {
      return false
    }
  }
  return index === expected.length
}

export async function buildNativeTossReplay(
  wrapper: OcgcoreWrapper,
  options: YrpSingleWriteOptions,
  manualScript: string,
  nativeScript: string,
  recordedMessages: Uint8Array[]
): Promise<{ bytes: Uint8Array; script: string }> {
  const scriptName = `yde-toss-${randomUUID()}.lua`
  const probe = { ...options, scriptFile: `./single/${scriptName}` }
  const encoder = new TextEncoder()
  const responses: Uint8Array[] = []
  const expected = Array.from(
    readTossReplayTrace(
      wrapper,
      buildYrpSingleFile(probe),
      scriptName,
      encoder.encode(manualScript),
      responses
    )
  )
  const recordedTosses = recordedMessages
    .filter(isTossPayload)
    .map((payload) => Buffer.from(payload))
  if (
    !samePayloads(
      expected.flatMap((window) => window.tosses),
      recordedTosses
    )
  ) {
    throw new Error('回放开局脚本重演出的投掷结果与对局记录不符。')
  }
  if (
    !expected.some((window) => window.tosses.length) &&
    responses.length === options.responses.length
  ) {
    return { bytes: buildYrpSingleFile(options), script: manualScript }
  }

  const scriptBytes = encoder.encode(nativeScript)
  const deadline = performance.now() + SEARCH_TIME_MS
  for (let attempt = 0; attempt < MAX_SEEDS && performance.now() < deadline; attempt++) {
    if (attempt % 24 === 0 && attempt > 0) await setImmediate()
    const seed = [((options.seed[0] ?? 0) + attempt) >>> 0, ...options.seed.slice(1)]
    const candidate = buildYrpSingleFile({ ...probe, seed, responses })
    try {
      if (
        traceMatches(readTossReplayTrace(wrapper, candidate, scriptName, scriptBytes), expected)
      ) {
        return { bytes: buildYrpSingleFile({ ...options, seed, responses }), script: nativeScript }
      }
    } catch {
      continue
    }
  }
  throw new Error('标准 YRP 无法用原生投掷复现全部手动结果。可导出 MDPro3 回放保留这些结果。')
}
