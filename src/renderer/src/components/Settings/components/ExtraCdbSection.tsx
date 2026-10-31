import { useState, type JSX } from 'react'
import { Eye, EyeOff, FolderPlus, Languages, Loader2 } from 'lucide-react'
import { ExtraCdbCandidate, ExtraCdbLanguageInfo } from '@shared/index'
import { useConfigStore } from '../../../stores/useConfigStore'
import { alertDialog } from '../../../stores/useDialogStore'
import { openGameLanguageDialog } from '../../../stores/useGameLanguageStore'
import { cdbLibraryMeta } from '../../../utils/cdbLibraryLabel'
import { languageLabel } from '../../../utils/gameLanguage'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { ExtraCdbPickerDialog } from './ExtraCdbPickerDialog'

export function ExtraCdbSection(): JSX.Element {
  const {
    config,
    libraries,
    customCdbPath,
    customSyncCdb,
    extraLanguages,
    pickExtraCdb,
    addExtraCdb,
    removeExtraCdb,
    setExtraCdbEnabled
  } = useConfigStore()
  const paths = config.extraCdbPaths || []
  const disabled = config.disabledCdbPaths || []
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState<{ directory: string; files: ExtraCdbCandidate[] } | null>(
    null
  )
  const isManaged = (path: string): boolean =>
    customCdbPath.length > 0 && path.toLowerCase() === customCdbPath.toLowerCase()
  const gameLibraries = libraries.filter(
    (lib) => lib.source !== 'extra' && lib.source !== 'language'
  )
  const visiblePaths = paths.filter((path) => !isManaged(path))
  const languageSources: ExtraCdbLanguageInfo[] = []
  const seenRoots = new Set<string>()
  for (const path of visiblePaths) {
    const info = extraLanguages[path]
    if (!info || seenRoots.has(info.root)) continue
    seenRoots.add(info.root)
    languageSources.push(info)
  }

  const handleAdd = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await pickExtraCdb()
      if (!res) return
      const files = res.files ?? []
      const available = files.filter((file) => !file.added)
      if (available.length === 0) {
        void alertDialog('该文件夹里的卡库都已经添加过了。')
        return
      }
      if (available.length === 1) {
        await addExtraCdb([available[0].path])
        return
      }
      setPicker({ directory: res.directory ?? '', files })
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

      {languageSources.map((info) => (
        <div key={info.root} className="px-5 py-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground/80">附加卡库语言</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                作用于该目录下的所有附加卡库
              </div>
              <div className="mt-0.5 font-mono text-[10px] break-all text-muted-foreground/60">
                {info.root}
              </div>
            </div>
            <Button
              size="xs"
              variant="outline"
              className="gap-1 shrink-0"
              onClick={() =>
                openGameLanguageDialog(info.options, { kind: 'extra', root: info.root })
              }
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{info.language ? `语言：${languageLabel(info.language)}` : '选择语言...'}</span>
            </Button>
          </div>
        </div>
      ))}

      {visiblePaths.length === 0 ? (
        <div className="px-5 py-4 text-xs text-muted-foreground">未添加附加卡库</div>
      ) : (
        visiblePaths.map((path) => {
          const enabled = !disabled.includes(path)
          const meta = cdbLibraryMeta(path)
          return (
            <div key={path} className="px-5 py-3 border-b border-border/60 last:border-b-0">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div
                    className={cn(
                      'text-xs font-medium',
                      enabled ? 'text-foreground/80' : 'text-muted-foreground/60'
                    )}
                  >
                    {meta.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{meta.description}</div>
                  <div className="mt-0.5 font-mono text-[10px] break-all text-muted-foreground/60">
                    {path}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="xs"
                    variant={enabled ? 'outline' : 'ghost'}
                    onClick={() => void setExtraCdbEnabled(path, !enabled)}
                    className="gap-1"
                  >
                    {enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
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
                </div>
              </div>
            </div>
          )
        })
      )}

      {picker && (
        <ExtraCdbPickerDialog
          directory={picker.directory}
          files={picker.files}
          onClose={() => setPicker(null)}
          onConfirm={async (selected) => {
            const ok = await addExtraCdb(selected)
            if (ok) setPicker(null)
            return ok
          }}
        />
      )}
    </section>
  )
}
