import {
  EngineCard,
  EngineCardEditConflict,
  EngineCardEditResult,
  EngineCardRef,
  EngineEditedCardInfo,
  EngineTimelineNode,
  isPlaceholderCard,
  isStandardTag,
  placeholderCardData,
  placeholderKindLabel,
  placeholderKindOf,
  PLACEHOLDER_CARD_NAME
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { headPendingQuery, type SessionState } from './session-state'
import { resolveProvenanceRecord, type ProvenanceOrigin } from './provenance-tracker'
import { ReplayDivergenceError } from './replay-policy'
import { cardEditOriginCandidates, type CardEditAction } from './card-edit-source'
import {
  captureCardEditBase,
  cardEditCodeRemap,
  prepareCardEditOrigin,
  replayCardEdit,
  restoreCardEdit,
  restoreCardEditBase,
  type CardEditReplayArgs,
  type CardEditReplayDeps
} from './card-edit-replay'

export type { CardEditAction } from './card-edit-source'

export interface CardEditorDeps extends CardEditReplayDeps {
  resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null
}

export interface CardEditorOptions {
  allowDivergence?: boolean
}

export async function replaceCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  newCode: number,
  options: CardEditorOptions = {}
): Promise<EngineCardEditResult> {
  return editCard(state, deps, ref, { type: 'replace', code: newCode }, options)
}

export async function removeCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  options: CardEditorOptions = {}
): Promise<EngineCardEditResult> {
  return editCard(state, deps, ref, { type: 'remove' }, options)
}

async function editCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  action: CardEditAction,
  options: CardEditorOptions
): Promise<EngineCardEditResult> {
  if (!state.duel || state.duel.ended) {
    return { error: '当前没有进行中的对局。' }
  }
  const current = state.timeline.getCurrentStep()
  if (!current) return { error: '时间线为空，无法编辑。' }

  const resolved = deps.resolveCard(ref)
  if (!resolved) return { error: '无法定位该卡片，可能已离开当前场地。' }
  const record = resolveProvenanceRecord(state, resolved.card)
  if (!record?.origin) {
    return { error: '该卡无法溯源（可能由效果生成或移动），不能替换或移除。' }
  }
  const matchConfig = state.initParams?.puzzleState?.matchConfig
  const editablePlaceholder = isPlaceholderCard(resolved.card.code)
  if (
    matchConfig &&
    matchConfig.mode !== '1v1' &&
    !isStandardTag(matchConfig) &&
    record.origin.kind !== 'inject' &&
    !editablePlaceholder
  ) {
    return { error: '多人数对局只能编辑占位卡或手动添加的卡片。' }
  }
  if (
    action.type === 'replace' &&
    !cdbService.getCardById(action.code) &&
    !isPlaceholderCard(action.code)
  ) {
    return { error: `卡片 ${action.code} 不存在于卡片数据库。` }
  }

  const currentStepId = current.node.id
  const base = captureCardEditBase(state)
  const origins =
    action.type === 'replace' ? cardEditOriginCandidates(state, record.origin) : [record.origin]
  const replayArgs: CardEditReplayArgs = {
    action,
    origins,
    oldCode: record.code,
    resolved,
    stepId: currentStepId,
    base
  }

  const outcome = await replayCardEdit(state, deps, replayArgs)
  if (outcome.origin) {
    return buildEditResult(
      state,
      deps,
      action,
      outcome.origin,
      record.code,
      resolved,
      currentStepId
    )
  }
  if (outcome.missed) {
    const restored = await restoreCardEdit(state, deps, base)
    if (!restored) return { error: '重演失败，且未能恢复到编辑前的状态。' }
    return {
      error:
        '替换后新卡没有落在原来的位置：历史操作会把它移到其它区域。这张卡可能已经在历史中被丢弃或使用，请换一个替换目标。'
    }
  }
  if (outcome.divergence) {
    return handleDivergence(state, deps, replayArgs, outcome.divergence, options)
  }

  const restored = await restoreCardEdit(state, deps, base)
  if (!restored) return { error: '重演失败，且未能恢复到编辑前的状态。' }
  return {
    error: outcome.error instanceof Error ? outcome.error.message : '重演失败，已回滚编辑。'
  }
}

