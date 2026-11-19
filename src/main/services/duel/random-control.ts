import {
  ASK_REGISTRY_KEY,
  CONTROL_SCRIPT,
  TOSS_REGISTRY_KEY
} from '@shared/engine/randomControlScript'
import type { OcgcoreDuel } from 'koishipro-core.js'
import {
  OcgcoreScriptConstants,
  YGOProMsgAnnounceNumber,
  YGOProMsgHint,
  YGOProMsgSelectOption,
  YGOProMsgTossCoin,
  YGOProMsgTossDice,
  type YGOProMsgBase
} from 'ygopro-msg-encode'
import { configService } from '../configService'

export const RANDOM_CONTROL_SCRIPT_PATH = './yde/random_control.lua'

const encoder = new TextEncoder()

function normalizeScriptPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^script\//, '')
}

export function readRandomControlScript(scriptPath: string): Uint8Array | null {
  if (normalizeScriptPath(scriptPath) !== 'yde/random_control.lua') return null
  return encoder.encode(CONTROL_SCRIPT)
}

export function preloadRandomControl(duel: OcgcoreDuel): void {
  duel.preloadScript(RANDOM_CONTROL_SCRIPT_PATH)
}

export function isManualRandomEnabled(): boolean {
  return configService.get().duelTestSettings?.engineRandom === 'off'
}

export interface RecordedToss {
  type: 'coin' | 'dice'
  player: number
  results: number[]
}

export function recordedTossMessage(toss: RecordedToss): YGOProMsgTossCoin | YGOProMsgTossDice {
  const message = toss.type === 'coin' ? new YGOProMsgTossCoin() : new YGOProMsgTossDice()
  message.player = toss.player
  message.results = toss.results
  message.count = toss.results.length
  return message
}

export function manualTossHintType(request: unknown): number | undefined {
  if (request instanceof YGOProMsgSelectOption) return OcgcoreScriptConstants.HINT_OPSELECTED
  if (request instanceof YGOProMsgAnnounceNumber) return OcgcoreScriptConstants.HINT_NUMBER
  return undefined
}

export function manualTossHintIndex(messages: YGOProMsgBase[], hintType: number): number {
  return messages.findIndex((msg) => msg instanceof YGOProMsgHint && msg.type === hintType)
}

export function isTossPayload(payload: Uint8Array): boolean {
  return payload[0] === YGOProMsgTossCoin.identifier || payload[0] === YGOProMsgTossDice.identifier
}

export function readRecordedTosses(duel: OcgcoreDuel): RecordedToss[] {
  let text = ''
  try {
    text = duel.getRegistryValue(TOSS_REGISTRY_KEY).text ?? ''
  } catch {
    return []
  }
  if (!text) return []
  duel.setRegistryValue(TOSS_REGISTRY_KEY, '')
  const tosses: RecordedToss[] = []
  for (const entry of text.split('\n')) {
    const [type, player, values] = entry.split(':')
    if ((type !== 'coin' && type !== 'dice') || !values) continue
    const results = values.split(',').map(Number)
    if (results.some((value) => !Number.isFinite(value))) continue
    tosses.push({ type, player: Number(player), results })
  }
  return tosses
}

export function isRandomAskPending(duel: OcgcoreDuel): boolean {
  try {
    const text = duel.getRegistryValue(ASK_REGISTRY_KEY).text ?? ''
    if (!text) return false
    duel.setRegistryValue(ASK_REGISTRY_KEY, '')
    return true
  } catch {
    return false
  }
}
