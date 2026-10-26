import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar'
import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
import { CardNoteApp } from './components/LeftSidebar/CardNoteApp'
import { SettingsApp } from './components/Settings/SettingsApp'
import { TextLibraryApp } from './components/TextLibrary/TextLibraryApp'
import { CdbSetupModal } from './components/CardSearch/CdbSetupModal'
import { GameLanguageDialog } from './components/Settings/components/GameLanguageDialog'
import { useConfigStore } from './stores/useConfigStore'
import { useUpdateStore } from './stores/useUpdateStore'
import { useDuelEngineStore } from './stores/useDuelEngineStore'
import { useDeckEditorStore } from './stores/useDeckEditorStore'
import { useCustomCardStore } from './stores/useCustomCardStore'
import { useDuelDocumentAutosave } from './hooks/useDuelDocumentAutosave'

function AppModals(): React.JSX.Element {
  return (
    <>
      <CdbSetupModal />
      <GameLanguageDialog />
    </>
  )
}

function DuelWorkspace(): React.JSX.Element {
  useDuelDocumentAutosave()
  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />

        <DuelBoard />

        <RightSidebar />
      </div>

      <AppModals />
    </div>
  )
}

export function App(): React.JSX.Element {
  const { loadConfig, isLoaded } = useConfigStore()
  const loadTimingPolicy = useDuelEngineStore((s) => s.loadTimingPolicy)
  const isDeckEditor = window.location.hash === '#deck-editor'
  const isSettingsWindow = window.location.hash.startsWith('#settings')
  const isCardNotes = window.location.hash === '#card-notes'
  const isTextLibrary = window.location.hash === '#text-library'

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    void useUpdateStore.getState().init()
  }, [])

  useEffect(() => {
    if (isLoaded) void loadTimingPolicy()
  }, [isLoaded, loadTimingPolicy])

  useEffect(() => {
    if (!window.api?.onDataDirectoryChanged) return
    return window.api.onDataDirectoryChanged(() => {
      void useDeckEditorStore.getState().fetchDeckList()
      void useCustomCardStore.getState().load()
    })
  }, [])

  if (isSettingsWindow) {
    return <SettingsApp />
  }

  if (isTextLibrary) {
    return <TextLibraryApp />
  }

  if (isCardNotes) {
    return (
      <>
        <CardNoteApp />
        <AppModals />
      </>
    )
  }

  if (isDeckEditor) {
    return (
      <>
        <DeckEditorApp />
        <AppModals />
      </>
    )
  }

  return <DuelWorkspace />
}

export default App
