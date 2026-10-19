import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProviderLogo } from './ProviderLogo'
import { cn } from '../../../lib/utils'
import type { ProviderStatus } from '../../../utils/agentModelFormat'

const STATUS_DOT_CLASS: Record<ProviderStatus, string> = {
  ready: 'bg-emerald-500',
  unavailable: 'bg-amber-500',
  disabled: 'bg-neutral-300 dark:bg-neutral-600'
}

export function StatusDot({
  status,
  className
}: {
  status: ProviderStatus
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT_CLASS[status], className)}
    />
  )
}

interface NavItemProps {
  active: boolean
  label: string
  status: ProviderStatus
  presetId?: string

  sortable?: boolean

  sortId?: string
  onClick: () => void
}

export function NavItem({
  active,
  label,
  status,
  presetId,
  sortable,
  sortId,
  onClick
}: NavItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId ?? label,
    disabled: !sortable
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group/nav flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
        isDragging && 'z-10 opacity-60 shadow-lg ring-1 ring-primary/40',
        sortable && 'cursor-grab active:cursor-grabbing',
        active
          ? 'bg-accent/70 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
      )}
      {...attributes}
      {...listeners}
    >
      <ProviderLogo presetId={presetId} className="w-4 h-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{label}</span>
      <StatusDot status={status} />
    </button>
  )
}
