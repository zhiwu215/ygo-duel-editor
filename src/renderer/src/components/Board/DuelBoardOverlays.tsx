import React from 'react'
import { PhaseBanner } from './PhaseBanner'
import { LpChangeOverlay } from './components/LpChangeOverlay'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { EngineFeedbackToast } from './EngineFeedbackToast'
import { EngineCardEditDialogs } from './EngineCardEditDialogs'
import { DuelSelectionBar } from './DuelSelectionBar'
import { DeckSwitcherModal } from './DeckSwitcherModal'
import { CardContextMenu } from './CardContextMenu'
import { CardCommandMenu } from './CardCommandMenu'
import { StagingStatusBar } from './components/StagingStatusBar'
import { CardStatPopover } from './components/CardStatPopover'
import { DuelRequestModals } from './request-modals'

export const DuelBoardOverlays: React.FC = () => {
  return (
    <>
      <PhaseBanner />

      <LpChangeOverlay />

      <PileListModal />

      <OverlayListModal />

      <EngineFeedbackToast />

      <EngineCardEditDialogs />

      <DuelSelectionBar />

      <DeckSwitcherModal />

      <CardContextMenu />

      <CardCommandMenu />

      <StagingStatusBar />

      <CardStatPopover />

      <DuelRequestModals />
    </>
  )
}
