import { create } from 'zustand'
import { CardNoteEntry, CardNoteKind } from '@shared/index'
import { confirmDialog } from './useDialogStore'
import { useCustomCardStore } from './useCustomCardStore'

interface CardNoteState {
  entries: CardNoteEntry[]
  initialLoading: boolean
  flash: string | null
  notify: (msg: string) => void
  fetchAll: () => Promise<void>
  applyReorder: (
    cardCode: number,
    kind: CardNoteKind,
    fromTitle: string,
    toTitle: string
  ) => Promise<void>
  save: (
    cardCode: number,
    kind: CardNoteKind,
    title: string,
    text: string,
    source?: string,
    opts?: { successFlash?: string; originalTitle?: string }
  ) => Promise<boolean>
  removeNote: (cardCode: number, kind: CardNoteKind, title: string) => Promise<void>
  removeCustomCard: (cardCode: number) => Promise<void>
  clearEntry: (cardCode: number) => Promise<void>
  exportLibrary: () => Promise<void>
  importLibrary: () => Promise<void>
}

export const useCardNoteStore = create<CardNoteState>((set, get) => ({
  entries: [],
  initialLoading: true,
  flash: null,

  notify: (msg: string): void => {
    set({ flash: msg })
    setTimeout(() => set({ flash: null }), 2500)
  },

  fetchAll: async (): Promise<void> => {
    set({ initialLoading: true })
    try {
      set({ entries: await window.api.listCardNotes() })
    } catch (err) {
      console.error('[CardNoteApp] 读取召唤词库失败:', err)
    } finally {
      set({ initialLoading: false })
    }
  },

  applyReorder: async (
    cardCode: number,
    kind: CardNoteKind,
    fromTitle: string,
    toTitle: string
  ): Promise<void> => {
    if (!fromTitle || fromTitle === toTitle) return
    let nextTitles: string[] | null = null
    set((state) => ({
      entries: state.entries.map((e) => {
        if (e.cardCode !== cardCode) return e
        const list = kind === 'chant' ? [...e.chants] : [...e.notes]
        const fromIdx = list.findIndex((c) => c.title === fromTitle)
        const toIdx = list.findIndex((c) => c.title === toTitle)
        if (fromIdx < 0 || toIdx < 0) return e
        list.splice(toIdx, 0, ...list.splice(fromIdx, 1))
        nextTitles = list.map((c) => c.title)
        return kind === 'chant' ? { ...e, chants: list } : { ...e, notes: list }
      })
    }))
    if (nextTitles) {
      void window.api.reorderCardNotes(cardCode, kind, nextTitles)
    }
  },

  save: async (
    cardCode: number,
    kind: CardNoteKind,
    title: string,
    text: string,
    source?: string,
    opts?: { successFlash?: string; originalTitle?: string }
  ): Promise<boolean> => {
    const res = await window.api.saveCardNote(
      { cardCode, kind, title, text, source },
      opts?.originalTitle
    )
    if (!res.success) {
      get().notify(res.error || '保存失败')
      return false
    }
    await get().fetchAll()
    if (opts?.successFlash) get().notify(opts.successFlash)
    return true
  },

  removeNote: async (cardCode: number, kind: CardNoteKind, title: string): Promise<void> => {
    const kindLabel = kind === 'chant' ? '召唤词' : '备注'
    const ok = await confirmDialog({
      title: `删除${kindLabel}「${title}」`,
      confirmText: '删除'
    })
    if (!ok) return
    await window.api.deleteCardNote(cardCode, kind, title)
    await get().fetchAll()
    get().notify('已删除')
  },

  removeCustomCard: async (cardCode: number): Promise<void> => {
    const { cards, remove } = useCustomCardStore.getState()
    const customCardById = new Map(cards.map((c) => [c.id, c]))
    const card = customCardById.get(cardCode)
    if (!card) return
    const entry = get().entries.find((e) => e.cardCode === cardCode)
    const hasNotes = entry && (entry.chants.length > 0 || entry.notes.length > 0)
    const ok = await confirmDialog({
      title: '删除自定义卡片',
      description: hasNotes
        ? `确定删除自定义卡片「${card.name}」吗？\n其图鉴里的召唤词与备注将一并删除。`
        : `确定删除自定义卡片「${card.name}」吗？`,
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    if (entry) {
      for (const chant of entry.chants) {
        await window.api.deleteCardNote(cardCode, 'chant', chant.title)
      }
      for (const note of entry.notes) {
        await window.api.deleteCardNote(cardCode, 'note', note.title)
      }
    }
    const removed = await remove(cardCode)
    if (removed) {
      await get().fetchAll()
      get().notify('已删除自定义卡片')
    }
  },

  clearEntry: async (cardCode: number): Promise<void> => {
    const entry = get().entries.find((e) => e.cardCode === cardCode)
    if (!entry) return
    const userChants = entry.chants.filter((c) => !c.readonly)
    const userNotes = entry.notes.filter((n) => !n.readonly)
    const hasBuiltins = entry.chants.some((c) => c.readonly) || entry.notes.some((n) => n.readonly)
    if (userChants.length === 0 && userNotes.length === 0) {
      get().notify('该卡只有内置条目，没有可删除的自定义内容')
      return
    }
    const ok = await confirmDialog({
      title: '清空该卡的全部召唤词与备注',
      description: hasBuiltins
        ? `删除「${entry.cardName}」的全部自定义召唤词与备注。\n内置的经典条目不可删除，将保留。`
        : `删除「${entry.cardName}」的全部召唤词与备注。\n删除后该卡的图鉴条目将被移除。`,
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    for (const chant of userChants) {
      await window.api.deleteCardNote(cardCode, 'chant', chant.title)
    }
    for (const note of userNotes) {
      await window.api.deleteCardNote(cardCode, 'note', note.title)
    }
    await get().fetchAll()
    get().notify(hasBuiltins ? '已清空自定义内容，内置条目保留' : '已删除该卡的图鉴条目')
  },

  exportLibrary: async (): Promise<void> => {
    const res = await window.api.exportCardNoteLibrary()
    if (res.success && res.filePath) get().notify('已导出卡牌图鉴')
  },

  importLibrary: async (): Promise<void> => {
    const res = await window.api.importCardNoteLibrary()
    if (res.success) {
      await get().fetchAll()
      get().notify(`已导入 ${res.imported} 条`)
    } else if (res.error) {
      get().notify(res.error)
    }
  }
}))
