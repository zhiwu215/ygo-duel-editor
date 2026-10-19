import { CdbCard } from '@shared/index'

export async function searchCardsByQuery(keyword: string, limit: number): Promise<CdbCard[]> {
  const res = /^\d+$/.test(keyword)
    ? await window.api.searchCards({ code: Number(keyword) })
    : await window.api.searchCards({ keyword, searchDesc: true })
  return res.cards.slice(0, limit)
}
