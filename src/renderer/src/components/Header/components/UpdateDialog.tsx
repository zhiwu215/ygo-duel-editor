import type { JSX } from 'react'
import { Loader2 } from 'lucide-react'
import { useUpdateStore } from '../../../stores/useUpdateStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog'
import { Button } from '../../ui/button'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function UpdateDialog(): JSX.Element {
  const state = useUpdateStore((s) => s.state)
  const open = useUpdateStore((s) => s.dialogOpen)
  const closeDialog = useUpdateStore((s) => s.closeDialog)
  const check = useUpdateStore((s) => s.check)
  const download = useUpdateStore((s) => s.download)
  const install = useUpdateStore((s) => s.install)
  const { phase, supported, currentVersion, availableVersion, releaseNotes, progress, error } =
    state
  const percent = Math.round(progress?.percent ?? 0)

  const renderNotes = (): JSX.Element | null =>
    releaseNotes ? (
      <div className="max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
        {releaseNotes}
      </div>
    ) : null

  const renderBody = (): JSX.Element => {
    if (!supported) {
      return (
        <p className="text-muted-foreground">
          开发运行模式不会检查更新。安装版会在启动后自动检查，发现新版本时标题栏会出现更新按钮。
        </p>
      )
    }
    if (phase === 'checking') {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在检查新版本…</span>
        </div>
      )
    }
    if (phase === 'available') {
      return (
        <div className="space-y-3">
          <div>
            <div className="font-medium">发现新版本 v{availableVersion}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              下载完成后可重启安装，退出软件时也会自动安装。
            </div>
          </div>
          {renderNotes()}
        </div>
      )
    }
    if (phase === 'downloading') {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">正在下载 v{availableVersion}…</span>
            <span className="text-xs text-muted-foreground">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(progress?.transferred ?? 0)} / {formatBytes(progress?.total ?? 0)}
            </span>
            <span>{formatBytes(progress?.bytesPerSecond ?? 0)}/s</span>
          </div>
        </div>
      )
    }
    if (phase === 'ready') {
      return (
        <div className="space-y-3">
          <div>
            <div className="font-medium">v{availableVersion} 已下载完成</div>
            <div className="mt-1 text-xs text-muted-foreground">
              重启软件后完成安装；未保存的修改请先保存。
            </div>
          </div>
          {renderNotes()}
        </div>
      )
    }
    if (phase === 'up-to-date') {
      return (
        <div>
          <div className="font-medium">已是最新版本</div>
          <div className="mt-1 text-xs text-muted-foreground">当前版本 v{currentVersion}</div>
        </div>
      )
    }
    if (phase === 'error') {
      return (
        <div className="space-y-2">
          <div className="font-medium text-destructive">检查或下载更新失败</div>
          <div className="break-words text-xs text-muted-foreground">{error}</div>
        </div>
      )
    }
    return <p className="text-muted-foreground">尚未检查更新。</p>
  }

  const renderActions = (): JSX.Element[] => {
    if (!supported) {
      return [
        <Button key="close" variant="outline" size="sm" onClick={closeDialog}>
          关闭
        </Button>
      ]
    }
    if (phase === 'available') {
      return [
        <Button key="later" variant="outline" size="sm" onClick={closeDialog}>
          稍后
        </Button>,
        <Button key="download" size="sm" onClick={() => void download()}>
          下载更新
        </Button>
      ]
    }
    if (phase === 'ready') {
      return [
        <Button key="later" variant="outline" size="sm" onClick={closeDialog}>
          稍后
        </Button>,
        <Button key="install" size="sm" onClick={() => void install()}>
          重启并安装
        </Button>
      ]
    }
    if (phase === 'up-to-date' || phase === 'error') {
      return [
        <Button key="retry" variant="outline" size="sm" onClick={() => void check()}>
          重新检查
        </Button>,
        <Button key="close" variant="ghost" size="sm" onClick={closeDialog}>
          关闭
        </Button>
      ]
    }
    return [
      <Button key="close" variant="outline" size="sm" onClick={closeDialog}>
        关闭
      </Button>
    ]
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>软件更新</DialogTitle>
          <DialogDescription>
            {supported ? `当前版本 v${currentVersion}` : '开发运行模式'}
          </DialogDescription>
        </DialogHeader>

        {renderBody()}

        <DialogFooter className="flex-row justify-end">{renderActions()}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
