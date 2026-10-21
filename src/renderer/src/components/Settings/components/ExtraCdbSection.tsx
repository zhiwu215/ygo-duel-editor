import { useState, type JSX } from 'react'
import { Eye, EyeOff, FolderPlus, Loader2 } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { cdbLibraryMeta } from '../../../utils/cdbLibraryLabel'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

export function ExtraCdbSection(): JSX.Element {
  const {
    config,
    libraries,
    customCdbPath,
    customSyncCdb,
    addExtraCdb,
    removeExtraCdb,
    setExtraCdbEnabled
  } = useConfigStore()
  const paths = config.extraCdbPaths || []
  const disabled = config.disabledCdbPaths || []
  const [busy, setBusy] = useState(false)
  const isManaged = (path: string): boolean =>
    customCdbPath.length > 0 && path.toLowerCase() === customCdbPath.toLowerCase()
  const gameLibraries = libraries.filter(
    (lib) => lib.source !== 'extra' && lib.source !== 'language'
  )

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
        <div className="text-sm font-semibold">附加卡库</div>
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

      {gameLibraries.length > 0 ? (
        gameLibraries.map((lib) => {
          const meta = cdbLibraryMeta(lib.path)
          return (
            <div key={lib.path} className="px-5 py-3 border-b border-border/60">
              <div className="text-xs font-medium text-foreground/80">{meta.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{meta.description}</div>
              <div className="text-[10px] text-muted-foreground/60 break-all mt-0.5 font-mono">
                {lib.path}
              </div>
            </div>
          )
        })
      ) : (
        <div className="px-5 py-3 border-b border-border/60 text-xs text-muted-foreground">
          未加载游戏自带卡库 (先在 路径 中选择游戏主目录)
        </div>
      )}

      {customSyncCdb?.exists ? (
        <div className="px-5 py-3 border-b border-border/60">
          <div className="text-xs font-medium text-foreground/80">
            自定义卡片游戏副本（同步生成）
          </div>
          <div className="text-xs text-muted-foreground break-all mt-0.5">{customSyncCdb.path}</div>
        </div>
      ) : null}

      {paths.length === 0 ? (
        <div className="px-5 py-4 text-xs text-muted-foreground">未添加附加卡库</div>
      ) : (
        paths
          .filter((path) => !isManaged(path))
          .map((path) => {
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
                    {path}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
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
                  </div>
                </div>
              </div>
            )
          })
      )}
    </section>
  )
}
