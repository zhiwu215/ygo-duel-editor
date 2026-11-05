import type { OcgcoreDuel } from 'koishipro-core.js'
import { configService } from '../configService'

export const RANDOM_CONTROL_SCRIPT_PATH = './yde/random_control.lua'

const TOSS_REGISTRY_KEY = 'yde_random_toss'
const ASK_REGISTRY_KEY = 'yde_random_ask'

const CONTROL_SCRIPT = `
local unpack_values = table.unpack or unpack

local function record_toss(kind, values)
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${TOSS_REGISTRY_KEY}', kind .. ':' .. table.concat(values, ','))
	end
end

local function mark_ask()
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${ASK_REGISTRY_KEY}', '1')
	end
end

local function clear_ask()
	if Duel.SetRegistryValue then
		Duel.SetRegistryValue('${ASK_REGISTRY_KEY}', '')
	end
end

local original_random_select = Group.RandomSelect
function Group:RandomSelect(tp, count)
	if count > 0 and self:GetCount() > count then
		mark_ask()
		local chosen = self:Select(tp, count, count, nil)
		clear_ask()
		if chosen and chosen:GetCount() == count then
			return chosen
		end
	end
	return original_random_select(self, tp, count)
end

local original_toss_coin = Duel.TossCoin
function Duel.TossCoin(tp, count)
	local results = {}
	for i = 1, count do
		mark_ask()
		local choice = Duel.SelectOption(tp, 60, 61)
		clear_ask()
		if choice == 0 then
			results[i] = 1
		else
			results[i] = 0
		end
	end
	record_toss('coin', results)
	return unpack_values(results)
end

local original_toss_dice = Duel.TossDice
function Duel.TossDice(tp, count1, count2)
	local total = count1 + (count2 or 0)
	local results = {}
	for i = 1, total do
		mark_ask()
		results[i] = Duel.AnnounceNumber(tp, 1, 2, 3, 4, 5, 6)
		clear_ask()
	end
	record_toss('dice', results)
	return unpack_values(results)
end
`

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
  const [kind, values] = text.split(':')
  if ((kind !== 'coin' && kind !== 'dice') || !values) return null
  const results = values.split(',').map((value) => Number(value))
  if (results.some((value) => !Number.isFinite(value))) return null
  return { type: kind, results }
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
