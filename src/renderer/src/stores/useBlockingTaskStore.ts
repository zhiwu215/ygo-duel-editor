import { create } from 'zustand'

const DEFAULT_MIN_VISIBLE_MS = 600

export interface BlockingTaskNotice {
  title: string
  detail: string
  minVisibleMs?: number
}

interface BlockingTaskState {
  notice: BlockingTaskNotice | null
  run: <T>(notice: BlockingTaskNotice, task: () => Promise<T>) => Promise<T>
}

export const useBlockingTaskStore = create<BlockingTaskState>((set) => ({
  notice: null,
  run: async (notice, task) => {
    set({ notice })
    const startedAt = Date.now()
    try {
      return await task()
    } finally {
      const remaining = (notice.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS) - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      set({ notice: null })
    }
  }
}))
