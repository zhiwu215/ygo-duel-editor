import React from 'react'
import { Check } from 'lucide-react'

interface EditableNameChipProps {
  editing: boolean
  draft: string
  onDraftChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  inputClassName: string
  withConfirmButton?: boolean
  children: React.ReactNode
}

export const EditableNameChip: React.FC<EditableNameChipProps> = ({
  editing,
  draft,
  onDraftChange,
  onCommit,
  onCancel,
  inputClassName,
  withConfirmButton = false,
  children
}) => {
  if (!editing) return <>{children}</>

  const input = (
    <input
      type="text"
      value={draft}
      autoFocus
      onChange={(e) => onDraftChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      className={inputClassName}
    />
  )

  if (!withConfirmButton) return input
  return (
    <div className="flex items-center gap-1">
      {input}
      <button
        type="button"
        onClick={onCommit}
        className="p-0.5 text-muted-foreground hover:text-foreground"
      >
        <Check className="w-3 h-3 text-emerald-500" />
      </button>
    </div>
  )
}
