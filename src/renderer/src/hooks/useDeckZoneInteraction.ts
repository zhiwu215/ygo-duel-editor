import { useEffect, useRef } from 'react'
import { useDuelStore } from '../stores/useDuelStore'

export function useDeckZoneInteraction(controller: 0 | 1): {
  cancelDeckDraw: () => void
  scheduleDeckDraw: () => void
} {
  const executeDrawCard = useDuelStore((s) => s.executeDrawCard)
  const deckDrawTimer = useRef<number | null>(null)

  const cancelDeckDraw = (): void => {
    if (deckDrawTimer.current !== null) {
      window.clearTimeout(deckDrawTimer.current)
      deckDrawTimer.current = null
    }
  }

  const scheduleDeckDraw = (): void => {
    cancelDeckDraw()
    deckDrawTimer.current = window.setTimeout(() => {
      deckDrawTimer.current = null
      executeDrawCard(controller)
    }, 240)
  }

  useEffect(() => {
    return () => {
      if (deckDrawTimer.current !== null) window.clearTimeout(deckDrawTimer.current)
    }
  }, [])

  return { cancelDeckDraw, scheduleDeckDraw }
}
