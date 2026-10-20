import { useCallback } from 'react'
import { useConfigStore } from '../stores/useConfigStore'
import { confirmDialog } from '../stores/useDialogStore'
import { openGameLanguageDialog } from '../stores/useGameLanguageStore'

export function useYgoDirSelect(): () => Promise<void> {
  const selectYgoDir = useConfigStore((state) => state.selectYgoDir)
  const selectCardImageDir = useConfigStore((state) => state.selectCardImageDir)
  return useCallback(async () => {
    const res = await selectYgoDir()
    if (!res.success) return
    if (res.artOnlyImages && !useConfigStore.getState().config.cardImageDirectory) {
      const choice = await confirmDialog({
        title: 'MDPro3 的卡图只有插画，要另选卡图目录吗？',
        description:
          'MDPro3 自带的 Picture/Art 只有卡牌插画，不是带卡框文字的完整卡面。\n你可以指定一个 YGOPro 目录（或它的 pics 文件夹）作为卡图库。',
        confirmText: '选择卡图目录',
        extraAction: { text: '继续使用插画', value: 'skip' },
        destructive: false
      })
      if (choice === true) await selectCardImageDir()
    }
    if (res.languageOptions && res.languageOptions.length > 1) {
      openGameLanguageDialog(res.languageOptions)
    }
  }, [selectYgoDir, selectCardImageDir])
}
