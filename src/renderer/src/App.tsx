import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar'
import { DuelScreenplayModal } from './components/StorySequencer/DuelScreenplayModal'
import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
import { CardNoteApp } from './components/LeftSidebar/CardNoteApp'
import { SettingsApp } from './components/Settings/SettingsApp'
import { CdbSetupModal } from './components/CardSearch/CdbSetupModal'
import { CustomCardEditorDialog } from './components/CustomCard/CustomCardEditorDialog'
import { useConfigStore } from './stores/useConfigStore'
import { useDeckEditorStore } from './stores/useDeckEditorStore'
import { useCustomCardStore } from './stores/useCustomCardStore'

export function App(): React.JSX.Element {
  const { loadConfig } = useConfigStore()
  const isDeckEditor = window.location.hash === '#deck-editor'
  const isSettingsWindow = window.location.hash.startsWith('#settings')
  const isCardNotes = window.location.hash === '#card-notes'

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

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

  if (isCardNotes) {
    return (
      <>
        <CardNoteApp />
        <CustomCardEditorDialog />
        <CdbSetupModal />
      </>
    )
  }

  if (isDeckEditor) {
    return (
      <>
        <DeckEditorApp />
        <CustomCardEditorDialog />
        <CdbSetupModal />
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

      <DuelScreenplayModal />

      <CustomCardEditorDialog />

      <CdbSetupModal />
    </div>
  )
}

export default App
