import { create } from 'zustand'
import { AppConfig } from '@shared/index'
import { useCardSearchStore } from './useCardSearchStore'

interface ConfigStoreState {
  config: AppConfig
  isLoaded: boolean
  loadConfig: () => Promise<void>
  selectCdbFile: () => Promise<string | null>
  selectGameDir: () => Promise<string | null>
  /** 选择决斗档案保存目录 */
  selectProjectsDir: () => Promise<string | null>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  toggleTheme: () => Promise<void>
}

/** 跨窗口配置广播只订阅一次（设置窗口改主题/路径后，其余窗口即时生效） */
let configUpdatedSubscribed = false

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: {
    theme: 'light'
  },
  isLoaded: false,

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

  selectCdbFile: async () => {
    try {
      const selected = await window.api.selectCdbFile()
      if (selected) {
        await get().loadConfig()
        // 选择数据库后立即刷新卡片搜索列表，立即可见卡片与本地卡图
        useCardSearchStore.getState().search({ limit: 40 })
      }
      return selected
    } catch (err) {
      console.error('[useConfigStore] selectCdbFile error:', err)
      return null
    }
  },

  selectGameDir: async () => {
    try {
      const dir = await window.api.selectGameDirectory()
      if (dir) {
        await get().loadConfig()
        // 游戏目录变更后重新检索以刷新卡图
        useCardSearchStore.getState().search()
      }
      return dir
    } catch (err) {
      console.error('[useConfigStore] selectGameDir error:', err)
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
