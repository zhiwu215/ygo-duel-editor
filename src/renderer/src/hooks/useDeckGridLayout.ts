import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

const CARD_ASPECT = 59 / 86
const ROW_GAP = 6
const ZONE_HEADER_H = 28
const ZONE_PADDING = 4
const ZONE_CHROME = ZONE_HEADER_H + ZONE_PADDING + 4
export const ZONE_STACK_GAP = 6
const H_SCROLLBAR_RESERVE = 10
const MAX_CARD_WIDTH = 72
const MIN_CARD_WIDTH = 22
const MIN_COLUMNS = 6
const MAX_COLUMNS = 30

interface DeckGridLayout {
  cols: number
  cardWidth: number
}

const LAYOUT_ROWS = 6

const pickLayout = (availW: number, availH: number): DeckGridLayout => {
  const budget = availH - ZONE_CHROME * 3 - ZONE_STACK_GAP * 2
  const heightCap = ((budget - ROW_GAP * (LAYOUT_ROWS - 3)) / LAYOUT_ROWS) * CARD_ASPECT
  const widthAt = (cols: number): number =>
    (availW - ZONE_PADDING * 2 - ROW_GAP * (cols - 1)) / cols
  const spanOf = (cols: number, cardWidth: number): number =>
    cols * cardWidth + ROW_GAP * (cols - 1)

  let best: DeckGridLayout | null = null
  for (let cols = MIN_COLUMNS; cols <= MAX_COLUMNS; cols++) {
    const cardWidth = Math.min(MAX_CARD_WIDTH, heightCap, widthAt(cols))
    if (cardWidth < MIN_CARD_WIDTH) continue
    if (!best || cardWidth > best.cardWidth + 0.5) {
      best = { cols, cardWidth }
      continue
    }
    if (
      cardWidth >= best.cardWidth - 0.5 &&
      spanOf(cols, cardWidth) > spanOf(best.cols, best.cardWidth)
    ) {
      best = { cols, cardWidth }
    }
  }
  return best ?? { cols: MIN_COLUMNS, cardWidth: MIN_CARD_WIDTH }
}

export function useDeckGridLayout(scrollRef: RefObject<HTMLDivElement | null>): {
  gridStyle: { gridTemplateColumns: string; gap: string }
  cardHeight: number
  gridWidth: number
} {
  const [layout, setLayout] = useState<DeckGridLayout>({ cols: 10, cardWidth: MAX_CARD_WIDTH })
  const layoutRef = useRef<DeckGridLayout>(layout)

  useLayoutEffect(() => {
    const measure = (): void => {
      const el = scrollRef.current
      if (!el) return
      const availW = el.clientWidth
      const availH = el.clientHeight - H_SCROLLBAR_RESERVE
      if (availW <= 0 || availH <= 0) return
      const next = pickLayout(availW, availH)
      const prev = layoutRef.current
      if (prev.cols === next.cols && Math.abs(prev.cardWidth - next.cardWidth) < 0.5) return
      layoutRef.current = next
      setLayout({ cols: next.cols, cardWidth: Math.round(next.cardWidth * 2) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (scrollRef.current) ro.observe(scrollRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardWidth}px)`,
      gap: `${ROW_GAP}px`
    }),
    [layout.cols, layout.cardWidth]
  )
  const cardHeight = Math.round((layout.cardWidth * 86) / 59)
  const gridWidth = layout.cols * layout.cardWidth + ROW_GAP * (layout.cols - 1)

  return { gridStyle, cardHeight, gridWidth }
}
