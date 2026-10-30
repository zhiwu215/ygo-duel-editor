import {
  CardLocation,
  FIELD_ZONE_SEQUENCE,
  MASTER_RULES,
  PILE_LOCATIONS,
  REVERSED_PILE_LOCATIONS,
  createLightweightSnapshot,
  getPzoneSzoneSequence,
  type EngineBoardState,
  type EngineCard,
  type FieldCard,
  type InjectCommand,
  type LightweightCardSnapshot,
  type MasterRule
} from '@shared/index'
import { normalizeEngineCardPosition } from '../../utils/engineCardPosition'
import { resolveEditorId } from './identityMap'

const PZONE_SLOT_COUNT = 2
const EXTRA_MONSTER_ZONE_COUNT = 2

function monsterZoneSlotCount(masterRule: number): number {
  const info = MASTER_RULES[masterRule as MasterRule]
  return (info?.mainMonsterZoneCount ?? 5) + (info?.hasEMZ ? EXTRA_MONSTER_ZONE_COUNT : 0)
}

function spellTrapSlotCount(masterRule: number): number {
  return MASTER_RULES[masterRule as MasterRule]?.spellTrapZoneCount ?? 5
}

export interface OpeningInjectionPlacement {
  location: number
  sequence: number
  position: number
  duelistId?: string
}

export interface OpeningInjectionInput {
  opening: readonly LightweightCardSnapshot[]
  before: EngineBoardState
  after: EngineBoardState
  command: InjectCommand
  masterRule: number
  resolvePlacement?: (engineInstanceId: string) => OpeningInjectionPlacement | undefined
  duelistIdOf?: (controller: 0 | 1) => string | undefined
}

export interface OpeningInjectionResult {
  opening: LightweightCardSnapshot[]
  baked: number
  skipped: number
}

function sameSeat(left?: string, right?: string): boolean {
  return !left || !right || left === right
}

function isSeatScoped(location: number): boolean {
  return (
    location === CardLocation.HAND ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA
  )
}

function samePileSeat(location: number, left?: string, right?: string): boolean {
  return !isSeatScoped(location) || sameSeat(left, right)
}

function isOpeningPile(location: number): boolean {
  return location === CardLocation.HAND || PILE_LOCATIONS.has(location)
}

function isFieldSlot(card: { location: number; sequence: number }): boolean {
  return (
    card.location === CardLocation.FZONE ||
    (card.location === CardLocation.SZONE && card.sequence === FIELD_ZONE_SEQUENCE)
  )
}

function zoneSlotKey(location: number, sequence: number, masterRule: number): string {
  if (location === CardLocation.FZONE) return `${CardLocation.SZONE}:${FIELD_ZONE_SEQUENCE}`
  if (location === CardLocation.PZONE) {
    if (masterRule >= 4) {
      const [left, right] = getPzoneSzoneSequence(masterRule)
      return `${CardLocation.SZONE}:${sequence === 0 ? left : right}`
    }
    return `${CardLocation.PZONE}:${sequence}`
  }
  if (masterRule <= 3 && location === CardLocation.SZONE) {
    const [left, right] = getPzoneSzoneSequence(masterRule)
    if (sequence === left || sequence === right) {
      return `${CardLocation.PZONE}:${sequence - left}`
    }
  }
  return `${location}:${sequence}`
}

function isSamePile(
  card: LightweightCardSnapshot,
  location: number,
  controller: 0 | 1,
  duelistId?: string
): boolean {
  return (
    card.location === location &&
    card.controller === controller &&
    samePileSeat(location, card.duelistId, duelistId)
  )
}

function resolveDuelistId(
  card: EngineCard,
  placement: OpeningInjectionPlacement | undefined,
  duelistIdOf?: (controller: 0 | 1) => string | undefined
): string | undefined {
  return placement?.duelistId ?? card.duelistId ?? duelistIdOf?.(card.controller)
}

function buildSnapshot(
  card: EngineCard,
  location: number,
  sequence: number,
  position: number,
  duelistId?: string
): LightweightCardSnapshot {
  const fieldCard: FieldCard = {
    instanceId: card.instanceId,
    code: card.code,
    controller: card.controller,
    owner: card.owner,
    location,
    sequence,
    position,
    overlayMaterials: [...(card.overlayMaterials ?? [])],
    duelistId
  }
  return createLightweightSnapshot([fieldCard])[0]
}

function findOpeningAnchor(
  card: EngineCard,
  opening: readonly LightweightCardSnapshot[],
  after: EngineBoardState,
  location: number,
  duelistId?: string
): LightweightCardSnapshot | undefined {
  const ordered = after.allCards
    .filter(
      (candidate) =>
        candidate.location === card.location &&
        candidate.controller === card.controller &&
        samePileSeat(card.location, candidate.duelistId, card.duelistId)
    )
    .sort((left, right) => left.sequence - right.sequence)
  const index = ordered.findIndex((candidate) => candidate.instanceId === card.instanceId)
  if (index < 0) return undefined

  const candidates = REVERSED_PILE_LOCATIONS.has(card.location)
    ? ordered.slice(0, index).reverse()
    : ordered.slice(index + 1)

  for (const candidate of candidates) {
    const openingId = resolveEditorId(candidate.instanceId) ?? candidate.instanceId
    const found = opening.find(
      (entry) =>
        entry.instanceId === openingId && isSamePile(entry, location, card.controller, duelistId)
    )
    if (found) return found
  }
  return undefined
}

