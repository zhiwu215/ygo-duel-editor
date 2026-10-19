import { useEffect, useState, type JSX } from 'react'
import { Folder, FolderKanban } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Button } from '../../ui/button'
import { SettingsRow } from './SettingsRow'

export function PathsSection(): JSX.Element {
  const { config, selectYgoDir, selectProjectsDir } = useConfigStore()
  const [defaultDir, setDefaultDir] = useState('')

  useEffect(() => {
    void window.api.getDefaultDataDirectory().then(setDefaultDir)
  }, [])

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="YGO 主程序目录"
        description={
          config.gameDirectory
            ? `${config.gameDirectory}${config.cdbPath ? ` (cards.cdb: ${config.cdbPath})` : ''}`
            : '未设置 (指定后自动定位 cards.cdb 与本地卡图)'
        }
      >
        <Button size="xs" variant="outline" onClick={() => void selectYgoDir()} className="gap-1">
          <Folder className="w-3.5 h-3.5" />
          <span>{config.gameDirectory ? '更换...' : '设置...'}</span>
        </Button>
      </SettingsRow>
      <SettingsRow
        title="决斗档案保存目录"
        description={
          config.projectsDirectory ||
          (defaultDir ? `${defaultDir}\\projects` : '默认目录 (数据保存目录下的 projects)')
        }
      >
        <Button
          size="xs"
          variant="outline"
          onClick={() => void selectProjectsDir()}
          className="gap-1"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>更换...</span>
        </Button>
      </SettingsRow>
    </section>
  )
}
