import { useState, type JSX } from 'react'
import { Folder, Images, Languages, RotateCcw } from 'lucide-react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { useYgoDirSelect } from '../../../hooks/useYgoDirSelect'
import { openGameLanguageDialog } from '../../../stores/useGameLanguageStore'
import { languageLabel, mdpro3LocaleIdFromCdbPath } from '../../../utils/gameLanguage'
import { Button } from '../../ui/button'
import { SettingsRow } from './SettingsRow'
import { ReplayCleanupDialog } from './ReplayCleanupDialog'

export function PathsSection(): JSX.Element {
  const [replayDialogOpen, setReplayDialogOpen] = useState(false)
  const { config, gamePathStatus } = useConfigStore()
  const selectYgoDir = useYgoDirSelect()
  const selectCardImageDir = useConfigStore((state) => state.selectCardImageDir)
  const clearCardImageDir = useConfigStore((state) => state.clearCardImageDir)
  const currentLanguageId =
    config.gameType === 'mdpro3' ? mdpro3LocaleIdFromCdbPath(config.cdbPath) : config.gameLanguage
  const gamePathMissing =
    !!config.gameDirectory &&
    !!gamePathStatus &&
    gamePathStatus.gameDirectory === config.gameDirectory &&
    !gamePathStatus.directoryExists
  const cdbPathMissing =
    !!config.gameDirectory &&
    !!gamePathStatus &&
    gamePathStatus.gameDirectory === config.gameDirectory &&
    gamePathStatus.directoryExists &&
    !gamePathStatus.cdbExists

  const openLanguages = async (): Promise<void> => {
    const options = await window.api.getGameLanguageOptions()
    if (options.length > 0) openGameLanguageDialog(options)
  }

  const imageDirDescription = (): string =>
    config.cardImageDirectory
      ? `自定义卡图目录：${config.cardImageDirectory}`
      : '未设置，读取 MDPro3 自带的插画 (Picture/Art)'

  const pathDescription = (): string => {
    if (gamePathMissing) return `路径不存在，请重新选择：${config.gameDirectory}`
    if (cdbPathMissing) return `未找到 cards.cdb，请重新选择游戏主目录：${config.gameDirectory}`
    if (!config.gameDirectory) return '未设置 (指定后自动识别游戏类型并读取卡库与本地卡图)'
    const gameLabel = config.gameType === 'mdpro3' ? 'MDPro3' : 'YGOPro'
    const language = currentLanguageId ? ` · ${languageLabel(currentLanguageId)}` : ''
    return `(${gameLabel}${language}) ${config.gameDirectory}`
  }

  const ygoDirActionLabel = (): string => {
    if (gamePathMissing || cdbPathMissing) return '重新选择...'
    return config.gameDirectory ? '更换...' : '设置...'
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card/60">
        <SettingsRow title="YGO 主程序目录" description={pathDescription()}>
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
            <Button
              size="xs"
              variant="outline"
              onClick={() => void selectYgoDir()}
              className="gap-1"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{ygoDirActionLabel()}</span>
            </Button>
          </div>
        </SettingsRow>

        {config.gameType === 'mdpro3' && (
          <SettingsRow title="卡图目录" description={imageDirDescription()}>
            <div className="flex shrink-0 items-center gap-1">
              {config.cardImageDirectory && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void clearCardImageDir()}
                  className="gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复默认</span>
                </Button>
              )}
              <Button
                size="xs"
                variant="outline"
                onClick={() => void selectCardImageDir()}
                className="gap-1"
              >
                <Images className="w-3.5 h-3.5" />
                <span>{config.cardImageDirectory ? '更换...' : '选择...'}</span>
              </Button>
            </div>
          </SettingsRow>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/60">
        <SettingsRow
          title="回放文件"
          description={
            config.gameDirectory
              ? '清理游戏 replay 目录中的回放，并删除 single 目录下同名的 Lua 脚本'
              : '设置游戏目录后，可以在这里管理已导出的回放文件'
          }
        >
          <Button
            size="xs"
            variant="outline"
            disabled={!config.gameDirectory}
            onClick={() => setReplayDialogOpen(true)}
          >
            管理回放
          </Button>
        </SettingsRow>
      </section>

      <ReplayCleanupDialog open={replayDialogOpen} onClose={() => setReplayDialogOpen(false)} />
    </>
  )
}
