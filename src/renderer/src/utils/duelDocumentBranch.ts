import {
  computeBoardFingerprint,
  restoreCardsFromSnapshot,
  reverseStepBoards,
  type DuelDocument,
  type DuelPuzzleState,
  type DuelStep
} from '@shared/index'
import { branchEngineSession } from '@shared/engine/sessionBranch'
import { applyLpToDuelists } from './duelistLp'
import { reconstructOpeningFromSession } from '../stores/duelEngine/openingFromSession'

function manualLpAtStep(state: DuelPuzzleState, index: number): [number, number] {
  const steps = state.steps ?? []
  const lp: [number, number] = state.initialLp
    ? [...state.initialLp]
    : [state.players[0].lp, state.players[1].lp]
  if (!state.initialLp) {
    for (const player of [0, 1] as const) {
      const first = steps.find((step) => step.lpChange?.player === player)?.lpChange
      if (first) lp[player] = first.oldLp
    }
  }
  for (const step of steps.slice(0, index + 1)) {
    if (step.lpChange) lp[step.lpChange.player] = step.lpChange.newLp
  }
  return lp
}

function branchActId(step: DuelStep): string | undefined {
  return step.endActId ?? step.actId ?? step.afterActId
}

export function buildDuelDocumentBranch(
  source: DuelDocument,
  stepId: string,
  title: string
): DuelDocument {
  const index = source.state.steps?.findIndex((step) => step.id === stepId) ?? -1
  if (index < 0) throw new Error('该步骤已不存在，请重新选择分支起点。')
  const branch = structuredClone(source)
  const sourceSteps = branch.state.steps!
  const selected = sourceSteps[index]
  const actId = branchActId(selected)
  const engineNode = actId ? branch.engine?.timeline.find((node) => node.id === actId) : undefined
  if (!engineNode && (selected.origin === 'engine' || selected.origin === 'replay' || actId)) {
    throw new Error('该步骤没有可恢复的引擎历史，无法从这里继续原对局。')
  }
  let steps = sourceSteps.slice(0, index + 1)
  if (!engineNode && branch.engine) {
    const timelineIds = new Set(branch.engine.timeline.map((node) => node.id))
    if (steps.some((step) => timelineIds.has(branchActId(step) ?? ''))) {
      throw new Error('该手动步骤没有对应的引擎位置，请从相邻的引擎步骤创建分支。')
    }
  }
  if (
    (engineNode && branch.engine?.suspended) ||
    (!engineNode && branch.engine && !branch.engine.suspended)
  ) {
    steps = reverseStepBoards(steps)
  }
  const snapshot = steps[index].boardAfter
  if (!snapshot) throw new Error('该步骤缺少盘面记录，无法创建分支。')
  const lp: [number, number] = engineNode
    ? [engineNode.boardState.players[0].lp, engineNode.boardState.players[1].lp]
    : manualLpAtStep(branch.state, index)
  branch.state = {
    ...branch.state,
    title: title.trim(),
    steps,
    cards: restoreCardsFromSnapshot(branch.state.cards, snapshot),
    players: [
      { ...branch.state.players[0], lp: lp[0] },
      { ...branch.state.players[1], lp: lp[1] }
    ],
    duelists: applyLpToDuelists(
      applyLpToDuelists(branch.state.duelists, 0, lp[0], branch.state.matchConfig),
      1,
      lp[1],
      branch.state.matchConfig
    )
  }
  if (engineNode && branch.engine) {
    branch.engine = branchEngineSession(branch.engine, engineNode.id)
    const opening = reconstructOpeningFromSession(branch.engine)
    if (opening) {
      branch.state.initialBoardSnapshot = opening.initialBoardSnapshot
      branch.state.initialLp = opening.initialLp
    }
    branch.engine.boardFingerprint = computeBoardFingerprint(branch.state, {
      enginePileOrder: true
    })
  } else {
    delete branch.engine
  }
  return branch
}
