import React, { useEffect } from 'react'
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar'
import { DuelScreenplayModal } from './components/StorySequencer/DuelScreenplayModal'
import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
import { CardNoteApp } from './components/LeftSidebar/CardNoteApp'
import { SettingsApp } from './components/Settings/SettingsApp'
import { CdbSetupModal } from './components/CardSearch/CdbSetupModal'
import { useConfigStore } from './stores/useConfigStore'

export function App(): React.JSX.Element {
  const { loadConfig } = useConfigStore()
  const isDeckEditor = window.location.hash === '#deck-editor'
  const isSettingsWindow = window.location.hash.startsWith('#settings')
  const isCardNotes = window.location.hash === '#card-notes'

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  if (isSettingsWindow) {
    return (
      <ConfirmDialogHost>
        <SettingsApp />
      </ConfirmDialogHost>
    )
  }

  if (isCardNotes) {
    return (
      <ConfirmDialogHost>
        <CardNoteApp />
        <CdbSetupModal />
      </ConfirmDialogHost>
    )
  }

  if (isDeckEditor) {
    return (
      <ConfirmDialogHost>
        <DeckEditorApp />
        <CdbSetupModal />
      </ConfirmDialogHost>
    )
  }

  return (
    <ConfirmDialogHost>
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
        <Header />

        <div className="flex-1 flex overflow-hidden">
          <LeftSidebar />

          <DuelBoard />

          <RightSidebar />
        </div>

        <DuelScreenplayModal />

        <CdbSetupModal />
      </div>
    </ConfirmDialogHost>
  )
}

export default App