function insertIntoPile(
  opening: readonly LightweightCardSnapshot[],
  card: EngineCard,
  after: EngineBoardState,
  location: number,
  position: number,
  preferFront: boolean,
  duelistId?: string
): LightweightCardSnapshot[] | null {
  const anchor = findOpeningAnchor(card, opening, after, location, duelistId)
  const pile = opening
    .filter((entry) => isSamePile(entry, location, card.controller, duelistId))
    .sort((left, right) => left.sequence - right.sequence)
  const sequence = anchor
    ? anchor.sequence
    : preferFront && location === CardLocation.DECK
      ? 0
      : (pile.at(-1)?.sequence ?? -1) + 1
  const shifted = new Set(
    pile.filter((entry) => entry.sequence >= sequence).map((entry) => entry.instanceId)
  )
  const next = opening.map((entry) =>
    shifted.has(entry.instanceId) ? { ...entry, sequence: entry.sequence + 1 } : entry
  )
  next.push(buildSnapshot(card, location, sequence, position, duelistId))
  return next
}

function insertIntoSingleFieldSlot(
  opening: readonly LightweightCardSnapshot[],
  card: EngineCard,
  position: number,
  duelistId?: string
): LightweightCardSnapshot[] | null {
  const occupied = opening.some(
    (entry) => entry.controller === card.controller && isFieldSlot(entry)
  )
  if (occupied) return null
  return [
    ...opening,
    buildSnapshot(card, CardLocation.FZONE, FIELD_ZONE_SEQUENCE, position, duelistId)
  ]
}

function insertIntoZone(
  opening: readonly LightweightCardSnapshot[],
  card: EngineCard,
  location: number,
  sequence: number,
  position: number,
  masterRule: number,
  duelistId?: string
): LightweightCardSnapshot[] | null {
  const slotCount =
    location === CardLocation.MZONE
      ? monsterZoneSlotCount(masterRule)
      : location === CardLocation.SZONE
        ? spellTrapSlotCount(masterRule)
        : location === CardLocation.PZONE
          ? PZONE_SLOT_COUNT
          : 0
  if (slotCount === 0) return null
  const occupied = new Set(
    opening
      .filter((entry) => entry.controller === card.controller)
      .map((entry) => zoneSlotKey(entry.location, entry.sequence, masterRule))
  )
  const target = Math.min(Math.max(sequence, 0), slotCount - 1)
  let slot = occupied.has(zoneSlotKey(location, target, masterRule)) ? -1 : target
  if (slot < 0) {
    for (let index = 0; index < slotCount; index++) {
      if (!occupied.has(zoneSlotKey(location, index, masterRule))) {
        slot = index
        break
      }
    }
  }
  if (slot < 0) return null
  return [...opening, buildSnapshot(card, location, slot, position, duelistId)]
}

function insertInjectedCard(
  opening: readonly LightweightCardSnapshot[],
  card: EngineCard,
  after: EngineBoardState,
  masterRule: number,
  placement: OpeningInjectionPlacement | undefined,
  preferFront: boolean,
  duelistId?: string
): LightweightCardSnapshot[] | null {
  const normalized = normalizeEngineCardPosition(masterRule, card.location, card.sequence)
  const location = placement?.location ?? normalized.location
  const sequence = placement?.sequence ?? normalized.sequence
  const position = placement?.position ?? card.position

  if (isOpeningPile(location)) {
    return insertIntoPile(opening, card, after, location, position, preferFront, duelistId)
  }
  if (isFieldSlot({ location, sequence })) {
    return insertIntoSingleFieldSlot(opening, card, position, duelistId)
  }
  return insertIntoZone(opening, card, location, sequence, position, masterRule, duelistId)
}

export function applyInjectionToOpening(input: OpeningInjectionInput): OpeningInjectionResult {
  const command = input.command
  if (command.op !== 'add-card') return { opening: [...input.opening], baked: 0, skipped: 0 }
  const beforeIds = new Set(input.before.allCards.map((card) => card.instanceId))
  const knownIds = new Set(input.opening.map((card) => card.instanceId))
  const injected = input.after.allCards.filter(
    (card) =>
      !beforeIds.has(card.instanceId) &&
      !knownIds.has(card.instanceId) &&
      card.code === command.code &&
      card.controller === command.player
  )
  let opening = [...input.opening]
  let baked = 0
  let skipped = 0
  for (const card of injected) {
    const placement = input.resolvePlacement?.(card.instanceId)
    const duelistId = resolveDuelistId(card, placement, input.duelistIdOf)
    const next = insertInjectedCard(
      opening,
      card,
      input.after,
      input.masterRule,
      placement,
      command.to === 'deck-top',
      duelistId
    )
    if (!next) {
      skipped += 1
      continue
    }
    opening = next
    baked += 1
  }
  return { opening, baked, skipped }
}
