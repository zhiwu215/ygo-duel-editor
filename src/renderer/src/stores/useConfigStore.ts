import { create } from 'zustand'
import {
  AppConfig,
  CardImageDirResult,
  CdbLibraryInfo,
  CdbSelectResult,
  CustomSyncCdbInfo,
  DEFAULT_DUEL_TEST_SETTINGS,
  DEFAULT_FONT_SIZES,
  DEFAULT_CARD_NAME_WRAPPER,
  DuelTestSettings,
  EngineSupportInfo,
  FontSizeRole,
  GamePathStatus,
  WebSearchConfig,
  clampFontSize,
  normalizeCardNameWrapper,
  normalizeFontSizes,
  normalizeWebSearchConfig
} from '@shared/index'
import { alertDialog } from './useDialogStore'
import { applyFontSizes, applyTheme } from '../utils/appearance'

interface ConfigStoreState {
  config: AppConfig
  isLoaded: boolean
  dbReady: boolean | null
  gamePathStatus: GamePathStatus | null
  customCdbPath: string
  libraries: CdbLibraryInfo[]
  customSyncCdb: CustomSyncCdbInfo | null
  engineSupport: EngineSupportInfo | null
  loadConfig: () => Promise<void>
  refreshCdbStatus: () => Promise<void>
  refreshGamePathStatus: () => Promise<void>
  refreshEngineSupport: () => Promise<void>
  selectYgoDir: () => Promise<CdbSelectResult>

  addExtraCdb: () => Promise<string | null>
  removeExtraCdb: (cdbPath: string) => Promise<void>
  setExtraCdbEnabled: (cdbPath: string, enabled: boolean) => Promise<void>
  setTheme: (theme: ThemePreference) => Promise<void>
  setFontSize: (role: FontSizeRole, px: number) => Promise<void>
  setCardNameWrapper: (wrapper: string) => Promise<void>

  selectDataDir: (migrate: boolean) => Promise<boolean>
  resetDataDir: (migrate: boolean) => Promise<void>
  openDataDir: () => Promise<void>

  selectCardImageDir: () => Promise<CardImageDirResult>
  clearCardImageDir: () => Promise<void>

  setDuelTestSettings: (patch: Partial<DuelTestSettings>) => Promise<void>
  setWebSearchConfig: (config: WebSearchConfig) => Promise<void>
}

type ThemePreference = AppConfig['theme']

