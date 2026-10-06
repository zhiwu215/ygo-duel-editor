import { create } from 'zustand'
import { AppConfig } from '@shared/index'

interface ConfigStoreState {
  config: AppConfig
  isLoaded: boolean
  dbReady: boolean | null
  loadConfig: () => Promise<void>
  refreshCdbStatus: () => Promise<void>
  selectYgoDir: () => Promise<string | null>

  addExtraCdb: () => Promise<string | null>
  removeExtraCdb: (cdbPath: string) => Promise<void>
  setExtraCdbEnabled: (cdbPath: string, enabled: boolean) => Promise<void>
  setExtraPicsDir: (cdbPath: string, picsDir: string | null) => Promise<void>

  selectProjectsDir: () => Promise<string | null>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  toggleTheme: () => Promise<void>

  setDeckLoadDrawCount: (drawCount: 0 | 5) => Promise<void>
}

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
    set((state) => ({ config: { ...state.config, deckLoadDrawCount: drawCount } }))
    await window.api.saveConfig({ deckLoadDrawCount: drawCount })
  },

  selectYgoDir: async () => {
    try {
      const res = await window.api.selectYgoDirectory()
      if (res.success && res.path) {
        await get().loadConfig()
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

  addExtraCdb: async () => {
    try {
      const res = await window.api.addExtraCdb()
      if (res.success && res.path) {
        await get().loadConfig()
        if (res.picsDetected === false) {
          alert('已添加卡库，但未自动找到卡图目录，请手动指定该卡库的卡图位置。')
        }
        return res.path
      }
      if (res.error) {
        alert(`添加附加卡库失败：${res.error}`)
      }
      return null
    } catch (err) {
      console.error('[useConfigStore] addExtraCdb error:', err)
      return null
    }
  },

  removeExtraCdb: async (cdbPath) => {
    try {
      await window.api.removeExtraCdb(cdbPath)
      await get().loadConfig()
    } catch (err) {
      console.error('[useConfigStore] removeExtraCdb error:', err)
    }
  },

  setExtraCdbEnabled: async (cdbPath, enabled) => {
    try {
      await window.api.setExtraCdbEnabled(cdbPath, enabled)
      await get().loadConfig()
    } catch (err) {
      console.error('[useConfigStore] setExtraCdbEnabled error:', err)
    }
  },

  setExtraPicsDir: async (cdbPath, picsDir) => {
    try {
      const res = await window.api.setExtraPicsDir(cdbPath, picsDir)
      if (!res.success && res.error) {
        alert(`设置卡图目录失败：${res.error}`)
      }
      if (res.success) await get().loadConfig()
    } catch (err) {
      console.error('[useConfigStore] setExtraPicsDir error:', err)
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
