/**
 * S3 · 选卡询问的会话内勾选状态（card / tribute / sum 共用）。
 *
 * neos 把「勾选索引」放在 cardSelectionProcess 单例里；本项目放进 zustand 临时 store，
 * 让 CardItem（场上点选）与 DuelRequestModals（弹窗卡图）读写同一份状态。
 *
 * 生命周期：订阅 useDuelEngineStore，每次 pendingRequest.id 变化就清空勾选
 * （RETRY 时 id 不变，勾选保留，玩家可以接着改）。
 * unselect 不用本 store——它的选中集由引擎随请求逐张回传。
 */
import { create } from 'zustand'
import type { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { useDuelEngineStore } from './useDuelEngineStore'
import {
  deriveSelection,
  isSameRequestCard,
  requestCardKey,
  type DuelSelectionKind
} from '../utils/duelSelection'

interface SelectionStoreState {
  /** 当前选卡询问的种类（card/tribute/sum/unselect）；非选卡询问为 null */
  pendingKind: DuelSelectionKind | null
  /** 当前请求 id（用于识别请求切换） */
  pendingRequestId: string | null
  /** 已勾选卡片的 requestCardKey 列表 */
  selectedKeys: string[]
  /** 勾选/取消一张候选卡（不在候选池内的卡忽略；超出 max 时忽略，max=1 时替换） */
  toggle: (card: RequestCard) => void
  /** 清空勾选（保留 pendingKind） */
  clear: () => void
}

export const useSelectionStore = create<SelectionStoreState>((set, get) => ({
  pendingKind: null,
  pendingRequestId: null,
  selectedKeys: [],

  toggle: (card) => {
    const derived = deriveSelection(useDuelEngineStore.getState().pendingRequest)
    // unselect 逐张提交，不经过本 store
    if (!derived || derived.kind === 'unselect') return
    const candidate = derived.candidates.find((c) => isSameRequestCard(c, card))
    if (!candidate) return

    const key = requestCardKey(candidate)
    const current = get().selectedKeys
    if (current.includes(key)) {
      set({ selectedKeys: current.filter((value) => value !== key) })
      return
    }

    const max = derived.max > 0 ? derived.max : Number.POSITIVE_INFINITY
    if (current.length >= max) {
      // max=1（单选可替换）时新点击直接顶替旧选择，其余情况忽略
      if (max === 1) set({ selectedKeys: [key] })
      return
    }
    set({ selectedKeys: [...current, key] })
  },

  clear: () => set({ selectedKeys: [] })
}))

function syncFromRequest(request: EngineRequest | null | undefined): void {
  useSelectionStore.setState({
    pendingKind: deriveSelection(request)?.kind ?? null,
    pendingRequestId: request?.id ?? null,
    selectedKeys: []
  })
}

// 请求切换（新 id）即清空勾选；非选卡询问同样把 pendingKind 归零。
useDuelEngineStore.subscribe((state, prevState) => {
  const nextId = state.pendingRequest?.id ?? null
  const prevId = prevState.pendingRequest?.id ?? null
  if (nextId === prevId) return
  syncFromRequest(state.pendingRequest)
})
