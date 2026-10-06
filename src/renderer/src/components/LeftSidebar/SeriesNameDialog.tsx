import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

interface SeriesNameDialogProps {
  title: string
  placeholder?: string
  confirmLabel: string
  initialValue?: string
  /** 返回错误文案表示失败，返回 null 表示成功 */
  onConfirm: (name: string) => Promise<string | null>
  onClose: () => void
}

/**
 * 作品分类命名对话框（新建 / 重命名共用）
 */
export const SeriesNameDialog: React.FC<SeriesNameDialogProps> = ({
  title,
  placeholder,
  confirmLabel,
  initialValue = '',
  onConfirm,
  onClose
}) => {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await onConfirm(value)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-xs gap-3 p-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
      >
        <DialogHeader className="gap-0">
          <DialogTitle className="text-xs font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          className="h-8 text-xs bg-background/60"
        />

        {error && <p className="text-[11px] text-destructive leading-relaxed">{error}</p>}

        <DialogFooter className="-mx-4 -mb-4 flex-row justify-end gap-2 border-t bg-transparent p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={busy}
            className="h-7 text-[11px] px-3"
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={busy}
            className="h-7 text-[11px] px-3"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
