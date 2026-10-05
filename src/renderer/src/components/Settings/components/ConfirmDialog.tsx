import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  destructive = true,
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] max-w-full bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 whitespace-pre-line">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-7 text-xs font-medium"
          >
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            className="h-7 text-xs font-semibold"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
