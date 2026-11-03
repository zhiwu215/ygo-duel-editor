import { useCallback, useEffect, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import { CdbCard } from '@shared/index'
import { hasCardDragData } from '../utils/cardDrag'

interface ExternalCardDropOptions {
  enabled: boolean
  onDrop: (event: ReactDragEvent<HTMLElement>, insertIndex: number) => void
}

interface ExternalCardDropController {
  insertedAt: number | null
  previewCard: CdbCard | null
  handleDragOver: (event: ReactDragEvent<HTMLElement>, index: number) => void
  handleDrop: (event: ReactDragEvent<HTMLElement>, index: number) => void
  handleDragLeave: (event: ReactDragEvent<HTMLElement>) => void
  handlePlaceholderDragOver: (event: ReactDragEvent<HTMLElement>) => void
  handlePlaceholderDrop: (event: ReactDragEvent<HTMLElement>) => void
}

const resolveInsertIndex = (event: ReactDragEvent<HTMLElement>, index: number): number => {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX >= rect.left + rect.width / 2 ? index + 1 : index
}

const readDraggedCard = (event: DragEvent): CdbCard | null => {
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return null
  try {
    return JSON.parse(raw) as CdbCard
  } catch {
    return null
  }
}

const setDropEffect = (event: ReactDragEvent<HTMLElement>): void => {
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = event.dataTransfer.types.includes('text/instanceid')
    ? 'move'
    : 'copy'
}

export function useExternalCardDrop({
  enabled,
  onDrop
}: ExternalCardDropOptions): ExternalCardDropController {
  const [insertedAt, setInsertedAt] = useState<number | null>(null)
  const [previewCard, setPreviewCard] = useState<CdbCard | null>(null)

  useEffect(() => {
    if (!enabled) return
    const handleDragStart = (event: DragEvent): void => {
      setPreviewCard(readDraggedCard(event))
    }
    document.addEventListener('dragstart', handleDragStart)
    return () => document.removeEventListener('dragstart', handleDragStart)
  }, [enabled])

  useEffect(() => {
    if (insertedAt === null && previewCard === null) return
    const clear = (): void => {
      setInsertedAt(null)
      setPreviewCard(null)
    }
    document.addEventListener('drop', clear)
    document.addEventListener('dragend', clear)
    return () => {
      document.removeEventListener('drop', clear)
      document.removeEventListener('dragend', clear)
    }
  }, [insertedAt, previewCard])

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, index: number): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      setDropEffect(event)
      const next = resolveInsertIndex(event, index)
      setInsertedAt((prev) => (prev === next ? prev : next))
    },
    [enabled]
  )

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, index: number): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      setDropEffect(event)
      setInsertedAt(null)
      setPreviewCard(null)
      onDrop(event, resolveInsertIndex(event, index))
    },
    [enabled, onDrop]
  )

  const handleDragLeave = useCallback((event: ReactDragEvent<HTMLElement>): void => {
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

  const handlePlaceholderDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      setDropEffect(event)
    },
    [enabled]
  )

  const handlePlaceholderDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>): void => {
      if (!enabled || !hasCardDragData(event.dataTransfer.types)) return
      setDropEffect(event)
      if (insertedAt === null) return
      setInsertedAt(null)
      setPreviewCard(null)
      onDrop(event, insertedAt)
    },
    [enabled, insertedAt, onDrop]
  )

  return {
    insertedAt,
    previewCard,
    handleDragOver,
    handleDrop,
    handleDragLeave,
    handlePlaceholderDragOver,
    handlePlaceholderDrop
  }
}
