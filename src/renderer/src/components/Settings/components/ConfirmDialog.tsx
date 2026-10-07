import React from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Button } from '../../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog'
import { cn } from '../../../lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  icon?: 'warning' | 'info'
  showCancel?: boolean
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
  icon = 'warning',
  showCancel = true,
  onConfirm,
  onCancel
}) => {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-[380px] gap-4 p-5">
        <DialogHeader className="flex-row items-start gap-3 space-y-0">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}
          >
            {icon === 'info' ? <Info className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div className="min-w-0 pt-0.5">
            <DialogTitle className="text-sm font-semibold leading-tight">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-xs leading-relaxed mt-1.5 whitespace-pre-line">
                {description}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="flex-row justify-end gap-2 border-t bg-transparent p-0 pt-3">
          {showCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">
              {cancelText}
            </Button>
          )}
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            className="h-7 text-xs font-semibold"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
