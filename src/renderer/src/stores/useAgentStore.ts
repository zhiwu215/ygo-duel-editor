import { create } from 'zustand'
import { createChatSlice } from './agent/chatSlice'
import { createConfigSlice } from './agent/configSlice'
import { createPanelSlice } from './agent/panelSlice'
import type { AgentStore } from './agent/types'

export const useAgentStore = create<AgentStore>()((...a) => ({
  ...createPanelSlice(...a),
  ...createConfigSlice(...a),
  ...createChatSlice(...a)
}))

export type { AgentStore } from './agent/types'
export type { AgentChatMessage, AgentToolCallItem } from './agent/types'
