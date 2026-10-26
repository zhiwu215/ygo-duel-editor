import { useEffect, useState, type JSX } from 'react'
import { Folder, FolderOpen, Loader2 } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Button } from '../../ui/button'
import { Switch } from '../../ui/switch'
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
            : `${defaultDir || '默认目录'}：卡组库、卡牌图鉴、自定义卡片、台本库、文本库都存这里`
        }
      >
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="outline" onClick={() => void openDataDir()} className="gap-1">
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
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
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
        <Switch
          checked={migrate}
          onCheckedChange={setMigrate}
          aria-label="切换时迁移现有数据"
          className="mt-0.5"
        />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <div className="font-medium text-foreground">切换时迁移现有数据</div>
          <div>
            把当前目录里的卡组库、卡牌图鉴、自定义卡片、台本库、文本库复制到新目录（原文件保留）。
            关闭则在新目录重新开始，之后切回原目录仍能看到旧数据。
          </div>
        </div>
      </div>
    </section>
  )
}
