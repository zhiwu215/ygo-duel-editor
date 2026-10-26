import React, { useCallback, useEffect, useState } from 'react'
import { DuelDocumentTree } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { alertDialog } from '../../stores/useDialogStore'
import { openDuelDocument } from '../../utils/duelDocumentActions'
import { DuelScriptEditorPanel } from './DuelScriptEditorPanel'
import { ScreenplayLibrarySidebar } from '../StorySequencer/ScreenplayLibrarySidebar'

export const DuelDocumentLibraryPanel: React.FC = () => {
  const currentFilePath = useDuelStore((s) => s.currentProjectPath)
  const mode = useDuelStore((s) => s.documentPanelMode)
  const [tree, setTree] = useState<DuelDocumentTree | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.api.getDuelDocumentTree()
    setTree(result.success && result.tree ? result.tree : null)
  }, [])

  useEffect(() => {
    if (mode !== 'library') return
    let cancelled = false
    void window.api.getDuelDocumentTree().then((result) => {
      if (cancelled) return
      setTree(result.success && result.tree ? result.tree : null)
    })
    return () => {
      cancelled = true
    }
  }, [currentFilePath, mode])

  const handleOpen = async (filePath: string): Promise<void> => {
    const result = await openDuelDocument(filePath)
    if (!result.success) {
      await alertDialog(`打开失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    useDuelStore.getState().setDocumentPanelMode('editor')
  }

  const handleCurrentDocumentChanged = (filePath: string | null): void => {
    const duel = useDuelStore.getState()
    duel.setCurrentProjectPath(filePath)
    if (!filePath) {
      duel.setDocumentPanelMode('library')
      duel.setSelectedStepId(null)
    }
    void refresh()
  }

  if (mode === 'editor') {
    return (
      <DuelScriptEditorPanel
        onBack={() => {
          useDuelStore.getState().setDocumentPanelMode('library')
          void refresh()
        }}
      />
    )
  }

  return (
    <ScreenplayLibrarySidebar
      tree={tree}
      currentFilePath={currentFilePath}
      onOpen={(filePath) => void handleOpen(filePath)}
      onCurrentDocumentChanged={handleCurrentDocumentChanged}
      onRefresh={refresh}
      className="w-full border-r-0"
    />
  )
}
