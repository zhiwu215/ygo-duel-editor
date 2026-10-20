import { type JSX } from 'react'
import { Folder, Languages } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { useYgoDirSelect } from '../../../hooks/useYgoDirSelect'
import { openGameLanguageDialog } from '../../../stores/useGameLanguageStore'
import { languageLabel, mdpro3LocaleIdFromCdbPath } from '../../../utils/gameLanguage'
import { Button } from '../../ui/button'
import { SettingsRow } from './SettingsRow'

export function PathsSection(): JSX.Element {
  const { config } = useConfigStore()
  const selectYgoDir = useYgoDirSelect()
  const currentLanguageId =
    config.gameType === 'mdpro3' ? mdpro3LocaleIdFromCdbPath(config.cdbPath) : config.gameLanguage

  const openLanguages = async (): Promise<void> => {
    const options = await window.api.getGameLanguageOptions()
    if (options.length > 0) openGameLanguageDialog(options)
  }

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="YGO 主程序目录"
        description={
          config.gameDirectory
            ? `(${config.gameType === 'mdpro3' ? 'MDPro3' : 'YGOPro'}${
                currentLanguageId ? ` · ${languageLabel(currentLanguageId)}` : ''
              }) ${config.gameDirectory}`
            : '未设置 (指定后自动识别游戏类型并读取卡库与本地卡图)'
        }
      >
        <div className="flex shrink-0 items-center gap-1">
          {(config.gameType === 'mdpro3' || !!config.gameLanguage) && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => void openLanguages()}
              className="gap-1"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>语言...</span>
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={() => void selectYgoDir()} className="gap-1">
            <Folder className="w-3.5 h-3.5" />
            <span>{config.gameDirectory ? '更换...' : '设置...'}</span>
          </Button>
        </div>
      </SettingsRow>
    </section>
  )
}
