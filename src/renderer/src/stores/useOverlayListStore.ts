import { create } from 'zustand'

interface OverlayListState {
  hostInstanceId: string | null
  openOverlayList: (instanceId: string) => void
  closeOverlayList: () => void
}

export const useOverlayListStore = create<OverlayListState>((set) => ({
  hostInstanceId: null,
  openOverlayList: (instanceId) => set({ hostInstanceId: instanceId }),
  closeOverlayList: () => set({ hostInstanceId: null })
}))
