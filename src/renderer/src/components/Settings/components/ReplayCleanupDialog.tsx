import { useCallback, useEffect, useState, type JSX } from 'react'
import type { ReplayFileEntry } from '@shared/index'
import { alertDialog, confirmDialog } from '../../../stores/useDialogStore'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog'
import { cn } from '../../../lib/utils'

interface ReplayCleanupDialogProps {
  open: boolean
  onClose: () => void
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ReplayCleanupDialog({ open, onClose }: ReplayCleanupDialogProps): JSX.Element {
  const [entries, setEntries] = useState<ReplayFileEntry[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.duelListReplays()
      if (!result.success) {
        setEntries([])
        setError(result.error ?? '读取回放列表失败')
        return
      }
      setEntries(result.entries)
      setSelected(new Set())
    } catch (err) {
      setEntries([])
      setError(err instanceof Error ? err.message : '读取回放列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    setLoading(true)
    await fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    if (!open) return
    let active = true
    void window.api
      .duelListReplays()
      .then((result) => {
        if (!active) return
        if (!result.success) {
          setEntries([])
          setError(result.error ?? '读取回放列表失败')
          return
        }
        setError(null)
        setEntries(result.entries)
        setSelected(new Set())
      })
      .catch((err) => {
        if (!active) return
        setEntries([])
        setError(err instanceof Error ? err.message : '读取回放列表失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  const toggle = (fileName: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(fileName)) next.add(fileName)
      return next
    })
  }

  const allSelected = entries.length > 0 && entries.every((entry) => selected.has(entry.fileName))

  const toggleAll = (): void => {
    setSelected(allSelected ? new Set() : new Set(entries.map((entry) => entry.fileName)))
  }

  const handleDelete = async (): Promise<void> => {
    if (selected.size === 0 || deleting) return
    const confirmed = await confirmDialog({
      title: '删除所选回放',
      description: `将删除 ${selected.size} 个回放文件，并同时删除 single 目录下同名的 Lua 脚本。此操作不可恢复。`,
      confirmText: '删除',
      destructive: true
    })
    if (!confirmed) return
    setDeleting(true)
    try {
      const result = await window.api.duelDeleteReplays([...selected])
      if (!result.success) {
        await alertDialog(result.error ?? '删除回放失败')
        return
      }
      await alertDialog(
        `已删除 ${result.deletedReplays} 个回放` +
          (result.deletedScripts > 0 ? `，${result.deletedScripts} 个 Lua 脚本。` : '。')
      )
      await load()
    } catch (err) {
      await alertDialog(err instanceof Error ? err.message : '删除回放失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[620px] gap-3 p-4">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm font-medium">管理回放文件</DialogTitle>
          <DialogDescription className="text-xs leading-[18px]">
            仅列出同时存在同名 single/*.lua 的单模式回放；勾选后回放和对应 Lua 会一起删除。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {loading ? '读取中…' : `共 ${entries.length} 个回放`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || entries.length === 0}
            onClick={toggleAll}
            className="h-7 px-2 text-xs"
          >
            {allSelected ? '取消全选' : '全选'}
          </Button>
        </div>

        {error ? (
          <p className="py-6 text-center text-xs text-destructive">{error}</p>
        ) : entries.length === 0 && !loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">没有可清理的回放文件。</p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70">
            {entries.map((entry) => (
              <li key={entry.fileName} className="border-b border-border/60 last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs leading-[18px] hover:bg-muted/40">
                  <Checkbox
                    checked={selected.has(entry.fileName)}
                    aria-label={entry.fileName}
                    onCheckedChange={() => toggle(entry.fileName)}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.fileName}</span>
                  {entry.hasLua && (
                    <span className="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-500">
                      Lua
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatSize(entry.size)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-[10px] text-muted-foreground',
                      'w-[112px] text-right'
                    )}
                  >
                    {formatDate(entry.modifiedAt)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="-mx-4 -mb-4 flex-row justify-end gap-2 rounded-b-xl border-t bg-transparent p-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            关闭
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selected.size === 0 || deleting}
            onClick={() => void handleDelete()}
            className="h-8 text-xs"
          >
            删除所选（{selected.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
