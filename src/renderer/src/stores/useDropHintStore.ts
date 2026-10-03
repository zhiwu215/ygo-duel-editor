import { create } from 'zustand'

/** 落子表示切换条的目标格子坐标 */
export interface DropHintZone {
  /** 控制者 (0: 我方, 1: 对方) */
  controller: 0 | 1
  /** 区域 (CardLocation，通常为 MZONE 或 SZONE) */
  location: number
  /** 格子序号 (0~4) */
  sequence: number
}

interface DropHintState {
  /** 最近一次落子的格子坐标（仅怪兽/魔陷区），null 表示无浮出提示 */
  zone: DropHintZone | null
  /** 显示指定格子的落子表示切换条 */
  show: (zone: DropHintZone) => void
  /** 关闭落子表示切换条 */
  close: () => void
}

/**
 * 落子提示状态：每次向怪兽/魔陷区放置卡片后，在该格上方浮出轻量表示切换条。
 * 同一时刻只保留最新一次落子的提示（新落子自动顶掉旧的），点击外部/Esc 关闭。
 */
export const useDropHintStore = create<DropHintState>((set) => ({
  zone: null,
  show: (zone) => set({ zone }),
  close: () => set({ zone: null })
}))
