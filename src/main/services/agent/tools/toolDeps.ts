import type {
  AgentBoardSetupProposal,
  AgentStepProposal,
  AgentStreamEvent,
  DuelPuzzleState
} from '@shared/index'

export interface AgentTextSource {
  textId?: string
  chapterId?: string
  title: string
  content: string
  chapters?: { title: string; content: string }[]
}

export interface AgentToolDeps {
  emitEvent: (event: AgentStreamEvent) => void
  getBoardState: () => DuelPuzzleState | null
  getTextSource: () => AgentTextSource | null
  getProposals: () => AgentStepProposal[]
  appendProposals: (steps: AgentStepProposal[]) => void
  setBoardSetup: (setup: AgentBoardSetupProposal) => void
}
