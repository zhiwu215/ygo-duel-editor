import {
  CardLocation,
  EngineBoardState,
  EngineCard,
  EngineCardEditResult,
  EngineCardRef,
  EngineEditedCardInfo,
  EngineTimelineNode,
  isStandardTag,
  isPlaceholderCard,
  placeholderCardData,
  placeholderKindLabel,
  placeholderKindOf,
  PLACEHOLDER_CARD_NAME
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { headPendingQuery, type SessionState } from './session-state'
import { resolveProvenanceRecord, type ProvenanceOrigin } from './provenance-tracker'
import { ReplayDivergenceError } from './replay-policy'
import { remapRecordedAnswers, type CardPosition } from './answer-remap'

export type CardEditAction = { type: 'replace'; code: number } | { type: 'remove' }

export interface CardEditorDeps {
  resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null
  readBoard(): EngineBoardState
  truncateToCurrentStep(): void
  replayTo(stepId: string, freshIdentity: boolean): Promise<void>
}

export async function replaceCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  newCode: number
): Promise<EngineCardEditResult> {
  return editCard(state, deps, ref, { type: 'replace', code: newCode })
}

export async function removeCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef
): Promise<EngineCardEditResult> {
  return editCard(state, deps, ref, { type: 'remove' })
}

async function editCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  action: CardEditAction
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
  const handPlaceholder =
    resolved.card.location === CardLocation.HAND && isPlaceholderCard(resolved.card.code)
  if (
    matchConfig &&
    matchConfig.mode !== '1v1' &&
    !isStandardTag(matchConfig) &&
    record.origin.kind !== 'inject' &&
    !handPlaceholder
  ) {
    return { error: '多人数对局只能编辑手牌占位卡或手动添加的卡片。' }
  }
  if (
    action.type === 'replace' &&
    !cdbService.getCardById(action.code) &&
    !isPlaceholderCard(action.code)
  ) {
    return { error: `卡片 ${action.code} 不存在于卡片数据库。` }
  }

  const currentStepId = current.node.id
  const previousOps = structuredClone(state.ops)
  const previousInitParams = state.initParams ? structuredClone(state.initParams) : null

  if (!applySourceEdit(state, record.origin, action)) {
    return { error: '该卡的来源记录不存在，无法编辑。' }
  }

  if (action.type === 'replace') {
    const positions: CardPosition[] = [
      {
        controller: resolved.card.controller,
        location: resolved.card.location,
        sequence: resolved.card.sequence
      }
    ]
    remapRecordedAnswers(state, record.code, action.code, positions, resolved.card.instanceId)
  }

  deps.truncateToCurrentStep()

  try {
    await deps.replayTo(currentStepId, true)
    const boardState = deps.readBoard()
    const node = state.timeline.getStep(currentStepId)?.node
    if (!node) throw new Error('编辑后找不到当前步骤。')
    node.boardState = boardState
    node.pendingRequest = headPendingQuery(state)?.request ?? null
    updateEditedNodeTitle(state, record.origin, action)
    const editedCard: EngineEditedCardInfo = {
      action: action.type,
      originKind: record.origin.kind,
      instanceId:
        record.origin.kind === 'initial' ? record.origin.puzzleCardId : resolved.card.instanceId,
      oldCode: record.code,
      newCode: action.type === 'replace' ? action.code : 0,
      card:
        action.type === 'replace'
          ? (cdbService.getCardById(action.code) ?? placeholderCardData(action.code) ?? undefined)
          : undefined
    }
    return {
      boardState,
      pendingRequest: headPendingQuery(state)?.request ?? null,
      node,
      currentStepId,
      puzzleState: state.initParams?.puzzleState
        ? structuredClone(state.initParams.puzzleState)
        : undefined,
      editedCard
    }
  } catch (err) {
    if (err instanceof ReplayDivergenceError && err.forkStepId) {
      const forkRecord = state.timeline.getStep(err.forkStepId)
      const sourceOpIndex = record.origin.kind === 'inject' ? record.origin.opIndex : -1
      if (forkRecord && (sourceOpIndex < 0 || forkRecord.node.opIndex >= sourceOpIndex)) {
        try {
          state.timeline.retainHistory(err.forkStepId)
          state.ops.length = forkRecord.node.opIndex + 1
          await deps.replayTo(err.forkStepId, true)
          const boardState = deps.readBoard()
          const node = state.timeline.getStep(err.forkStepId)?.node
          if (!node) throw new Error('分叉后找不到步骤。')
          node.boardState = boardState
          node.pendingRequest = headPendingQuery(state)?.request ?? null
          updateEditedNodeTitle(state, record.origin, action)
          const editedCard: EngineEditedCardInfo = {
            action: action.type,
            originKind: record.origin.kind,
            instanceId:
              record.origin.kind === 'initial'
                ? record.origin.puzzleCardId
                : resolved.card.instanceId,
            oldCode: record.code,
            newCode: action.type === 'replace' ? action.code : 0,
            card:
              action.type === 'replace'
                ? (cdbService.getCardById(action.code) ??
                  placeholderCardData(action.code) ??
                  undefined)
                : undefined
          }
          return {
            boardState,
            pendingRequest: headPendingQuery(state)?.request ?? null,
            node,
            currentStepId: err.forkStepId,
            warning: `${action.type === 'replace' ? '卡片已修改' : '卡片已移除'}，但对局在第 ${err.opIndex + 1} 条操作处无法与原历史对齐（原询问「${err.expectedTitle}」，重建后是「${err.actualTitle}」：${err.message}）。已回到该步之前，之后的操作需要重新进行。`,
            puzzleState: state.initParams?.puzzleState
              ? structuredClone(state.initParams.puzzleState)
              : undefined,
            editedCard
          }
        } catch (forkErr) {
          console.error('[card-editor] 分叉重放失败:', forkErr)
        }
      }
    }
    state.ops = previousOps
    state.initParams = previousInitParams
    try {
      await deps.replayTo(currentStepId, true)
    } catch {
      void err
    }
    return { error: err instanceof Error ? err.message : '重演失败，已回滚编辑。' }
  }
}

function applySourceEdit(
  state: SessionState,
  origin: ProvenanceOrigin,
  action: CardEditAction
): boolean {
  if (origin.kind === 'inject') {
    const op = state.ops[origin.opIndex]
    if (op?.type !== 'inject' || op.command.op !== 'add-card') return false
    state.ops[origin.opIndex] =
      action.type === 'remove'
        ? { ...op, removed: true }
        : { ...op, command: { ...op.command, code: action.code } }
    return true
  }

  const puzzleState = state.initParams?.puzzleState
  if (!puzzleState) return false
  const target = puzzleState.cards.find((card) => card.instanceId === origin.puzzleCardId)
  if (!target || target.code !== origin.code) return false
  if (action.type === 'remove') {
    puzzleState.cards = puzzleState.cards.filter((card) => card.instanceId !== origin.puzzleCardId)
    if (puzzleState.initialBoardSnapshot) {
      puzzleState.initialBoardSnapshot = puzzleState.initialBoardSnapshot.filter(
        (snap) => snap.instanceId !== origin.puzzleCardId
      )
    }
  } else {
    target.code = action.code
    target.card =
      cdbService.getCardById(action.code) ?? placeholderCardData(action.code) ?? target.card
    if (puzzleState.initialBoardSnapshot) {
      for (const snap of puzzleState.initialBoardSnapshot) {
        if (snap.instanceId === origin.puzzleCardId) {
          snap.code = action.code
        }
      }
    }
  }
  return true
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