let configUpdatedSubscribed = false
let cdbUpdatedSubscribed = false

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  config: {
    theme: 'system',
    fontSizes: DEFAULT_FONT_SIZES,
    cardNameWrapper: DEFAULT_CARD_NAME_WRAPPER
  },
  isLoaded: false,
  dbReady: null,
  gamePathStatus: null,
  customCdbPath: '',
  libraries: [],
  customSyncCdb: null,
  engineSupport: null,

  refreshEngineSupport: async () => {
    try {
      if (!window.api?.getDuelEngineSupport) return
      const support = await window.api.getDuelEngineSupport()
      set({ engineSupport: support })
    } catch (err) {
      console.error('[useConfigStore] refreshEngineSupport error:', err)
      set({ engineSupport: null })
    }
  },

  refreshGamePathStatus: async () => {
    try {
      if (!window.api?.getGamePathStatus) return
      const status = await window.api.getGamePathStatus()
      set({ gamePathStatus: status })
    } catch (err) {
      console.error('[useConfigStore] refreshGamePathStatus error:', err)
      set({ gamePathStatus: null })
    }
  },

  refreshCdbStatus: async () => {
    try {
      if (!window.api?.getCdbStatus) return
      const status = await window.api.getCdbStatus()
      set({
        dbReady: status.ready,
        customCdbPath: status.customCdbPath,
        libraries: status.libraries ?? [],
        customSyncCdb: status.customSyncCdb ?? null
      })
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
    if (!cdbUpdatedSubscribed && window.api?.onCdbUpdated) {
      cdbUpdatedSubscribed = true
      window.api.onCdbUpdated(() => {
        void get().refreshCdbStatus()
      })
    }
    try {
      const cfg = await window.api.getConfig()
      const theme = cfg.theme || 'system'
      const fontSizes = normalizeFontSizes(cfg.fontSizes)
      applyTheme(theme)
      applyFontSizes(fontSizes)
      set({ config: { ...cfg, theme, fontSizes }, isLoaded: true })
      await get().refreshGamePathStatus()
      await get().refreshCdbStatus()
      await get().refreshEngineSupport()
    } catch (err) {
      console.error('[useConfigStore] loadConfig error:', err)
      set({ isLoaded: true })
    }
  },

  setTheme: async (theme: ThemePreference) => {
    applyTheme(theme)
    set((state) => ({ config: { ...state.config, theme } }))
    await window.api.saveConfig({ theme })
  },

  setFontSize: async (role, px) => {
    const fontSizes = {
      ...get().config.fontSizes,
      [role]: clampFontSize(role, px)
    }
    applyFontSizes(fontSizes)
    set((state) => ({ config: { ...state.config, fontSizes } }))
    await window.api.saveConfig({ fontSizes })
  },

  setCardNameWrapper: async (wrapper) => {
    const cardNameWrapper = normalizeCardNameWrapper(wrapper)
    set((state) => ({ config: { ...state.config, cardNameWrapper } }))
    await window.api.saveConfig({ cardNameWrapper })
  },

  selectDataDir: async (migrate) => {
    try {
      const res = await window.api.selectDataDirectory(migrate)
      if (!res) return false
      if (res.error) {
        void alertDialog(res.error)
        return false
      }
      await get().loadConfig()
      return true
    } catch (err) {
      console.error('[useConfigStore] selectDataDir error:', err)
      return false
    }
  },

  resetDataDir: async (migrate) => {
    try {
      await window.api.resetDataDirectory(migrate)
      await get().loadConfig()
    } catch (err) {
      console.error('[useConfigStore] resetDataDir error:', err)
    }
  },

  openDataDir: async () => {
    try {
      await window.api.openDataDirectory()
    } catch (err) {
      console.error('[useConfigStore] openDataDir error:', err)
    }
  },

  selectYgoDir: async () => {
    try {
      const res = await window.api.selectYgoDirectory()
      if (res.success && res.path) {
        await get().loadConfig()
        return res
      }
      if (res.error) {
        void alertDialog(`设置 YGO 路径失败：${res.error}`)
      }
      return res
    } catch (err) {
      console.error('[useConfigStore] selectYgoDir error:', err)
      return { success: false }
    }
  },

  selectCardImageDir: async () => {
    try {
      const res = await window.api.selectCardImageDirectory()
      if (res.success) {
        await get().loadConfig()
      } else if (res.error) {
        void alertDialog(`设置卡图目录失败：${res.error}`)
      }
      return res
    } catch (err) {
      console.error('[useConfigStore] selectCardImageDir error:', err)
      return { success: false }
    }
  },

  clearCardImageDir: async () => {
    try {
      await window.api.setCardImageDirectory(null)
      await get().loadConfig()
    } catch (err) {
      console.error('[useConfigStore] clearCardImageDir error:', err)
    }
  },

  setDuelTestSettings: async (patch) => {
    const current = get().config.duelTestSettings ?? DEFAULT_DUEL_TEST_SETTINGS
    const next = { ...current, ...patch }
    set((state) => ({ config: { ...state.config, duelTestSettings: next } }))
    await window.api.saveConfig({ duelTestSettings: next })
  },

  setWebSearchConfig: async (config) => {
    const webSearch = normalizeWebSearchConfig(config)
    set((state) => ({ config: { ...state.config, webSearch } }))
    await window.api.saveConfig({ webSearch })
  },

  addExtraCdb: async () => {
    try {
      const res = await window.api.addExtraCdb()
      if (res.success && res.path) {
        await get().loadConfig()
        if (res.picsDetected === false) {
          void alertDialog('已添加卡库，但未自动找到卡图目录，卡牌将不显示图片。')
        }
        return res.path
      }
      if (res.error) {
        void alertDialog(`添加附加卡库失败：${res.error}`)
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
  }
}))
