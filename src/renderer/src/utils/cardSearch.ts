import { CdbCard } from '@shared/index'

export async function searchCardsByQuery(keyword: string, limit: number): Promise<CdbCard[]> {
  const res = await window.api.searchCards({ keyword, searchDesc: true })
  return res.cards.slice(0, limit)
}
