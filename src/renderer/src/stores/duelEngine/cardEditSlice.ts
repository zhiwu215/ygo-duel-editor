import type { StateCreator } from 'zustand'
import { EngineCardRef, EngineProvenance } from '@shared/index'
import { applyCardEditResult } from './applyCardEditResult'
import type { DuelEngineStore } from './types'

export interface CardEditSlice {
  cardEditLoading: boolean
  getProvenance: (ref: EngineCardRef) => Promise<EngineProvenance>
  replaceCard: (ref: EngineCardRef, newCode: number) => Promise<boolean>
  removeCard: (ref: EngineCardRef) => Promise<boolean>
}

export const createCardEditSlice: StateCreator<DuelEngineStore, [], [], CardEditSlice> = (
  set,
  get
) => ({
  cardEditLoading: false,

  getProvenance: async (ref) => {
    if (!get().isInitialized) return { kind: 'unknown' }
    try {
      return await window.api.duelEngineGetProvenance(ref)
    } catch (err) {
      console.error('[useDuelEngineStore] getProvenance failed:', err)
      return { kind: 'unknown' }
    }
  },

  replaceCard: async (ref, newCode) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法编辑卡片。' })
      return false
    }
    if (get().loading) return false
    set({ loading: true, error: null, cardEditLoading: true })
    try {
      const res = await window.api.duelEngineReplaceCard(ref, newCode)
      const applied = await applyCardEditResult(get, set, res, '已替换卡片并重演到当前步骤。')
      set({ cardEditLoading: false })
      return applied
    } catch (err) {
      console.error('[useDuelEngineStore] replaceCard failed:', err)
      set({
        loading: false,
        cardEditLoading: false,
        error: err instanceof Error ? err.message : '替换卡片失败'
      })
      return false
    }
  },

  removeCard: async (ref) => {
    if (!get().isInitialized) {
      set({ error: '引擎尚未启动，无法编辑卡片。' })
      return false
    }
    if (get().loading) return false
    set({ loading: true, error: null, cardEditLoading: true })
    try {
      const res = await window.api.duelEngineRemoveCard(ref)
      const applied = await applyCardEditResult(
        get,
        set,
        res,
        '已从对局中移除该卡并重演到当前步骤。'
      )
      set({ cardEditLoading: false })
      return applied
    } catch (err) {
      console.error('[useDuelEngineStore] removeCard failed:', err)
      set({
        loading: false,
        cardEditLoading: false,
        error: err instanceof Error ? err.message : '移除卡片失败'
      })
      return false
    }
  }
})
