import type { OcgcoreDuel, ScriptReader } from 'koishipro-core.js'
import type { FieldCard } from '@shared/index'
import { buildInitialOverlayPlacements } from '@shared/engine/initialOverlayPlacements'

const MR3_SCRIPT_PATH = 'yde/initial_mr3.lua'
const MR3_SCRIPT = new TextEncoder().encode('Debug.ReloadFieldBegin(0, 3)')

export function prepareMr3PendulumZones(duel: OcgcoreDuel): void {
  duel.preloadScript(`./${MR3_SCRIPT_PATH}`)
}

const SCRIPT_PATH = 'yde/initial_overlay.lua'
const REGISTRY_KEY = 'yde_initial_overlay'
const SCRIPT = new TextEncoder().encode(`
local placements = Duel.GetRegistryValue('${REGISTRY_KEY}') or ''
for code, owner, player, location, sequence, position in placements:gmatch('(%d+),(%d+),(%d+),(%d+),(%d+),(%d+)') do
  Debug.AddCard(tonumber(code), tonumber(owner), tonumber(player), tonumber(location), tonumber(sequence), tonumber(position))
end
`)

export const readInitialOverlayScript: ScriptReader = (path) => {
  const normalized = path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^script\//, '')
  if (normalized === MR3_SCRIPT_PATH) return MR3_SCRIPT
  return normalized === SCRIPT_PATH ? SCRIPT : null
}

export function restoreInitialOverlay(duel: OcgcoreDuel, card: FieldCard): void {
  const placements = buildInitialOverlayPlacements(card)
  addInitialDebugCards(duel, placements)
}

export function addInitialDebugCards(
  duel: OcgcoreDuel,
  placements: ReturnType<typeof buildInitialOverlayPlacements>
): void {
  if (placements.length === 0) return
  duel.setRegistryValue(
    REGISTRY_KEY,
    placements
      .map(({ code, owner, player, location, sequence, position }) =>
        [code, owner, player, location, sequence, position].join(',')
      )
      .join(';')
  )
  duel.preloadScript(`./${SCRIPT_PATH}`)
  duel.setRegistryValue(REGISTRY_KEY, '')
}
