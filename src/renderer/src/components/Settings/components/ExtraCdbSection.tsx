import { useState, type JSX } from 'react'
import { Eye, EyeOff, FolderPlus, Loader2 } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

export function ExtraCdbSection(): JSX.Element {
  const { config, customCdbPath, addExtraCdb, removeExtraCdb, setExtraCdbEnabled } =
    useConfigStore()
  const paths = config.extraCdbPaths || []
  const disabled = config.disabledCdbPaths || []
  const [busy, setBusy] = useState(false)
  const isManaged = (path: string): boolean =>
    customCdbPath.length > 0 && path.toLowerCase() === customCdbPath.toLowerCase()

  const handleAdd = async (): Promise<void> => {
    setBusy(true)
    try {
      await addExtraCdb()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between gap-6 px-5 py-4 border-b border-border/60">
        <div className="min-w-0">
          <div className="text-sm font-semibold">附加卡库</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            扩展卡库 (.cdb)，加载后与主库合并搜索。语言包（仅提供卡名与效果文的库）会自动识别，
            卡片数据仍取数据库
          </div>
        </div>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={busy}
          className="gap-1 shrink-0"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FolderPlus className="w-3.5 h-3.5" />
          )}
          <span>添加...</span>
        </Button>
      </div>

      {paths.length === 0 ? (
        <div className="px-5 py-4 text-xs text-muted-foreground">未添加附加卡库</div>
      ) : (
        paths.map((path) => {
          const managed = isManaged(path)
          const enabled = !disabled.includes(path)
          return (
            <div key={path} className="px-5 py-3 border-b border-border/60 last:border-b-0">
              <div className="flex items-center justify-between gap-6">
                <div
                  className={cn(
                    'min-w-0 text-xs break-all',
                    enabled ? 'text-foreground/80' : 'text-muted-foreground/60'
                  )}
                >
                  {managed && (
                    <span className="mr-1.5 text-muted-foreground">自建卡库（自动生成）</span>
                  )}
                  {path}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {managed ? (
                    <span className="text-[11px] text-muted-foreground">
                      随自建卡增删改自动同步，不可移除
                    </span>
                  ) : (
                    <>
                      <Button
                        size="xs"
                        variant={enabled ? 'outline' : 'ghost'}
                        onClick={() => void setExtraCdbEnabled(path, !enabled)}
                        className="gap-1"
                      >
                        {enabled ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        <span>{enabled ? '已启用' : '已停用'}</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void removeExtraCdb(path)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        移除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
