import { useState } from 'react'
import { useCardNoteStore } from '../stores/useCardNoteStore'
import { useConfigStore } from '../stores/useConfigStore'
import { confirmDialog } from '../stores/useDialogStore'

export function useCustomCardGameSync(): {
  canSync: boolean
  syncing: boolean
  cleaning: boolean
  sync: () => Promise<void>
  openSyncDirectory: () => Promise<void>
  clean: () => Promise<void>
} {
  const gameDirectory = useConfigStore((state) => state.config.gameDirectory)
  const notify = useCardNoteStore((state) => state.notify)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [cleaning, setCleaning] = useState<boolean>(false)

  const sync = async (): Promise<void> => {
    if (!gameDirectory || syncing || cleaning) return
    setSyncing(true)
    try {
      const result = await window.api.syncCustomCardsToGame()
      if (!result.success) {
        notify(result.error || '同步失败')
        return
      }
      const parts = [
        result.cdb ? '卡库' : '',
        result.scripts > 0 ? `${result.scripts} 个脚本` : '',
        result.pics > 0 ? `${result.pics} 张卡图` : ''
      ].filter(Boolean)
      const summary = parts.length > 0 ? `已同步：${parts.join('、')}` : '游戏目录已是最新'
      notify(result.removed > 0 ? `${summary}；清理 ${result.removed} 个旧文件` : summary)
    } catch (err) {
      console.error('[useCustomCardGameSync] sync failed:', err)
      notify('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const openSyncDirectory = async (): Promise<void> => {
    if (!gameDirectory) {
      notify('未配置游戏目录')
      return
    }
    const result = await window.api.openCustomCardSyncDir()
    if (!result.success) notify(result.error || '打开同步目录失败')
  }

  const clean = async (): Promise<void> => {
    if (!gameDirectory || cleaning || syncing) return
    const confirmed = await confirmDialog({
      title: '清理同步目录',
      description:
        '将删除本应用同步到游戏目录 expansions 下的自定义卡库、脚本和卡图。项目内的自定义卡和脚本不受影响。',
      confirmText: '清理',
      destructive: true
    })
    if (!confirmed) return
    setCleaning(true)
    try {
      const result = await window.api.cleanCustomCardsFromGame()
      if (!result.success) {
        notify(result.error || '清理失败')
        return
      }
      notify(
        result.removed > 0
          ? `已清理同步目录中的 ${result.removed} 个文件`
          : '同步目录中没有可清理的内容'
      )
    } catch (err) {
      console.error('[useCustomCardGameSync] clean failed:', err)
      notify('清理失败')
    } finally {
      setCleaning(false)
    }
  }

  return {
    canSync: Boolean(gameDirectory),
    syncing,
    cleaning,
    sync,
    openSyncDirectory,
    clean
  }
}
