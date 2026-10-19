import React from 'react'
import { ProvenanceDialog } from './components/ProvenanceDialog'
import { ReplaceCardDialog } from './components/ReplaceCardDialog'

export const EngineCardEditDialogs: React.FC = () => (
  <>
    <ProvenanceDialog />
    <ReplaceCardDialog />
  </>
)
