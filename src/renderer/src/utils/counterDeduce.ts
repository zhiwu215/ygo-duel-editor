import {
  CounterDefinition,
  COUNTER_DEFINITIONS,
  DuelPuzzleState,
  FieldCard,
  resolveCounterName
} from '@shared/index'

export function deduceSuggestedCounters(state: DuelPuzzleState): CounterDefinition[] {
  const suggestedMap = new Map<number, CounterDefinition>()

  for (const card of state.cards) {
    if (card.counters) {
      for (const [idStr, count] of Object.entries(card.counters)) {
        if (count > 0) {
          const id = Number(idStr)
          const def = COUNTER_DEFINITIONS.find((c) => c.id === id)
          if (def) suggestedMap.set(id, def)
        }
      }
    }
  }

  const allTextParts: string[] = []
  for (const card of state.cards) {
    if (card.card) {
      allTextParts.push(card.card.name)
      allTextParts.push(card.card.desc)
    }
  }
  const fullText = allTextParts.join(' ')

  for (const def of COUNTER_DEFINITIONS) {
    if (fullText.includes(def.name)) {
      suggestedMap.set(def.id, def)
    }
  }

  return Array.from(suggestedMap.values())
}

export function buildCounterCandidates(
  state: DuelPuzzleState,
  card: FieldCard | undefined
): CounterDefinition[] {
  if (!card) return []

  const customCounters = state.customCounters || {}
  const suggestedCounters = deduceSuggestedCounters(state)
  const activeCounterIds = new Set(
    Object.entries(card.counters || {})
      .filter(([, count]) => count > 0)
      .map(([id]) => Number(id))
  )

  return [
    ...suggestedCounters,
    ...Object.entries(customCounters)
      .map(([idStr, name]) => ({
        id: Number(idStr),
        hex: `0x${Number(idStr).toString(16)}`,
        name
      }))
      .filter((c) => !suggestedCounters.some((s) => s.id === c.id))
  ].filter((c) => !activeCounterIds.has(c.id))
}

export function listActiveCounters(
  card: FieldCard | undefined,
  customCounters: Record<number, string> | undefined
): { id: number; name: string; count: number }[] {
  if (!card) return []

  return Object.entries(card.counters || {})
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({
      id: Number(id),
      name: resolveCounterName(Number(id), customCounters),
      count
    }))
}

export function pickSelectedCounter(
  candidates: CounterDefinition[],
  userSelectedCounterId: number | null,
  customCounters: Record<number, string> | undefined
): { id: number | null; name: string } {
  const defaultCounterId = candidates.length > 0 ? candidates[0].id : null
  const selectedCounterId =
    userSelectedCounterId && candidates.some((c) => c.id === userSelectedCounterId)
      ? userSelectedCounterId
      : defaultCounterId

  const currentSelectedDef = candidates.find((c) => c.id === selectedCounterId)
  const name =
    currentSelectedDef?.name ||
    (selectedCounterId !== null
      ? resolveCounterName(selectedCounterId, customCounters)
      : '请选择指示物')

  return { id: selectedCounterId, name }
}

export function matchCounterDefinitions(query: string): CounterDefinition[] {
  return COUNTER_DEFINITIONS.filter((d) => d.name.includes(query)).slice(0, 20)
}

export function findCounterDefinitionByName(name: string): CounterDefinition | undefined {
  return COUNTER_DEFINITIONS.find((d) => d.name === name)
}
