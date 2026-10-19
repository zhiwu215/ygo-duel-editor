import type {
  EngineBoardState,
  EngineCard,
  EngineCardEditResult,
  EngineCardRef,
  EngineTimelineNode
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import type { SessionState } from './session-state'
import type { ProvenanceOrigin } from './provenance-tracker'

export type CardEditAction = { type: 'replace'; code: number } | { type: 'remove' }

export interface CardEditorDeps {
  resolveCard(ref: EngineCardRef): { instanceId: string; card: EngineCard } | null
  readBoard(): EngineBoardState
  truncateToCurrentStep(): void
  replayTo(stepId: string, freshIdentity: boolean): void
}

export function replaceCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  newCode: number
): EngineCardEditResult {
  return editCard(state, deps, ref, { type: 'replace', code: newCode })
}

export function removeCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef
): EngineCardEditResult {
  return editCard(state, deps, ref, { type: 'remove' })
}

export function editCard(
  state: SessionState,
  deps: CardEditorDeps,
  ref: EngineCardRef,
  action: CardEditAction
): EngineCardEditResult {
  if (!state.duel || state.duel.ended) {
    return { error: '当前没有进行中的对局。' }
  }
  const current = state.timeline.getCurrentStep()
  if (!current) return { error: '时间线为空，无法编辑。' }

  const resolved = deps.resolveCard(ref)
  if (!resolved) return { error: '无法定位该卡片，可能已离开当前场地。' }
  const record = state.provenance.get(resolved.instanceId)
  if (!record || record.provenance.kind === 'unknown') {
    return { error: '该卡无法安全溯源（可能由效果生成或移动），不能替换或移除。' }
  }
  if (record.provenance.kind === 'drawn' && record.orderStable === false) {
    return {
      error: '该卡抽到前卡组顺序已被洗牌或检索改变，无法安全定位初始卡组条目。'
    }
  }
  const origin = record.origin
  if (!origin) return { error: '该卡没有可编辑的初始来源。' }

  if (action.type === 'replace') {
    if (!cdbService.getCardById(action.code)) {
      return { error: `卡片 ${action.code} 不存在于卡片数据库。` }
    }
  }

  if (origin.kind === 'inject') {
    const op = state.ops[origin.opIndex]
    if (op?.type !== 'inject' || op.command.op !== 'add-card') {
      return { error: '来源注入记录不存在，无法编辑。' }
    }
  } else {
    const puzzleState = state.initParams?.puzzleState
    if (!puzzleState) return { error: '该对局未使用初始牌局快照，无法编辑初始卡组条目。' }
    const target = puzzleState.cards.find((card) => card.instanceId === origin.puzzleCardId)
    if (!target) return { error: '初始牌局中找不到该卡记录。' }
    if (target.code !== origin.code) {
      return { error: '初始牌局记录与来源不一致，已取消编辑。' }
    }
  }

  const currentStepId = current.node.id
  deps.truncateToCurrentStep()
  const previousOps = structuredClone(state.ops)
  const previousInitParams = structuredClone(state.initParams)

  try {
    if (origin.kind === 'inject') {
      const op = state.ops[origin.opIndex]
      if (op?.type !== 'inject' || op.command.op !== 'add-card') {
        throw new Error('来源注入记录不存在，无法编辑。')
      }
      state.ops[origin.opIndex] =
        action.type === 'remove'
          ? { ...op, removed: true }
          : { ...op, command: { ...op.command, code: action.code } }
    } else {
      const nextState = structuredClone(state.initParams!.puzzleState!)
      const target = nextState.cards.find((card) => card.instanceId === origin.puzzleCardId)
      if (!target) throw new Error('初始牌局中找不到该卡记录。')
      if (action.type === 'remove') {
        nextState.cards = nextState.cards.filter((card) => card.instanceId !== origin.puzzleCardId)
      } else {
        target.code = action.code
        target.card = cdbService.getCardById(action.code) ?? target.card
      }
      state.initParams = { ...state.initParams!, puzzleState: nextState }
    }

    deps.replayTo(currentStepId, true)
    const boardState = deps.readBoard()
    const node = state.timeline.getStep(currentStepId)?.node
    if (!node) throw new Error('编辑后找不到当前步骤。')
    node.boardState = boardState
    node.pendingRequest = state.currentPendingRequest
    updateEditedNode(state, node, action, origin)

    return {
      boardState,
      pendingRequest: state.currentPendingRequest,
      node,
      currentStepId
    }
  } catch (err) {
    state.ops = previousOps
    state.initParams = previousInitParams
    try {
      deps.replayTo(currentStepId, true)
    } catch {
      void err
    }
    return { error: err instanceof Error ? err.message : '重演失败，已回滚编辑。' }
  }
}

function updateEditedNode(
  state: SessionState,
  node: EngineTimelineNode,
  action: CardEditAction,
  origin: ProvenanceOrigin
): void {
  if (origin.kind !== 'inject') return
  const editNode =
    state.timeline.getAllNodes().find((item) => item.opIndex === origin.opIndex) ?? node
  if (editNode.opIndex !== origin.opIndex) return
  const oldName = editNode.title.match(/「([^」]*)」$/)?.[1] ?? '卡片'
  if (action.type === 'remove') {
    editNode.title = `剧情安排：移除「${oldName}」`
    editNode.logs = [`[剧情安排] 已移除「${oldName}」`]
    return
  }
  const newName = cdbService.getCardById(action.code)?.name ?? String(action.code)
  editNode.title = editNode.title.replace(/「[^」]*」$/, `「${newName}」`)
  editNode.logs = editNode.logs.map((log) => log.replace(/「[^」]*」$/, `「${newName}」`))
}
