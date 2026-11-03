import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { hasCardDragData } from '../utils/cardDrag'

export type PileDropIndicator = 'before' | 'after'

interface ExternalCardDropOptions {
  enabled: boolean
  onDrop: (event: DragEvent<HTMLElement>, insertIndex: number) => void
}

interface ExternalCardDropController {
  handleDragOver: (event: DragEvent<HTMLElement>, index: number) => void
  handleDrop: (event: DragEvent<HTMLElement>, index: number) => void
  handleDragLeave: (event: DragEvent<HTMLElement>) => void
  indicatorAt: (index: number, total: number) => PileDropIndicator | null
}

const resolveInsertIndex = (event: DragEvent<HTMLElement>, index: number): number => {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX >= rect.left + rect.width / 2 ? index + 1 : index
}

export function useExternalCardDrop({
  enabled,
  onDrop
}: ExternalCardDropOptions): ExternalCardDropController {
  const [insertedAt, setInsertedAt] = useState<number | null>(null)

  useEffect(() => {
    if (insertedAt === null) return
    const clear = (): void => setInsertedAt(null)
    document.addEventListener('drop', clear, true)
    document.addEventListener('dragend', clear, true)
    return () => {
      document.removeEventListener('drop', clear, true)
      document.removeEventListener('dragend', clear, true)
    }
  }, [insertedAt])

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>, index: number): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes('text/instanceid')
        ? 'move'
        : 'copy'
      const next = resolveInsertIndex(event, index)
      setInsertedAt((prev) => (prev === next ? prev : next))
    },
    [enabled]
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>, index: number): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      event.preventDefault()
      event.stopPropagation()
      setInsertedAt(null)
      onDrop(event, resolveInsertIndex(event, index))
    },
    [enabled, onDrop]
  )

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    if (inside) return
    setInsertedAt(null)
  }, [])

  const indicatorAt = useCallback(
    (index: number, total: number): PileDropIndicator | null => {
      if (insertedAt === index) return 'before'
      if (insertedAt === total && index === total - 1) return 'after'
      return null
    },
    [insertedAt]
  )

  return { handleDragOver, handleDrop, handleDragLeave, indicatorAt }
}
