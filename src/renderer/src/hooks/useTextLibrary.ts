import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TextLibraryEntry, TextLibraryFolder, TextLibraryTree } from '@shared/index'
import { confirmDialog } from '../stores/useDialogStore'
import { findTextLibraryEntry } from '../utils/textLibraryTree'
import { useFlashMessage } from './useFlashMessage'

interface UseTextLibrary {
  tree: TextLibraryTree | null
  loading: boolean
  refreshing: boolean
  error: string | null
  feedback: string | null
  selected: TextLibraryEntry | null
  content: string | null
  contentLoading: boolean
  dirty: boolean
  saving: boolean
  refresh: () => Promise<void>
  select: (entry: TextLibraryEntry) => Promise<void>
  updateContent: (text: string) => void
  saveContent: () => Promise<boolean>
  removeEntry: (entry: TextLibraryEntry) => Promise<void>
  removeFolder: (folder: TextLibraryFolder) => Promise<void>
  exportEntry: (entry: TextLibraryEntry) => Promise<void>
}

export function useTextLibrary(): UseTextLibrary {
  const [tree, setTree] = useState<TextLibraryTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, flash] = useFlashMessage(3000)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedPathRef = useRef<string | null>(null)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  const selected = useMemo(
    () => (tree && selectedPath ? findTextLibraryEntry(tree, selectedPath) : null),
    [tree, selectedPath]
  )

  const contentLoading = selectedPath !== null && loadedPath !== selectedPath
  const dirty = selectedPath !== null && loadedPath === selectedPath && draft !== savedContent

  const applyTree = useCallback((nextTree: TextLibraryTree): void => {
    setTree(nextTree)
    setSelectedPath((previous) =>
      previous && findTextLibraryEntry(nextTree, previous) ? previous : null
    )
    setError(null)
  }, [])

  const loadTree = useCallback(async (): Promise<TextLibraryTree | null> => {
    try {
      const result = await window.api.getTextLibraryTree()
      if (!result.success || !result.tree) {
        setError(result.error ?? '读取文本库失败')
        return null
      }
      return result.tree
    } catch (err) {
      console.error('[useTextLibrary] 读取文本库失败:', err)
      setError('读取文本库失败')
      return null
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    const nextTree = await loadTree()
    if (nextTree) applyTree(nextTree)
    setLoading(false)
    setRefreshing(false)
  }, [loadTree, applyTree])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const nextTree = await loadTree()
      if (cancelled) return
      if (nextTree) applyTree(nextTree)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadTree, applyTree])

  useEffect(() => {
    return window.api.onTextLibraryUpdated(() => {
      void refresh()
    })
  }, [refresh])

  useEffect(() => {
    if (!selectedPath) return
    let cancelled = false
    window.api
      .readTextLibraryEntry(selectedPath)
      .then((result) => {
        if (cancelled) return
        setLoadedPath(selectedPath)
        if (!result.success) {
          setDraft('')
          setSavedContent('')
          setError(result.error ?? '读取文本失败')
          return
        }
        const text = result.content ?? ''
        setDraft(text)
        setSavedContent(text)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useTextLibrary] 读取文本失败:', err)
        setLoadedPath(selectedPath)
        setDraft('')
        setSavedContent('')
        setError('读取文本失败')
      })
    return () => {
      cancelled = true
    }
  }, [selectedPath])

  const saveCurrentContent = useCallback(
    async (silent = false): Promise<boolean> => {
      const path = selectedPath
      if (!path || loadedPath !== path || draft === savedContent) return true
      const operation = saveQueueRef.current.then(async () => {
        if (selectedPathRef.current !== path) return true
        setSaving(true)
        try {
          const result = await window.api.updateTextLibraryEntry(path, draft)
          if (selectedPathRef.current !== path) return true
          if (!result.success) {
            setError(result.error ?? '保存文本失败')
            return false
          }
          setSavedContent(draft)
          setError(null)
          void refresh()
          if (!silent) flash('已保存')
          return true
        } catch (err) {
          console.error('[useTextLibrary] 保存文本失败:', err)
          setError('保存文本失败')
          return false
        } finally {
          setSaving(false)
        }
      })
      saveQueueRef.current = operation.catch(() => undefined)
      return operation
    },
    [selectedPath, loadedPath, draft, savedContent, refresh, flash]
  )

  useEffect(() => {
    if (!dirty || saving || error) return
    const timer = window.setTimeout(() => {
      void saveCurrentContent(true)
    }, 1000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [dirty, saving, error, saveCurrentContent])

  useEffect(() => {
    const flush = (): void => {
      void saveCurrentContent(true)
    }
    window.addEventListener('blur', flush)
    return () => {
      window.removeEventListener('blur', flush)
    }
  }, [saveCurrentContent])

  const select = useCallback(
    async (entry: TextLibraryEntry): Promise<void> => {
      if (entry.path === selectedPath) return
      if (dirty) {
        const saved = await saveCurrentContent(true)
        if (!saved) return
      }
      setSelectedPath(entry.path)
    },
    [selectedPath, dirty, saveCurrentContent]
  )

  const updateContent = useCallback((text: string): void => {
    setDraft(text)
  }, [])

  const removeEntry = useCallback(
    async (entry: TextLibraryEntry): Promise<void> => {
      const ok = await confirmDialog({
        title: `删除《${entry.title}》`,
        description:
          entry.path === selectedPath && dirty
            ? '当前文本有未保存的修改，删除后无法恢复。'
            : '这篇文本会从文本库中移除，无法恢复。',
        confirmText: '删除',
        destructive: true
      })
      if (!ok) return
      const result = await window.api.deleteTextLibraryEntry(entry.path)
      if (!result.success) {
        setError(result.error ?? '删除文本失败')
        return
      }
      await refresh()
      flash('已删除文本')
    },
    [selectedPath, dirty, refresh, flash]
  )

  const removeFolder = useCallback(
    async (folder: TextLibraryFolder): Promise<void> => {
      const selectedInside =
        selectedPath !== null &&
        (selectedPath === folder.path || selectedPath.startsWith(`${folder.path}/`))
      const ok = await confirmDialog({
        title: `删除分类「${folder.name}」`,
        description:
          selectedInside && dirty
            ? '该分类中有正在编辑且未保存的文本，删除后分类及其中所有文本都无法恢复。'
            : '此操作会删除该分类及其中所有文本，无法恢复。',
        confirmText: '删除',
        destructive: true
      })
      if (!ok) return
      const result = await window.api.deleteTextLibraryFolder(folder.path)
      if (!result.success) {
        setError(result.error ?? '删除分类失败')
        return
      }
      await refresh()
      flash('已删除分类')
    },
    [selectedPath, dirty, refresh, flash]
  )

  const exportEntry = useCallback(
    async (entry: TextLibraryEntry): Promise<void> => {
      if (dirty && entry.path === selectedPath) {
        const saved = await saveCurrentContent(true)
        if (!saved) return
      }
      const result = await window.api.exportTextLibraryEntry(entry.path)
      if (result.canceled) return
      if (!result.success) {
        setError(result.error ?? '导出文本失败')
        return
      }
      flash('已导出文本文件')
    },
    [dirty, selectedPath, saveCurrentContent, flash]
  )

  return {
    tree,
    loading,
    refreshing,
    error,
    feedback,
    selected,
    content: loadedPath === selectedPath ? draft : null,
    contentLoading,
    dirty,
    saving,
    refresh,
    select,
    updateContent,
    saveContent: () => saveCurrentContent(false),
    removeEntry,
    removeFolder,
    exportEntry
  }
}
