import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar'
import { ScreenplayWindowApp } from './components/StorySequencer/ScreenplayWindowApp'
import { ScreenplayBridge } from './components/ScreenplayBridge'
import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
import { CardNoteApp } from './components/LeftSidebar/CardNoteApp'
import { SettingsApp } from './components/Settings/SettingsApp'
import { TextLibraryApp } from './components/TextLibrary/TextLibraryApp'
import { CdbSetupModal } from './components/CardSearch/CdbSetupModal'
import { CustomCardEditorDialog } from './components/CustomCard/CustomCardEditorDialog'
import { useConfigStore } from './stores/useConfigStore'
import { useDuelEngineStore } from './stores/useDuelEngineStore'
import { useDeckEditorStore } from './stores/useDeckEditorStore'
import { useCustomCardStore } from './stores/useCustomCardStore'

function AppModals(): React.JSX.Element {
  return (
    <>
      <CustomCardEditorDialog />
      <CdbSetupModal />
    </>
  )
}

export function App(): React.JSX.Element {
  const { loadConfig, isLoaded } = useConfigStore()
  const loadTimingPolicy = useDuelEngineStore((s) => s.loadTimingPolicy)
  const isDeckEditor = window.location.hash === '#deck-editor'
  const isSettingsWindow = window.location.hash.startsWith('#settings')
  const isCardNotes = window.location.hash === '#card-notes'
  const isTextLibrary = window.location.hash === '#text-library'
  const isScreenplay = window.location.hash === '#screenplay'

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

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

  if (isScreenplay) {
    return <ScreenplayWindowApp />
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

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />

        <DuelBoard />

        <RightSidebar />
      </div>

      <ScreenplayBridge />

      <AppModals />
    </div>
  )
}

export default App
