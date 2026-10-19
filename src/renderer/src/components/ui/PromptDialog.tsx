import React, { useEffect, useRef, useState } from 'react'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './dialog'
import { Input } from './input'

interface PromptDialogProps {
  open: boolean
  title: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (text: string) => void
  onCancel: () => void
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  placeholder,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  const submit = (): void => {
    onConfirm(text)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-[380px] gap-4 p-5">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-sm font-semibold leading-tight">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <Input
          ref={inputRef}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          className="h-8 text-xs"
        />

        <DialogFooter className="flex-row justify-end gap-2 border-t bg-transparent p-0 pt-3">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">
            {cancelText}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={submit}
            className="h-7 text-xs font-semibold"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
