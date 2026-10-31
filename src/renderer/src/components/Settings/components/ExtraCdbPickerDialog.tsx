import { useState, type JSX } from 'react'
import { Loader2 } from 'lucide-react'
import { ExtraCdbCandidate } from '@shared/index'
import { cdbLibraryMeta } from '../../../utils/cdbLibraryLabel'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '../../ui/dialog'

interface ExtraCdbPickerDialogProps {
  directory: string
  files: ExtraCdbCandidate[]
  onClose: () => void
  onConfirm: (paths: string[]) => Promise<boolean>
}

export function ExtraCdbPickerDialog({
  directory,
  files,
  onClose,
  onConfirm
}: ExtraCdbPickerDialogProps): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const available = files.filter((file) => !file.added)
  const toggle = (path: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleConfirm = (): void => {
    if (busy || selected.size === 0) return
    setBusy(true)
    void onConfirm([...selected]).then((ok) => {
      if (!ok) setBusy(false)
    })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-[560px] gap-3 p-5">
        <DialogTitle className="text-sm font-semibold">选择要添加的卡库</DialogTitle>
        <div className="text-[10px] break-all text-muted-foreground">{directory}</div>

        <div className="flex max-h-[340px] flex-col gap-1 overflow-y-auto pr-0.5">
          {files.map((file) => {
            const meta = cdbLibraryMeta(file.path)
            const checked = selected.has(file.path)
            return (
              <div
                key={file.path}
                role="button"
                tabIndex={file.added ? -1 : 0}
                onClick={() => !file.added && toggle(file.path)}
                onKeyDown={(event) => {
                  if (file.added) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggle(file.path)
                  }
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
                  file.added
                    ? 'border-border opacity-50'
                    : checked
                      ? 'border-primary/40 bg-primary/5 cursor-pointer'
                      : 'border-border hover:bg-muted/60 cursor-pointer'
                )}
              >
                <span
                  className="mt-0.5 shrink-0"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    checked={checked}
                    disabled={file.added}
                    onCheckedChange={() => toggle(file.path)}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">{file.cardCount} 张</span>
                    {file.added && (
                      <span className="text-[10px] text-muted-foreground">已添加</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{meta.description}</div>
                  <div className="mt-0.5 font-mono text-[10px] break-all text-muted-foreground/60">
                    {file.path}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="mt-1">
          <div className="mr-auto flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              disabled={busy || available.length === 0}
              onClick={() => setSelected(new Set(available.map((file) => file.path)))}
            >
              全选
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={busy || selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              清空
            </Button>
          </div>
          <Button size="xs" variant="outline" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button size="xs" disabled={busy || selected.size === 0} onClick={handleConfirm}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>添加{selected.size > 0 ? ` (${selected.size})` : ''}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
