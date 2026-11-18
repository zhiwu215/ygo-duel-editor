import type { OcgcoreDuel } from 'koishipro-core.js'
import type { FieldCard } from '@shared/index'
import { buildInitialOverlayPlacements } from '@shared/engine/initialOverlayPlacements'
import {
  INITIAL_MR3_PATH,
  INITIAL_OVERLAY_KEY,
  INITIAL_OVERLAY_PATH
} from './initial-field-scripts'

export function prepareMr3PendulumZones(duel: OcgcoreDuel): void {
  duel.preloadScript(`./${INITIAL_MR3_PATH}`)
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
    INITIAL_OVERLAY_KEY,
    placements
      .map(({ code, owner, player, location, sequence, position }) =>
        [code, owner, player, location, sequence, position].join(',')
      )
      .join(';')
  )
  duel.preloadScript(`./${INITIAL_OVERLAY_PATH}`)
  duel.setRegistryValue(INITIAL_OVERLAY_KEY, '')
}
