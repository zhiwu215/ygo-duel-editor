import React from 'react'
import { PhaseBanner } from './PhaseBanner'
import { LpChangeOverlay } from './components/LpChangeOverlay'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { DetachMaterialModal } from './DetachMaterialModal'
import { EngineFeedbackToast } from './EngineFeedbackToast'
import { EngineCardEditDialogs } from './EngineCardEditDialogs'
import { DuelSelectionBar } from './DuelSelectionBar'
import { DeckSwitcherModal } from './DeckSwitcherModal'
import { CardContextMenu } from './CardContextMenu'
import { CardCommandMenu } from './CardCommandMenu'
import { StagingStatusBar } from './components/StagingStatusBar'
import { CardStatPopover } from './components/CardStatPopover'
import { HeldCardOverlay } from './components/HeldCardOverlay'
import { AttackTargetingBar } from './components/AttackTargetingBar'
import { DuelRequestModals } from './request-modals'

export const DuelBoardOverlays: React.FC = () => {
  return (
    <>
      <PhaseBanner />

      <LpChangeOverlay />

      <PileListModal />

      <HeldCardOverlay />

      <OverlayListModal />

      <DetachMaterialModal />

      <EngineFeedbackToast />

      <EngineCardEditDialogs />

      <DuelSelectionBar />

      <DeckSwitcherModal />

      <CardContextMenu />

      <CardCommandMenu />

      <StagingStatusBar />

      <AttackTargetingBar />

      <CardStatPopover />

      <DuelRequestModals />
    </>
  )
}
