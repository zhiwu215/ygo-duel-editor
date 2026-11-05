import { useEffect } from 'react'
import { useDeckEditorStore } from '../stores/useDeckEditorStore'

export function useDeckCardDetailsRefresh(): void {
  const refreshCardDetails = useDeckEditorStore((state) => state.refreshCardDetails)

  useEffect(() => {
    const offBanlistChanged = window.api.onBanlistChanged(() => void refreshCardDetails())
    const offCdbUpdated = window.api.onCdbUpdated(() => void refreshCardDetails())
    return () => {
      offBanlistChanged()
      offCdbUpdated()
    }
  }, [refreshCardDetails])
}
