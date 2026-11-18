import type { ScriptReader } from 'koishipro-core.js'
import { INITIAL_MONSTER_CONTROL_SCRIPT } from '@shared/engine/initialMonsterControl'

export const INITIAL_MONSTER_CONTROL_PATH = 'yde/initial_monster_control.lua'
export const INITIAL_MR3_PATH = 'yde/initial_mr3.lua'
export const INITIAL_OVERLAY_PATH = 'yde/initial_overlay.lua'
export const INITIAL_OVERLAY_KEY = 'yde_initial_overlay'

const encoder = new TextEncoder()
const scripts = new Map([
  [INITIAL_MONSTER_CONTROL_PATH, encoder.encode(INITIAL_MONSTER_CONTROL_SCRIPT)],
  [INITIAL_MR3_PATH, encoder.encode('Debug.ReloadFieldBegin(0, 3)')],
  [
    INITIAL_OVERLAY_PATH,
    encoder.encode(`
local placements = Duel.GetRegistryValue('${INITIAL_OVERLAY_KEY}') or ''
for code, owner, player, location, sequence, position in placements:gmatch('(%d+),(%d+),(%d+),(%d+),(%d+),(%d+)') do
  Debug.AddCard(tonumber(code), tonumber(owner), tonumber(player), tonumber(location), tonumber(sequence), tonumber(position))
end
`)
  ]
])

export const readInitialFieldScript: ScriptReader = (path) => {
  const normalized = path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^script\//, '')
  return scripts.get(normalized) ?? null
}
