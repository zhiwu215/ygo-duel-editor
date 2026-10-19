import { useEffect, useState, type JSX } from 'react'
import { Folder, FolderOpen, Loader2 } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { SettingsRow } from './SettingsRow'

export function DataDirectorySection(): JSX.Element {
  const { config, selectDataDir, resetDataDir, openDataDir } = useConfigStore()
  const [migrate, setMigrate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [defaultDir, setDefaultDir] = useState('')
  const current = config.dataDirectory

  useEffect(() => {
    void window.api.getDefaultDataDirectory().then(setDefaultDir)
  }, [])

  const handleSelect = async (): Promise<void> => {
    setBusy(true)
    try {
      await selectDataDir(migrate)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    setBusy(true)
    try {
      await resetDataDir(migrate)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="数据保存目录"
        description={
          current
            ? current
            : `${defaultDir || '默认目录'}：卡组库、卡牌图鉴、自建卡、决斗档案、文本素材都存这里`
        }
      >
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => void openDataDir()}
            className="gap-1"
            title="在文件管理器中打开当前数据目录"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>打开</span>
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void handleSelect()}
            aria-busy={busy}
            className="gap-1"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>更换...</span>
            <Loader2 className={cn('w-3 h-3', busy ? 'animate-spin opacity-100' : 'opacity-0')} />
          </Button>
          {current && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void handleReset()}
              aria-busy={busy}
              className="text-xs text-muted-foreground"
            >
              <span>恢复默认</span>
            </Button>
          )}
        </div>
      </SettingsRow>
      <div className="px-5 py-3 border-t border-border/60 flex items-start gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={migrate}
          onClick={() => setMigrate((v) => !v)}
          className={cn(
            'mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors',
            migrate ? 'bg-primary' : 'bg-neutral-400/40'
          )}
        >
          <span
            className={cn(
              'block h-3 w-3 rounded-full bg-white transition-transform',
              migrate ? 'translate-x-3.5' : 'translate-x-0.5'
            )}
          />
        </button>
        <div className="text-xs text-muted-foreground leading-relaxed">
          <div className="font-medium text-foreground">切换时迁移现有数据</div>
          <div>
            把当前目录里的卡组库、卡牌图鉴、自建卡、决斗档案、文本素材复制到新目录（原文件保留）。
            关闭则在新目录重新开始，之后切回原目录仍能看到旧数据。
          </div>
        </div>
      </div>
    </section>
  )
}
