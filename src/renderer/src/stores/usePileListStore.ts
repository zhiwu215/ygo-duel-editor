import { create } from 'zustand'

/** 堆叠卡片列表弹窗的目标区域参数 */
export interface PileListTarget {
  /** 控制者 (0: 我方, 1: 对方) */
  controller: 0 | 1
  /** 区域 (CardLocation，如 EXTRA / DECK / GRAVE / REMOVED) */
  location: number
}

interface PileListState {
  /** 当前正在查看列表的目标区域坐标，null 表示弹窗处于关闭状态 */
  target: PileListTarget | null
  /** 打开指定堆叠区域的卡片列表查看弹窗 */
  openPile: (controller: 0 | 1, location: number) => void
  /** 关闭卡片列表查看弹窗 */
  closePile: () => void
}

/**
 * 堆叠区域（主卡组、额外卡组、墓地、除外区）卡片列表查看弹窗状态管理。
 */
export const usePileListStore = create<PileListState>((set) => ({
  target: null,
  openPile: (controller, location) => set({ target: { controller, location } }),
  closePile: () => set({ target: null })
}))
