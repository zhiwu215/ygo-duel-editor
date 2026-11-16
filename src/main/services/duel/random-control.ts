import {
  ASK_REGISTRY_KEY,
  CONTROL_SCRIPT,
  TOSS_REGISTRY_KEY
} from '@shared/engine/randomControlScript'
import type { OcgcoreDuel } from 'koishipro-core.js'
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

export function readRecordedToss(duel: OcgcoreDuel): RecordedToss | null {
  let text = ''
  try {
    text = duel.getRegistryValue(TOSS_REGISTRY_KEY).text ?? ''
  } catch {
    return null
  }
  if (!text) return null
  duel.setRegistryValue(TOSS_REGISTRY_KEY, '')
  const [kind, player, values] = text.split(':')
  if ((kind !== 'coin' && kind !== 'dice') || !values) return null
  const results = values.split(',').map((value) => Number(value))
  if (results.some((value) => !Number.isFinite(value))) return null
  return { type: kind, player: Number(player), results }
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
