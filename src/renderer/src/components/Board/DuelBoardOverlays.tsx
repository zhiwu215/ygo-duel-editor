import React from 'react'
import { PhaseBanner } from './PhaseBanner'
import { LpChangeOverlay } from './components/LpChangeOverlay'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { EngineFeedbackToast } from './EngineFeedbackToast'
import { EngineCardEditDialogs } from './EngineCardEditDialogs'
import { DuelSelectionBar } from './DuelSelectionBar'
import { ReplayBar } from './ReplayBar'
import { DeckSwitcherModal } from './DeckSwitcherModal'
import { CardContextMenu } from './CardContextMenu'
import { CardCommandMenu } from './CardCommandMenu'
import { CardStatPopover } from './components/CardStatPopover'
import { DuelRequestModals } from './request-modals'
import { ActionIntentBar } from './ActionIntentBar'

export const DuelBoardOverlays: React.FC = () => {
  return (
    <>
      <ReplayBar />

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

      <CardStatPopover />

      <DuelRequestModals />

      <ActionIntentBar />
    </>
  )
}
