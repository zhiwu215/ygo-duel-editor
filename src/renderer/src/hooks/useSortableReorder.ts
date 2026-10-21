import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

interface UseSortableReorderArgs {
  ids: string[]
  enabled: boolean
  onReorder: (fromIndex: number, toIndex: number) => void
}

interface SortableReorderController {
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  activeSensors: ReturnType<typeof useSensors>
  wasDraggingRef: MutableRefObject<boolean>
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
}

export function useSortableReorder({
  ids,
  enabled,
  onReorder
}: UseSortableReorderArgs): SortableReorderController {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const wasDraggingRef = useRef<boolean>(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const activeSensors = useMemo(() => (enabled ? sensors : []), [enabled, sensors])

  const handleDragStart = (event: DragStartEvent): void => {
    wasDraggingRef.current = true
    activeIdRef.current = String(event.active.id)
    setActiveId(activeIdRef.current)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    activeIdRef.current = null
    setActiveId(null)
    const fromIndex = ids.indexOf(String(event.active.id))
    const toIndex = event.over ? ids.indexOf(String(event.over.id)) : -1
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    onReorder(fromIndex, toIndex)
  }

  const handleDragCancel = (): void => {
    wasDraggingRef.current = false
    activeIdRef.current = null
    setActiveId(null)
  }

  return {
    activeId,
    activeIdRef,
    activeSensors,
    wasDraggingRef,
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  }
}
