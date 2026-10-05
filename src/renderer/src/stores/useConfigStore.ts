import { create } from 'zustand'
import { AppConfig } from '@shared/index'
import { useCardSearchStore } from './useCardSearchStore'

interface ConfigStoreState {
  config: AppConfig
  isLoaded: boolean
  dbReady: boolean | null
  loadConfig: () => Promise<void>
  refreshCdbStatus: () => Promise<void>
  selectYgoDir: () => Promise<string | null>
  /** 选择决斗档案保存目录 */
  selectProjectsDir: () => Promise<string | null>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  toggleTheme: () => Promise<void>
  /** 记忆「切换卡组」弹窗里「载入手牌」的选择 (0: 无, 5: 抽 5) */
  setDeckLoadDrawCount: (drawCount: 0 | 5) => Promise<void>
}

/** 跨窗口配置广播只订阅一次（设置窗口改主题/路径后，其余窗口即时生效） */
let configUpdatedSubscribed = false

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: {
    theme: 'light'
  },
  isLoaded: false,
  dbReady: null,

  refreshCdbStatus: async () => {
    try {
      if (!window.api?.getCdbStatus) return
      const status = await window.api.getCdbStatus()
      set({ dbReady: status.ready })
    } catch (err) {
      console.error('[useConfigStore] refreshCdbStatus error:', err)
      set({ dbReady: null })
    }
  },

  loadConfig: async () => {
    if (!configUpdatedSubscribed && window.api?.onConfigUpdated) {
      configUpdatedSubscribed = true
      window.api.onConfigUpdated(() => {
        void get().loadConfig()
      })
    }
    try {
      const cfg = await window.api.getConfig()
      const theme = cfg.theme || 'light'
      document.documentElement.classList.toggle('dark', theme === 'dark')
      set({ config: { ...cfg, theme }, isLoaded: true })
      await get().refreshCdbStatus()
    } catch (err) {
      console.error('[useConfigStore] loadConfig error:', err)
      set({ isLoaded: true })
    }
  },

  setTheme: async (theme: 'dark' | 'light') => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set((state) => ({ config: { ...state.config, theme } }))
    await window.api.saveConfig({ theme })
  },

  toggleTheme: async () => {
    const currentTheme = get().config.theme || 'light'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    await get().setTheme(nextTheme)
  },

  setDeckLoadDrawCount: async (drawCount) => {
    // 先乐观更新本地状态（切换即时生效），再落盘；主进程会广播 config:updated 兜底同步
    set((state) => ({ config: { ...state.config, deckLoadDrawCount: drawCount } }))
    await window.api.saveConfig({ deckLoadDrawCount: drawCount })
  },

  selectYgoDir: async () => {
    try {
      const res = await window.api.selectYgoDirectory()
      if (res.success && res.path) {
        await get().loadConfig()
        useCardSearchStore.getState().search({ limit: 40 })
        return res.path
      }
      if (res.error) {
        alert(`设置 YGO 路径失败：${res.error}`)
      }
      return null
    } catch (err) {
      console.error('[useConfigStore] selectYgoDir error:', err)
      return null
    }
  },

  selectProjectsDir: async () => {
    try {
      const dir = await window.api.selectProjectsDirectory()
      if (dir) {
        await get().loadConfig()
      }
      return dir
    } catch (err) {
      console.error('[useConfigStore] selectProjectsDir error:', err)
      return null
    }
  }
}))
