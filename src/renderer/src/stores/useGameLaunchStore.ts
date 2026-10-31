import { create } from 'zustand'

const MIN_NOTICE_MS = 2000

interface GameLaunchState {
  launching: boolean
  run: <T>(task: () => Promise<T>) => Promise<T>
}

export const useGameLaunchStore = create<GameLaunchState>((set) => ({
  launching: false,
  run: async (task) => {
    set({ launching: true })
    const startedAt = Date.now()
    try {
      return await task()
    } finally {
      const remaining = MIN_NOTICE_MS - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      set({ launching: false })
    }
  }
}))
