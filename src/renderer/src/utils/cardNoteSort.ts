import { CardNoteEntry, CardNoteKind, CustomCard } from '@shared/index'

export type EntryFilterId = 'all' | 'custom' | 'library'

export interface DisplayEntry extends CardNoteEntry {
  isCustom?: boolean
}

export function parseSortId(id: string): { kind: CardNoteKind; title: string } | null {
  const sep = id.indexOf('::')
  if (sep <= 0) return null
  const k = id.slice(0, sep)
  if (k !== 'chant' && k !== 'note') return null
  return { kind: k as CardNoteKind, title: id.slice(sep + 2) }
}

export function buildSortId(kind: CardNoteKind, title: string): string {
  return `${kind}::${title}`
}

export function buildDisplayEntries(
  entries: CardNoteEntry[],
  customCards: CustomCard[]
): DisplayEntry[] {
  const customCardById = new Map(customCards.map((c) => [c.id, c]))
  const regular: DisplayEntry[] = []
  const customs: DisplayEntry[] = []
  for (const entry of entries) {
    const custom = customCardById.get(entry.cardCode)
    if (custom) {
      customs.push({ ...entry, cardName: custom.name, isCustom: true })
    } else {
      regular.push(entry)
    }
  }
  for (const card of customCards) {
    if (!customs.some((e) => e.cardCode === card.id)) {
      customs.push({
        cardCode: card.id,
        cardName: card.name,
        variantCodes: [],
        chants: [],
        notes: [],
        isCustom: true
      })
    }
  }
  return [...regular, ...customs]
}

export function filterDisplayEntries(
  displayEntries: DisplayEntry[],
  search: string,
  originFilter: EntryFilterId
): DisplayEntry[] {
  return displayEntries.filter((e) => {
    if (originFilter === 'custom' && !e.isCustom) return false
    if (originFilter === 'library' && e.isCustom) return false
    if (!search.trim()) return true
    const kw = search.trim().toLowerCase()
    return (
      e.cardName.toLowerCase().includes(kw) ||
      String(e.cardCode).includes(kw) ||
      e.chants.some((c) => c.title.toLowerCase().includes(kw) || c.text.toLowerCase().includes(kw))
    )
  })
}
