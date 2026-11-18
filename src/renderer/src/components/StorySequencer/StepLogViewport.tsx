import { useCallback, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { StepLogItem } from './stepLogItems'

interface StepLogViewportProps {
  items: StepLogItem[]
  children: (item: StepLogItem) => ReactNode
}

export function StepLogViewport({ items, children }: StepLogViewportProps): ReactNode {
  const viewport = useRef<HTMLDivElement>(null)
  const virtual = items.length > 100
  const getItemKey = useCallback((index: number) => items[index].key, [items])
  const rows = useVirtualizer({
    enabled: virtual,
    count: items.length,
    getItemKey,
    getScrollElement: () => viewport.current,
    estimateSize: (index) => (items[index].kind === 'step' ? 48 : 30),
    overscan: 8
  })
  return (
    <div ref={viewport} className="min-h-0 overflow-y-auto">
      {virtual ? (
        <div className="relative" style={{ height: rows.getTotalSize() }}>
          {rows.getVirtualItems().map((row) => (
            <div
              key={row.key}
              ref={rows.measureElement}
              data-index={row.index}
              className="absolute inset-x-0"
              style={{ top: row.start }}
            >
              {children(items[row.index])}
            </div>
          ))}
        </div>
      ) : (
        items.map(children)
      )}
    </div>
  )
}
