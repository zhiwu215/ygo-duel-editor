import { useMemo } from 'react'
import { CdbCard } from '@shared/index'
import type { RequestCard } from '@shared/engine/protocol'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useCardDataMap } from '../../../hooks/useCardDataMap'
import { resolveCardName } from '../../../utils/cardNames'

export function useCardMeta(cards: RequestCard[]): Record<number, CdbCard> {
  const storeCards = useDuelStore((s) => s.state.cards)
  const codes = useMemo(
    () => Array.from(new Set(cards.map((c) => c.code).filter((code) => code > 0))),
    [cards]
  )
  const localMap = useMemo(() => {
    const map: Record<number, CdbCard> = {}
    for (const code of codes) {
      const hit = storeCards.find((c) => c.code === code && c.card)
      if (hit?.card) map[code] = hit.card
    }
    return map
  }, [codes, storeCards])

  const remoteCodes = useMemo(() => codes.filter((code) => !localMap[code]), [codes, localMap])
  const remoteMap = useCardDataMap(remoteCodes)

  return useMemo(() => ({ ...remoteMap, ...localMap }), [remoteMap, localMap])
}

export function cardNameOf(meta: Record<number, CdbCard>, code: number): string {
  return meta[code]?.name || resolveCardName(code)
}
