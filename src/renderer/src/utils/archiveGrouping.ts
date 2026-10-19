import { DuelProjectMeta, DuelType } from '@shared/index'

export type ArchiveFilter = 'all' | DuelType

export interface SeriesGroup {
  key: string
  label: string
  items: DuelProjectMeta[]
}

export const UNFILED_KEY = ''

export function buildSeriesNames(
  configSeries: string[] | undefined,
  projects: DuelProjectMeta[]
): string[] {
  const names = new Set<string>()
  for (const name of configSeries || []) {
    if (name && name.trim()) names.add(name.trim())
  }
  for (const p of projects) {
    if (p.series && p.series.trim()) names.add(p.series.trim())
  }
  return Array.from(names)
}

export function buildArchiveGroups(
  projects: DuelProjectMeta[],
  seriesNames: string[],
  activeFilter: ArchiveFilter,
  searchQuery: string
): SeriesGroup[] {
  const query = searchQuery.trim().toLowerCase()
  const matched = projects.filter((p) => {
    if (activeFilter !== 'all' && p.duelType !== activeFilter) return false
    if (!query) return true
    return (
      (p.title || '').toLowerCase().includes(query) ||
      (p.hint || '').toLowerCase().includes(query) ||
      (p.series || '').toLowerCase().includes(query)
    )
  })

  const bySeries = new Map<string, DuelProjectMeta[]>()
  for (const p of matched) {
    const key = (p.series || '').trim()
    const bucket = bySeries.get(key)
    if (bucket) bucket.push(p)
    else bySeries.set(key, [p])
  }

  const result: SeriesGroup[] = []
  for (const name of seriesNames) {
    const items = bySeries.get(name)
    if (!items && query) continue
    result.push({ key: name, label: name, items: items || [] })
  }

  const unfiled = bySeries.get(UNFILED_KEY)
  if (unfiled || !query) {
    result.push({ key: UNFILED_KEY, label: '未归类', items: unfiled || [] })
  }
  return result
}

export function formatArchiveDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}
