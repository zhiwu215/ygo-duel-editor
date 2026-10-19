import { useEffect } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useEngineAwareUndoRedo } from './useEngineAwareUndoRedo'

interface ShortcutCommands {
  handleNew: () => void
  handleSaveProject: () => Promise<void>
  handleSaveProjectAs: () => void
  handleOpenProject: () => Promise<void>
  handleExportLua: () => Promise<void>
  handleTestInYgo: () => Promise<void>
  handleImportLua: () => Promise<void>
}

export function useGlobalShortcuts(commands: ShortcutCommands): void {
  const {
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua
  } = commands
  const { undo, redo } = useEngineAwareUndoRedo()
  const toggleTacticalView = useDuelStore((s) => s.toggleTacticalView)
  const openScreenplayWithStep = useDuelStore((s) => s.openScreenplayWithStep)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const mod = e.ctrlKey || e.metaKey

      if (e.key === 'Tab') {
        if (!isInput) {
          e.preventDefault()
          toggleTacticalView()
        }
      }

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNew()
      } else if (mod && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault()
          void (e.shiftKey ? redo() : undo())
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        if (!isInput) {
          e.preventDefault()
          redo()
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProjectAs()
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveProject()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        openScreenplayWithStep()
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void handleOpenProject()
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        void handleExportLua()
      } else if (mod && e.key.toLowerCase() === 't') {
        e.preventDefault()
        void handleTestInYgo()
      } else if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        void handleImportLua()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    undo,
    redo,
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    toggleTacticalView,
    openScreenplayWithStep
  ])
}
