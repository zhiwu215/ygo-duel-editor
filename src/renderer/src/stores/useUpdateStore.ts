import { create } from 'zustand'
import type { UpdateState } from '@shared/index'
import { confirmDialog } from './useDialogStore'

const INITIAL_STATE: UpdateState = {
  phase: 'idle',
  supported: false,
  currentVersion: ''
}

interface UpdateStoreState {
  state: UpdateState
  dialogOpen: boolean
  initialized: boolean
  init: () => Promise<void>
  openDialog: () => void
  closeDialog: () => void
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
}

let subscribed = false

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  state: INITIAL_STATE,
  dialogOpen: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    if (!subscribed && window.api?.onUpdateState) {
      subscribed = true
      window.api.onUpdateState((state) => set({ state }))
    }
    try {
      const state = await window.api.getUpdateState()
      set({ state })
    } catch (err) {
      console.error('[useUpdateStore] init error:', err)
    }
  },

  openDialog: () => set({ dialogOpen: true }),

  closeDialog: () => set({ dialogOpen: false }),

  check: async () => {
    set({ dialogOpen: true })
    try {
      const state = await window.api.checkForUpdates()
      set({ state })
    } catch (err) {
      console.error('[useUpdateStore] check error:', err)
    }
  },

  download: async () => {
    try {
      const state = await window.api.downloadUpdate()
      set({ state })
    } catch (err) {
      console.error('[useUpdateStore] download error:', err)
    }
  },

  install: async () => {
    const ok = await confirmDialog({
      title: '立即重启并安装更新？',
      description: '软件会关闭并安装新版本，未保存的修改会丢失。稍后退出软件时也会自动安装。',
      confirmText: '重启并安装'
    })
    if (!ok) return
    await window.api.installUpdate()
  }
}))
