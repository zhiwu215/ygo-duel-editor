import React from 'react'
import { CardSearchFilterOptions } from '@shared/index'

export function useCardFilterOptions(): CardSearchFilterOptions {
  const [filterOptions, setFilterOptions] = React.useState<CardSearchFilterOptions>({
    effectCategories: [],
    availablePools: []
  })

  React.useEffect(() => {
    let isActive = true
    const load = (): void => {
      window.api
        .getCardSearchFilterOptions()
        .then((options) => {
          if (isActive) setFilterOptions(options)
        })
        .catch((error) => console.error('[FilterDrawer] Failed to load filter labels:', error))
    }
    load()
    const unsubscribe = window.api.onCdbUpdated?.(load)
    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [])

  return filterOptions
}