async function handleDivergence(
  state: SessionState,
  deps: CardEditorDeps,
  replayArgs: CardEditReplayArgs,
  divergence: { error: ReplayDivergenceError; origin: ProvenanceOrigin },
  options: CardEditorOptions
): Promise<EngineCardEditResult> {
  const { error, origin } = divergence
  const forkStepId = error.forkStepId
  const forkRecord = forkStepId ? state.timeline.getStep(forkStepId) : null
  const sourceOpIndex = origin.kind === 'inject' ? origin.opIndex : -1
  if (
    !forkRecord ||
    !forkStepId ||
    (sourceOpIndex >= 0 && forkRecord.node.opIndex < sourceOpIndex)
  ) {
    const restored = await restoreCardEdit(state, deps, replayArgs.base)
    if (!restored) return { error: '重演失败，且未能恢复到编辑前的状态。' }
    if (!forkRecord) return { error: error.message }
    return { conflict: buildConflict(state, error, forkRecord.node) }
  }

  if (!options.allowDivergence) {
    const restored = await restoreCardEdit(state, deps, replayArgs.base)
    if (!restored) return { error: '重演失败，且未能恢复到编辑前的状态。' }
    return { conflict: buildConflict(state, error, forkRecord.node) }
  }

  try {
    restoreCardEditBase(state, deps, replayArgs.base)
    if (!prepareCardEditOrigin(state, replayArgs, origin)) {
      await restoreCardEdit(state, deps, replayArgs.base)
      return { error: '该卡的来源记录不存在，无法编辑。' }
    }
    state.timeline.retainHistory(forkStepId)
    state.ops.length = forkRecord.node.opIndex + 1
    await deps.replayTo(
      forkStepId,
      true,
      cardEditCodeRemap(replayArgs.action, replayArgs.oldCode) ?? undefined
    )
    return buildEditResult(
      state,
      deps,
      replayArgs.action,
      origin,
      replayArgs.oldCode,
      replayArgs.resolved,
      forkStepId,
      {
        divergenceWarning: `${replayArgs.action.type === 'replace' ? '卡片已修改' : '卡片已移除'}，但对局在第 ${error.opIndex + 1} 条操作处无法与原历史对齐（原询问「${error.expectedTitle}」，重建后是「${error.actualTitle}」：${error.message}）。已回退到第 ${forkRecord.node.stepNumber} 步，之后的操作需要重新进行。`
      }
    )
  } catch (forkErr) {
    console.error('[card-editor] 分叉重放失败:', forkErr)
    await restoreCardEdit(state, deps, replayArgs.base)
    return { error: forkErr instanceof Error ? forkErr.message : '分叉重放失败，已回滚编辑。' }
  }
}

interface BuildResultOptions {
  divergenceWarning?: string
}

function buildEditResult(
  state: SessionState,
  deps: CardEditorDeps,
  action: CardEditAction,
  origin: ProvenanceOrigin,
  oldCode: number,
  resolved: { instanceId: string; card: EngineCard },
  stepId: string,
  options: BuildResultOptions = {}
): EngineCardEditResult {
  const boardState = deps.readBoard()
  const node = state.timeline.getStep(stepId)?.node
  if (!node) throw new Error('编辑后找不到当前步骤。')
  node.boardState = boardState
  node.pendingRequest = headPendingQuery(state)?.request ?? null
  updateEditedNodeTitle(state, origin, action)
  const editedCard: EngineEditedCardInfo = {
    action: action.type,
    originKind: origin.kind,
    instanceId: origin.kind === 'initial' ? origin.puzzleCardId : resolved.card.instanceId,
    oldCode,
    newCode: action.type === 'replace' ? action.code : 0,
    card:
      action.type === 'replace'
        ? (cdbService.getCardById(action.code) ?? placeholderCardData(action.code) ?? undefined)
        : undefined
  }
  const warning = options.divergenceWarning
  return {
    boardState,
    pendingRequest: headPendingQuery(state)?.request ?? null,
    node,
    currentStepId: stepId,
    warning: warning || undefined,
    puzzleState: state.initParams?.puzzleState
      ? structuredClone(state.initParams.puzzleState)
      : undefined,
    editedCard
  }
}

function buildConflict(
  state: SessionState,
  err: ReplayDivergenceError,
  forkNode: EngineTimelineNode
): EngineCardEditConflict {
  const path = state.timeline.getHistoryPath()
  const forkIndex = path.findIndex((node) => node.id === forkNode.id)
  return {
    opIndex: err.opIndex,
    expectedTitle: err.expectedTitle,
    actualTitle: err.actualTitle,
    message: err.message,
    forkStepId: forkNode.id,
    forkStepNumber: forkNode.stepNumber,
    forkTitle: forkNode.title,
    discardedSteps: forkIndex >= 0 ? path.length - 1 - forkIndex : 0
  }
}

function updateEditedNodeTitle(
  state: SessionState,
  origin: ProvenanceOrigin,
  action: CardEditAction
): void {
  if (origin.kind !== 'inject') return
  const node: EngineTimelineNode | undefined = state.timeline
    .getAllNodes()
    .find((item) => item.opIndex === origin.opIndex)
  if (!node) return
  const oldName = node.title.match(/「([^」]*)」$/)?.[1] ?? '卡片'
  if (action.type === 'remove') {
    node.title = `注入：移除「${oldName}」`
    node.logs = [`[注入] 移除「${oldName}」`]
    return
  }
  const newName = cdbService.getCardById(action.code)?.name ?? placeholderCardName(action.code)
  node.title = `注入：替换「${oldName}」→「${newName}」`
  node.logs = [`[注入] 替换「${oldName}」→「${newName}」`]
}

function placeholderCardName(code: number): string {
  const kind = placeholderKindOf(code)
  if (!kind) return String(code)
  return `${PLACEHOLDER_CARD_NAME}（${placeholderKindLabel(kind)}）`
}
