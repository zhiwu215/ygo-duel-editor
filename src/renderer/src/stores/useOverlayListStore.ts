import { create } from 'zustand'

interface OverlayListState {
  /** 当前正在查看素材列表的主怪兽 instanceId，null 表示弹窗处于关闭状态 */
  hostInstanceId: string | null
  /** 打开指定怪兽的超量素材列表查看与编排弹窗 */
  openOverlayList: (instanceId: string) => void
  /** 关闭超量素材列表弹窗 */
  closeOverlayList: () => void
}

/**
 * 场上超量怪兽叠放素材列表弹窗状态管理
 */
export const useOverlayListStore = create<OverlayListState>((set) => ({
  hostInstanceId: null,
  openOverlayList: (instanceId) => set({ hostInstanceId: instanceId }),
  closeOverlayList: () => set({ hostInstanceId: null })
}))
