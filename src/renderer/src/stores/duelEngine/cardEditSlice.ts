import type { StateCreator } from 'zustand'
import {
  EngineCardEditConflict,
  EngineCardEditResult,
  EngineCardRef,
  EngineProvenance
} from '@shared/index'
import { confirmDialog } from '../useDialogStore'
import { applyCardEditResult } from './applyCardEditResult'
import type { DuelEngineStore } from './types'

export interface CardEditSlice {
  cardEditLoading: boolean
  getProvenance: (ref: EngineCardRef) => Promise<EngineProvenance>
  replaceCard: (ref: EngineCardRef, newCode: number) => Promise<boolean>
  removeCard: (ref: EngineCardRef) => Promise<boolean>
}

function conflictDescription(conflict: EngineCardEditConflict, action: '替换' | '移除'): string {
  const prompt =
    conflict.expectedTitle === conflict.actualTitle
      ? `询问仍是「${conflict.actualTitle}」`
      : `原询问「${conflict.expectedTitle}」，重建后是「${conflict.actualTitle}」`
  const fork = `第 ${conflict.forkStepNumber} 步「${conflict.forkTitle}」`
  const rollback =
    conflict.discardedSteps > 0
      ? `如果仍然${action}，会回退到${fork}，并丢弃其后的 ${conflict.discardedSteps} 步记录。`
      : `如果仍然${action}，会回退到${fork}。`
  return [
    `第 ${conflict.opIndex + 1} 条操作无法按原历史重演：${prompt}。`,
    conflict.message,
    '',
    `通常是修改后的卡与历史操作中选中的卡对不上。${rollback}`
  ].join('\n')
}

async function confirmConflict(
  conflict: EngineCardEditConflict,
  action: '替换' | '移除'
): Promise<boolean> {
  const result = await confirmDialog({
    title: '无法与原历史对齐',
    description: conflictDescription(conflict, action),
    confirmText: `仍然${action}并回退`,
    destructive: true,
    icon: 'warning'
  })
  return result === true
}

async function runCardEdit(
  request: (allowDivergence: boolean) => Promise<EngineCardEditResult>,
  action: '替换' | '移除'
): Promise<EngineCardEditResult | null> {
  const first = await request(false)
  if (!first.conflict) return first
  if (!(await confirmConflict(first.conflict, action))) return null
  return request(true)
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
      const res = await runCardEdit(
        (allowDivergence) => window.api.duelEngineReplaceCard(ref, newCode, allowDivergence),
        '替换'
      )
      if (!res) {
        set({ loading: false, cardEditLoading: false })
        return false
      }
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
      const res = await runCardEdit(
        (allowDivergence) => window.api.duelEngineRemoveCard(ref, allowDivergence),
        '移除'
      )
      if (!res) {
        set({ loading: false, cardEditLoading: false })
        return false
      }
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
