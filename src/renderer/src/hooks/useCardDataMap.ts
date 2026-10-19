import { useEffect, useRef, useState } from 'react'
import { CdbCard } from '@shared/index'
import { fetchCardDataByCodes } from '../utils/cardData'

export function useCardDataMap(codes: number[]): Record<number, CdbCard> {
  const [cardDataMap, setCardDataMap] = useState<Record<number, CdbCard>>({})
  const pendingCodesRef = useRef<Set<number>>(new Set())
  const unknownCodesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const missingCodes = Array.from(
      new Set(
        codes.filter(
          (code) =>
            code > 0 &&
            !cardDataMap[code] &&
            !pendingCodesRef.current.has(code) &&
            !unknownCodesRef.current.has(code)
        )
      )
    )
    if (missingCodes.length === 0) return
    for (const code of missingCodes) pendingCodesRef.current.add(code)

    fetchCardDataByCodes(missingCodes)
      .then((map) => {
        for (const code of missingCodes) {
          pendingCodesRef.current.delete(code)
          if (!map[code]) unknownCodesRef.current.add(code)
        }
        setCardDataMap((prev) => {
          const next = { ...prev }
          let changed = false
          for (const code of missingCodes) {
            const cardData = map[code]
            if (cardData && !next[code]) {
              next[code] = cardData
              changed = true
            }
          }
          return changed ? next : prev
        })
      })
      .catch((err) => {
        for (const code of missingCodes) pendingCodesRef.current.delete(code)
        void err
      })
  }, [codes, cardDataMap])

  return cardDataMap
}
