import { create } from 'zustand'
import { FieldCard } from '@shared/index'

/**
 * 右键菜单目标，两种形态：
 * - `card`：常规 —— 右键某张卡片，菜单围绕这张卡的能力展开；
 * - `zone`：区域级 —— 右键一个**空**的堆叠格（如尚未载入卡组的主卡组格）。
 *   此时没有任何卡片可依附，但仍需要区域级操作（如「切换卡组」）。
 */
export type ContextMenuTarget =
  { kind: 'card'; card: FieldCard } | { kind: 'zone'; controller: 0 | 1; location: number }

/** 菜单状态 = 目标 + 屏幕坐标 */
export type ContextMenuState = ContextMenuTarget & { x: number; y: number }

interface ContextMenuStore {
  menu: ContextMenuState | null
  /** 打开某张卡片的右键菜单 */
  openMenu: (card: FieldCard, x: number, y: number) => void
  /** 打开某个空区域的右键菜单 */
  openZoneMenu: (controller: 0 | 1, location: number, x: number, y: number) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  menu: null,
  openMenu: (card, x, y) => set({ menu: { kind: 'card', card, x, y } }),
  openZoneMenu: (controller, location, x, y) =>
    set({ menu: { kind: 'zone', controller, location, x, y } }),
  closeMenu: () => set({ menu: null })
}))
