import { CdbCard, CardPosition } from '@shared/index'

export interface TokenSuggestion {
  token: CdbCard
  count: number | null
  position: number
}

const MIN_TOKEN_NAME_LENGTH = 2

export function tokenCatalogKey(token: CdbCard): string {
  return `${token.name}|${token.atk}|${token.def}|${token.level & 0xff}`
}

function tokenFragments(desc: string, name: string): string[] {
  return occurrenceIndices(desc, name).map((at) => {
    const start = Math.max(desc.lastIndexOf('\n', at) + 1, desc.lastIndexOf('。', at) + 1)
    const ends = [desc.indexOf('\n', at), desc.indexOf('。', at + name.length)].filter(
      (index) => index >= 0
    )
    const end = ends.length > 0 ? Math.min(...ends) : desc.length
    return desc.slice(start, end)
  })
}

function summonFragment(fragments: string[]): string | undefined {
  return fragments.find((fragment) => /特殊召唤|special summon/i.test(fragment)) ?? fragments[0]
}

function lastMatch(text: string, pattern: RegExp): RegExpExecArray | null {
  let result: RegExpExecArray | null = null
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  )
  for (const match of text.matchAll(global)) result = match
  return result
}

function tokenCount(fragment: string | undefined, name: string): number | null {
  if (!fragment || fragment.includes('数量') || /number of|or more/i.test(fragment)) return null
  const at = fragment.indexOf(name)
  const head = at >= 0 ? fragment.slice(0, at) : fragment
  const matched =
    lastMatch(head, /(\d+)\s*只/) ?? lastMatch(head, /(\d+)\s+(?:[A-Za-z'’-]+\s+){0,3}["“]?$/)
  if (!matched) return null
  const count = Number(matched[1])
  return Number.isSafeInteger(count) && count > 0 ? count : null
}

function tokenPosition(fragment: string | undefined): number {
  if (!fragment) return CardPosition.FACEUP_ATTACK
  if (fragment.includes('守备表示') || /defen[cs]e position/i.test(fragment)) {
    return CardPosition.FACEUP_DEFENSE
  }
  return CardPosition.FACEUP_ATTACK
}

function occurrenceIndices(desc: string, text: string): number[] {
  const indices: number[] = []
  let from = 0
  while (from <= desc.length) {
    const at = desc.indexOf(text, from)
    if (at < 0) break
    indices.push(at)
    from = at + 1
  }
  return indices
}

function isShadowedByLongerName(desc: string, name: string, names: string[]): boolean {
  const occurrences = occurrenceIndices(desc, name)
  if (occurrences.length === 0) return false
  return occurrences.every((at) => {
    const end = at + name.length
    return names.some((other) => {
      if (other.length <= name.length) return false
      return occurrenceIndices(desc, other).some(
        (otherAt) => otherAt <= at && end <= otherAt + other.length
      )
    })
  })
}

export function matchTokenSuggestions(catalog: CdbCard[], source: CdbCard): TokenSuggestion[] {
  const sourceName = String(source.name ?? '').trim()
  const desc = String(source.desc ?? '')
  const collected = new Map<string, { token: CdbCard; index: number }>()
  const referenced = new Set<string>()

  const collect = (token: CdbCard): void => {
    const key = tokenCatalogKey(token)
    if (collected.has(key)) return
    collected.set(key, { token, index: desc.indexOf(String(token.name ?? '')) })
  }

  if (sourceName.length >= MIN_TOKEN_NAME_LENGTH) {
    const reference = `「${sourceName}」`
    for (const token of catalog) {
      if (!String(token.desc ?? '').includes(reference)) continue
      referenced.add(tokenCatalogKey(token))
      collect(token)
    }
  }

  const nameHits =
    desc.length > 0
      ? catalog.filter((token) => {
          const name = String(token.name ?? '')
          return name.length >= MIN_TOKEN_NAME_LENGTH && desc.includes(name)
        })
      : []
  const hitNames = [...new Set(nameHits.map((token) => String(token.name ?? '')))]

  for (const token of nameHits) {
    if (referenced.has(tokenCatalogKey(token))) continue
    const name = String(token.name ?? '')
    if (isShadowedByLongerName(desc, name, hitNames)) continue
    collect(token)
  }

  return [...collected.values()]
    .sort((left, right) => {
      const leftIndex = left.index < 0 ? Number.MAX_SAFE_INTEGER : left.index
      const rightIndex = right.index < 0 ? Number.MAX_SAFE_INTEGER : right.index
      return leftIndex === rightIndex ? left.token.id - right.token.id : leftIndex - rightIndex
    })
    .map(({ token }) => {
      const name = String(token.name ?? '')
      const fragment = summonFragment(tokenFragments(desc, name))
      return {
        token,
        count: tokenCount(fragment, name),
        position: tokenPosition(fragment)
      }
    })
}

export function filterTokenCatalog(catalog: CdbCard[], query: string): CdbCard[] {
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return []
  const seen = new Set<string>()
  const matched: CdbCard[] = []
  for (const token of catalog) {
    if (
      !String(token.name ?? '')
        .toLocaleLowerCase()
        .includes(keyword)
    )
      continue
    const key = tokenCatalogKey(token)
    if (seen.has(key)) continue
    seen.add(key)
    matched.push(token)
  }
  return matched.sort((left, right) => {
    const byName = String(left.name ?? '').localeCompare(String(right.name ?? ''), 'zh')
    return byName === 0 ? left.id - right.id : byName
  })
}
