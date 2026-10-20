import { useCallback } from 'react'
import { useConfigStore } from '../stores/useConfigStore'
import { openGameLanguageDialog } from '../stores/useGameLanguageStore'

export function useYgoDirSelect(): () => Promise<void> {
  const selectYgoDir = useConfigStore((state) => state.selectYgoDir)
  return useCallback(async () => {
    const res = await selectYgoDir()
    if (res.success && res.languageOptions && res.languageOptions.length > 1) {
      openGameLanguageDialog(res.languageOptions)
    }
  }, [selectYgoDir])
}
