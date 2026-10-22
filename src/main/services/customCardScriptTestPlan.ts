import type {
  CustomScriptTestCheck,
  CustomScriptTestLocation,
  CustomScriptTestPlan,
  CustomScriptTestPosition,
  CustomScriptTestResponse,
  CustomScriptTestSetupCard
} from '@shared/index'

const LOCATIONS: Record<CustomScriptTestLocation, number> = {
  deck: 0x01,
  hand: 0x02,
  mzone: 0x04,
  szone: 0x08,
  grave: 0x10,
  removed: 0x20,
  extra: 0x40
}

const POSITIONS: Record<CustomScriptTestPosition, number> = {
  faceup_attack: 0x01,
  facedown_attack: 0x02,
  faceup_defense: 0x04,
  facedown_defense: 0x08
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toInteger(value: unknown): number | null {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function normalizeLocation(value: unknown): CustomScriptTestLocation {
  const text = String(value ?? 'hand').trim()
  return text in LOCATIONS ? (text as CustomScriptTestLocation) : 'hand'
}

function normalizePosition(value: unknown): CustomScriptTestPosition {
  const text = String(value ?? 'faceup_attack').trim()
  return text in POSITIONS ? (text as CustomScriptTestPosition) : 'faceup_attack'
}

function normalizeCheck(value: unknown): CustomScriptTestCheck | null {
  if (!isRecord(value)) return null
  const kind = String(value.kind ?? '').trim()
  if (kind === 'load-script') {
    const code = toInteger(value.code)
    return { kind, ...(code && code > 0 ? { code } : {}) }
  }
  if (kind === 'start-duel') return { kind }
  if (kind === 'assert-no-redtext') return { kind }
  if (kind === 'advance') {
    return { kind, maxSteps: Math.max(1, Math.min(500, toInteger(value.maxSteps) ?? 80)) }
  }
  if (kind === 'assert-lp') {
    const equals = Number(value.equals)
    if (!Number.isFinite(equals)) return null
    return { kind, player: Number(value.player) === 1 ? 1 : 0, equals }
  }
  if (kind === 'assert-field-count') {
    const equals = value.equals == null ? undefined : Number(value.equals)
    const min = value.min == null ? undefined : Number(value.min)
    const max = value.max == null ? undefined : Number(value.max)
    if (
      (equals !== undefined && !Number.isFinite(equals)) ||
      (min !== undefined && !Number.isFinite(min)) ||
      (max !== undefined && !Number.isFinite(max))
    ) {
      return null
    }
    return {
      kind,
      player: Number(value.player) === 1 ? 1 : 0,
      location: normalizeLocation(value.location),
      ...(equals !== undefined ? { equals } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {})
    }
  }
  return null
}

function normalizeResponse(value: unknown): CustomScriptTestResponse | null {
  if (!isRecord(value)) return null
  const kind = String(value.kind ?? '').trim()
  if (kind === 'select-card') {
    const cards = (Array.isArray(value.cards) ? value.cards : []).filter(isRecord).map((card) => {
      const index = toInteger(card.index)
      const code = toInteger(card.code)
      const sequence = toInteger(card.sequence)
      const controller: 0 | 1 | undefined =
        card.controller === 0 ? 0 : card.controller === 1 ? 1 : undefined
      return {
        ...(index !== null && index >= 0 ? { index } : {}),
        ...(code !== null && code > 0 ? { code } : {}),
        ...(controller !== undefined ? { controller } : {}),
        ...(card.location !== undefined ? { location: normalizeLocation(card.location) } : {}),
        ...(sequence !== null && sequence >= 0 ? { sequence } : {})
      }
    })
    return cards.length > 0 ? { kind, cards } : null
  }
  if (kind === 'yes-no') return { kind, value: Boolean(value.value) }
  if (kind === 'chain') {
    const index = toInteger(value.index)
    const code = toInteger(value.code)
    return {
      kind,
      ...(index !== null && index >= -1 ? { index } : {}),
      ...(code !== null && code > 0 ? { code } : {})
    }
  }
  if (kind === 'option') {
    const index = toInteger(value.index)
    return index !== null && index >= 0 ? { kind, index } : null
  }
  if (kind === 'position') return { kind, position: normalizePosition(value.position) }
  return null
}

function normalizeResponses(value: unknown): CustomScriptTestResponse[] {
  return (Array.isArray(value) ? value : [])
    .map(normalizeResponse)
    .filter((item): item is CustomScriptTestResponse => item !== null)
}

export function defaultCustomCardScriptTestPlan(cardCode: number): CustomScriptTestPlan {
  return {
    version: 1,
    cardCode,
    seed: 42,
    includeScripts: [],
    setup: [
      {
        code: cardCode,
        controller: 0,
        owner: 0,
        location: 'hand',
        sequence: 0,
        position: 'faceup_attack'
      }
    ],
    checks: [
      { kind: 'load-script' },
      { kind: 'assert-no-redtext' },
      { kind: 'start-duel' },
      { kind: 'advance', maxSteps: 80 },
      { kind: 'assert-no-redtext' }
    ]
  }
}

export function normalizeCustomCardScriptTestPlan(
  value: unknown,
  fallbackCardCode: number
): CustomScriptTestPlan {
  const input = isRecord(value) ? value : {}
  const code = toInteger(input.cardCode) ?? fallbackCardCode
  if (!code || code <= 0) throw new Error('测试计划缺少卡片卡密。')

  const includeScripts = Array.isArray(input.includeScripts)
    ? input.includeScripts
        .map((item) => String(item ?? '').trim())
        .filter((item) => /\.lua$/i.test(item))
    : []
  const setup = (Array.isArray(input.setup) ? input.setup : [])
    .filter(isRecord)
    .map((item) => {
      const cardCode = toInteger(item.code)
      if (!cardCode || cardCode <= 0) return null
      return {
        code: cardCode,
        controller: Number(item.controller) === 1 ? 1 : 0,
        owner: Number(item.owner) === 1 ? 1 : 0,
        location: normalizeLocation(item.location),
        sequence: Math.max(0, toInteger(item.sequence) ?? 0),
        position: normalizePosition(item.position)
      }
    })
    .filter((item) => item !== null) as CustomScriptTestSetupCard[]

  const checks = (Array.isArray(input.checks) ? input.checks : [])
    .map(normalizeCheck)
    .filter((item): item is CustomScriptTestCheck => item !== null)
  const responses = normalizeResponses(input.responses)

  return {
    version: 1,
    cardCode: code,
    seed:
      typeof input.seed === 'number' || Array.isArray(input.seed)
        ? (input.seed as number | number[])
        : 42,
    includeScripts: [
      ...new Set([`c${code}.lua`, ...includeScripts, ...setup.map((item) => `c${item.code}.lua`)])
    ],
    setup,
    ...(responses.length > 0 ? { responses } : {}),
    checks:
      checks.length > 0
        ? checks
        : [
            { kind: 'load-script' },
            { kind: 'assert-no-redtext' },
            { kind: 'start-duel' },
            { kind: 'advance', maxSteps: 80 },
            { kind: 'assert-no-redtext' }
          ]
  }
}

export function resolveScriptTestLocation(value: CustomScriptTestLocation): number {
  return LOCATIONS[value] ?? LOCATIONS.hand
}

export function resolveScriptTestPosition(value: CustomScriptTestPosition): number {
  return POSITIONS[value] ?? POSITIONS.faceup_attack
}
