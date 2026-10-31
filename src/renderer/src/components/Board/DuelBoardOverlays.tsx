import React from 'react'
import { PhaseBanner } from './PhaseBanner'
import { LpChangeOverlay } from './components/LpChangeOverlay'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { DetachMaterialModal } from './DetachMaterialModal'
import { EngineFeedbackToast } from './EngineFeedbackToast'
import { DuelSelectionBar } from './DuelSelectionBar'
import { DeckSwitcherModal } from './DeckSwitcherModal'
import { CardContextMenu } from './CardContextMenu'
import { CardCommandMenu } from './CardCommandMenu'
import { PileActionMenu } from './PileActionMenu'
import { CardStatPopover } from './components/CardStatPopover'
import { EngineCardEditBusy } from './components/EngineCardEditBusy'
import { EngineAutoReplayBusy } from './components/EngineAutoReplayBusy'
import { EngineCardReplaceDialog } from './components/EngineCardReplaceDialog'
import { EngineInjectDropDialog } from './components/EngineInjectDropDialog'
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

      <DuelSelectionBar />

      <DeckSwitcherModal />

      <CardContextMenu />

      <CardCommandMenu />

      <PileActionMenu />

      <AttackTargetingBar />

      <CardStatPopover />

      <EngineCardEditBusy />

      <EngineAutoReplayBusy />

      <EngineCardReplaceDialog />

      <EngineInjectDropDialog />

      <DuelRequestModals />
    </>
  )
}
