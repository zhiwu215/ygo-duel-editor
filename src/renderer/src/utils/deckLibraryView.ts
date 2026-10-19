import { DeckData, groupAncestorPaths, groupParentPath } from '@shared/index'

export const getUngroupedCount = (deckList: DeckData[]): number =>
  deckList.filter((d) => !d.group?.trim()).length

export const getDeckCoverCode = (deck: DeckData): number | undefined => {
  if (deck.coverCard) return deck.coverCard
  if (deck.extra && deck.extra.length > 0) return deck.extra[0]
  if (deck.main && deck.main.length > 0) return deck.main[0]
  return undefined
}

export const getGroupCounts = (deckList: DeckData[]): Map<string, number> => {
  const map = new Map<string, number>()
  for (const d of deckList) {
    const g = d.group?.trim()
    if (!g) continue
    for (const path of groupAncestorPaths(g)) {
      map.set(path, (map.get(path) || 0) + 1)
    }
  }
  return map
}

export const getSearchMatchedDecks = (deckList: DeckData[], keyword: string): DeckData[] | null => {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return null
  return deckList.filter((deck) => {
    const matchName = deck.name.toLowerCase().includes(kw)
    const matchDesc = deck.description?.toLowerCase().includes(kw)
    const matchGroup = deck.group?.toLowerCase().includes(kw)
    const matchTag = deck.tags?.some((t) => t.toLowerCase().includes(kw))
    return Boolean(matchName || matchDesc || matchGroup || matchTag)
  })
}

export const getVisibleDecks = (
  deckList: DeckData[],
  selectedGroup: string | null,
  searchMatchedDecks: DeckData[] | null
): DeckData[] => {
  const source = searchMatchedDecks ?? deckList
  if (selectedGroup === null) return source.filter((d) => !d.group?.trim())
  return source.filter((d) => d.group?.trim() === selectedGroup)
}

export const getVisibleGroups = (
  deckGroups: string[],
  selectedGroup: string | null,
  searchMatchedDecks: DeckData[] | null
): string[] => {
  const pool = deckGroups.filter((g) =>
    selectedGroup === null ? groupParentPath(g) === null : groupParentPath(g) === selectedGroup
  )
  if (!searchMatchedDecks) return pool
  const hit = new Set<string>()
  for (const d of searchMatchedDecks) {
    const g = d.group?.trim()
    if (!g) continue
    for (const path of groupAncestorPaths(g)) {
      hit.add(path)
    }
  }
  return pool.filter((g) => hit.has(g))
}

export const getGroupBreadcrumb = (selectedGroup: string | null): string[] =>
  selectedGroup ? groupAncestorPaths(selectedGroup) : []

export const getGroupSiblings = (
  deckList: DeckData[],
  group: string
): Array<DeckData & { id: string }> =>
  deckList.filter((d): d is DeckData & { id: string } => (d.group ?? '') === group && !!d.id)

export const pickNextDeckAfterDelete = (
  siblings: Array<DeckData & { id: string }>,
  deckId: string,
  remaining: Array<DeckData & { id: string }>
): (DeckData & { id: string }) | null => {
  if (remaining.length === 0) return null
  const index = siblings.findIndex((d) => d.id === deckId)
  return remaining[Math.min(Math.max(index, 0), remaining.length - 1)]
}
