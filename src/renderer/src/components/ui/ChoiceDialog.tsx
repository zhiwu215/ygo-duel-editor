import React from 'react'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './dialog'
import type { DialogChoice } from '../../stores/useDialogStore'

interface ChoiceDialogProps {
  open: boolean
  title: string
  description?: string
  choices: DialogChoice[]
  onChoose: (value: string) => void
  onCancel: () => void
}

export const ChoiceDialog: React.FC<ChoiceDialogProps> = ({
  open,
  title,
  description,
  choices,
  onChoose,
  onCancel
}) => {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-[440px] gap-4 p-5">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-sm font-semibold leading-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs leading-relaxed mt-1.5 whitespace-pre-line">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              onClick={() => onChoose(choice.value)}
              className="w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
            >
              <div className="text-xs font-semibold">{choice.label}</div>
              {choice.description && (
                <div className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                  {choice.description}
                </div>
              )}
            </button>
          ))}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t bg-transparent p-0 pt-3">
          <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
