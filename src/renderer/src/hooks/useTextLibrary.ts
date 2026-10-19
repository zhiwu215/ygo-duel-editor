import { useCallback, useEffect, useState } from 'react'
import { TextMeta } from '@shared/index'
import { confirmDialog } from '../stores/useDialogStore'
import { useFlashMessage } from './useFlashMessage'

interface UseTextLibraryOptions {
  tag: string
  activeId: string | null
  onActiveReplaced: (text: TextMeta | null) => void
}

interface UseTextLibrary {
  texts: TextMeta[]
  loading: boolean
  busy: boolean
  feedback: string | null
  error: string | null
  flash: (msg: string) => void
  refresh: () => Promise<void>
  importText: () => Promise<void>
  removeText: (item: TextMeta) => Promise<void>
  resplitText: (item: TextMeta) => Promise<void>
}

export function useTextLibrary({
  tag,
  activeId,
  onActiveReplaced
}: UseTextLibraryOptions): UseTextLibrary {
  const [texts, setTexts] = useState<TextMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, flash] = useFlashMessage(3000)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setTexts(await window.api.getTextList())
      setError(null)
    } catch (err) {
      console.error(`[${tag}] 读取文本列表失败:`, err)
      setError('读取文本列表失败')
    } finally {
      setLoading(false)
    }
  }, [tag])

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  const importText = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.importTextFile()
      if (res.canceled) return
      if (res.success && res.text) {
        await refresh()
        flash(`已导入《${res.text.title}》`)
      } else {
        setError(res.error || '导入失败')
      }
    } catch (err) {
      console.error(`[${tag}] 导入文本失败:`, err)
      setError('导入失败')
    } finally {
      setBusy(false)
    }
  }, [tag, refresh, flash])

  const removeText = useCallback(
    async (item: TextMeta): Promise<void> => {
      const ok = await confirmDialog({
        title: `删除《${item.title}》`,
        description: '原文与拆分结果都会移除。',
        confirmText: '删除'
      })
      if (!ok) return
      const res = await window.api.deleteText(item.id)
      if (!res.success) {
        flash(res.error || '删除失败')
        return
      }
      if (activeId === item.id) onActiveReplaced(null)
      await refresh()
      flash('已删除')
    },
    [activeId, onActiveReplaced, refresh, flash]
  )

  const resplitText = useCallback(
    async (item: TextMeta): Promise<void> => {
      const res = await window.api.resplitText(item.id)
      if (!res.success) {
        flash(res.error || '重新拆分失败')
        return
      }
      await refresh()
      if (activeId === item.id) onActiveReplaced(res.text ?? null)
      flash(`《${item.title}》已重新拆分为 ${res.text?.chapterCount ?? 0} 章`)
    },
    [activeId, onActiveReplaced, refresh, flash]
  )

  return {
    texts,
    loading,
    busy,
    feedback,
    error,
    flash,
    refresh,
    importText,
    removeText,
    resplitText
  }
}
