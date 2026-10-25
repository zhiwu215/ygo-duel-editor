import { DuelPuzzleState, DuelStep, PHASE_NAMES, displayStepTextBlocks } from '@shared/index'
import { stepCardName } from './cardNames'
import { resolveDuelistName, resolveTeamLabel } from './duelistNames'

export interface ScreenplayTextOptions {
  cardNameWrapper?: string
}

function stepActor(state: DuelPuzzleState, step: DuelStep): string {
  return (
    resolveDuelistName(state.duelists, step.actionDuelistId) ||
    resolveTeamLabel(state, step.actionPlayer, step.turn)
  )
}

export function buildScreenplayText(
  state: DuelPuzzleState,
  options?: ScreenplayTextOptions
): string {
  const lines: string[] = []
  const steps = state.steps || []
  if (steps.length === 0) return ''

  let currentTurn: number | null = null
  let currentPhase: string | null = null

  steps.forEach((step) => {
    if (step.turn !== currentTurn) {
      currentTurn = step.turn
      currentPhase = step.phase
      lines.push(
        `第 ${step.turn} 回合 · ${resolveTeamLabel(state, step.turnPlayer, step.turn)}的回合`
      )
      lines.push(PHASE_NAMES[step.phase])
    } else if (step.phase !== currentPhase) {
      currentPhase = step.phase
      lines.push(PHASE_NAMES[step.phase])
    }

    const textStep = step.cardName ? step : { ...step, cardName: stepCardName(step) }
    const blocks = displayStepTextBlocks(textStep, stepActor(state, step), options?.cardNameWrapper)
    for (const block of blocks) {
      if (!block.text.trim()) continue
      lines.push(block.text.trim())
    }
  })

  return `${lines.join('\n').trimEnd()}\n`
}
