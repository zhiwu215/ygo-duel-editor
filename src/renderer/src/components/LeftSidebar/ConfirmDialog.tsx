import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { useBackdropClose } from '../../hooks/useBackdropClose'

interface ConfirmDialogProps {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  destructive = false,
  busy = false,
  onConfirm,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (!busy) onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!busy) onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, {
        capture: true
      } as EventListenerOptions)
  }, [onClose, onConfirm, busy])

  const backdropClose = useBackdropClose(onClose)

  return (
    <div
      onMouseDown={backdropClose.onMouseDown}
      onClick={(e) => {
        if (!busy) backdropClose.onClick(e)
      }}
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div className="w-full max-w-xs bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {description && (
          <div className="text-[11px] text-muted-foreground leading-relaxed">{description}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={busy}
            className="h-7 text-[11px] px-3"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
            className="h-7 text-[11px] px-3"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
