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
  /**
   * 打开次数自增序号。
   *
   * 弹窗组件用 `key={openSeq}_${controller}_${location}` 挂载：只按区域做 key 时，
   * 反复打开同一区域会命中同一个 key 而不重挂载，组件内部状态会被下一次打开继承
   * （例如拖拽做场失败后残留的 `isOutsideList`，会让弹窗渲染成全透明且点不动）。
   */
  openSeq: number
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
  openSeq: 0,
  openPile: (controller, location) =>
    set((prev) => ({ target: { controller, location }, openSeq: prev.openSeq + 1 })),
  closePile: () => set({ target: null })
}))
