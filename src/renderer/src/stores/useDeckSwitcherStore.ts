import { create } from 'zustand'

interface DeckSwitcherState {
  /** 正在为其切换卡组的控制者 (0: 我方, 1: 对方)，null 表示弹窗关闭 */
  controller: 0 | 1 | null
  /** 打开「切换卡组」弹窗 */
  openDeckSwitcher: (controller: 0 | 1) => void
  /** 关闭「切换卡组」弹窗 */
  closeDeckSwitcher: () => void
}

/**
 * 主卡组「切换卡组」弹窗状态管理。
 * 由决斗盘主卡组格的右键菜单唤起，把卡组库里的一副卡组整体载入到指定控制者。
 */
export const useDeckSwitcherStore = create<DeckSwitcherState>((set) => ({
  controller: null,
  openDeckSwitcher: (controller) => set({ controller }),
  closeDeckSwitcher: () => set({ controller: null })
}))
