import assert from 'node:assert/strict'
import {
  CardLocation,
  CardPosition,
  createInitialDuelState,
  createLightweightSnapshot,
  duelPhaseFromMask,
  parseDuelDocumentJson,
  reversePileSequences,
  reverseStepBoards,
  type DuelDocument,
  type DuelDocumentEntry,
  type DuelStep,
  type EngineSessionDoc
} from '@shared/index'
import { DuelSession } from '../../src/main/services/duel/duel-session'
import { branchEngineSession } from '../../src/shared/engine/sessionBranch'
import { buildDuelDocumentBranch } from '../../src/renderer/src/utils/duelDocumentBranch'
import { buildPuzzleStateFromEngineBoard } from '../../src/renderer/src/utils/engineBoardToPuzzle'
import { snapshotEngineBoard } from '../../src/renderer/src/utils/engineBoardSnapshot'
import { createDuelBranch } from '../../src/renderer/src/hooks/useDuelBranch'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import { useDuelEngineStore } from '../../src/renderer/src/stores/useDuelEngineStore'
import { useDialogStore } from '../../src/renderer/src/stores/useDialogStore'
import { openDuelDocument } from '../../src/renderer/src/utils/duelDocumentActions'
import { suspendDuelDocumentAutosave } from '../../src/renderer/src/utils/duelDocumentAutosave'
import { autoAnswer } from './autoAnswer'

function step(id: string, patch: Partial<DuelStep> = {}): DuelStep {
  return {
    id,
    turn: 2,
    turnPlayer: 1,
    phase: 'M1',
    actionPlayer: 1,
    actionType: 'EVENT',
    origin: 'manual',
    description: id,
    boardAfter: [],
    ...patch
  }
}

function checkManualBranch(): DuelDocument {
  const state = createInitialDuelState(5, 'full')
  state.title = '原台本'
  state.initialLp = [8000, 8000]
  state.players[0].lp = 3000
  state.players[1].lp = 6000
  state.cards = [
    {
      instanceId: 'future-card',
      code: 15025844,
      controller: 0,
      owner: 0,
      location: CardLocation.HAND,
      sequence: 0,
      position: CardPosition.FACEUP_ATTACK,
      overlayMaterials: []
    }
  ]
  state.steps = [
    step('damage', { lpChange: { player: 0, oldLp: 8000, newLp: 7000 } }),
    step('fork', { texts: [{ id: 'text', text: '原来的台词', auto: false }] }),
    step('future', {
      boardAfter: createLightweightSnapshot(state.cards),
      lpChange: { player: 0, oldLp: 7000, newLp: 3000 }
    }),
    step('future-lp', { lpChange: { player: 1, oldLp: 8000, newLp: 6000 } })
  ]
  const source = { state }
  const before = JSON.stringify(source)
  const branch = buildDuelDocumentBranch(source, 'fork', '新分支')
  assert.equal(branch.state.steps?.length, 2)
  assert.deepEqual(branch.state.cards, [], '空盘面不能回退到当前盘面')
  assert.deepEqual(
    branch.state.players.map((p) => p.lp),
    [7000, 8000]
  )
  assert.equal(branch.state.steps?.[1].texts?.[0].text, '原来的台词')
  branch.state.steps![1].texts![0].text = '新台词'
  assert.equal(JSON.stringify(source), before, '分支必须与原台本完全隔离')
  const legacy = structuredClone(source)
  delete legacy.state.initialLp
  assert.deepEqual(
    buildDuelDocumentBranch(legacy, 'fork', '旧格式').state.players.map((p) => p.lp),
    [7000, 8000]
  )
  assert.throws(() => buildDuelDocumentBranch(source, 'missing', '失败'), /不存在/)
  const missing = structuredClone(source)
  delete missing.state.steps![1].boardAfter
  assert.throws(() => buildDuelDocumentBranch(missing, 'fork', '失败'), /缺少盘面/)
  missing.state.steps![1].origin = 'engine'
  assert.throws(() => buildDuelDocumentBranch(missing, 'fork', '失败'), /引擎历史/)
  return source
}

async function checkEngineBranch(): Promise<void> {
  const state = createInitialDuelState(5, 'full')
  state.players.forEach((player) => {
    player.startHand = 0
  })
  state.cards = [0, 1].flatMap((player) =>
    Array.from({ length: 5 }, (_, sequence) => ({
      instanceId: `deck-${player}-${sequence}`,
      code: 89631139,
      controller: player as 0 | 1,
      owner: player as 0 | 1,
      location: CardLocation.DECK,
      sequence,
      position: CardPosition.FACEDOWN_DEFENSE,
      overlayMaterials: []
    }))
  )
  state.cards.push(
    ...[15025844, 91152256].map((code, sequence) => ({
      instanceId: `hand-${sequence}`,
      code,
      controller: 0 as const,
      owner: 0 as const,
      location: CardLocation.HAND,
      sequence,
      position: CardPosition.FACEUP_ATTACK,
      overlayMaterials: []
    }))
  )
  const session = new DuelSession()
  await session.startDuel({ puzzleState: state, seed: [1, 2, 3, 4, 5, 6, 7, 8] })
  const settle = (): void => {
    for (let guard = 0; guard < 40; guard++) {
      const request = session.getPendingRequest()
      assert.ok(request)
      if (request.kind === 'idle') return
      assert.ok(!session.submitAnswer(autoAnswer(request)).retry)
    }
    assert.fail('无法到达主要阶段')
  }
  settle()
  const idle = session.getPendingRequest()!
  assert.equal(idle.data.kind, 'idle')
  if (idle.data.kind !== 'idle') throw new Error('预期 idle')
  assert.ok(idle.data.summonable.length >= 2)
  assert.ok(
    !session.submitAnswer({ kind: 'idle', cmd: 'SUMMON', card: idle.data.summonable[0] }).retry
  )
  settle()
  const atSummon = session.exportSessionDoc()
  const target = atSummon.timeline.find((node) => node.id === atSummon.currentStepId)!
  const pending = session.getPendingRequest()!
  assert.equal(pending.data.kind, 'idle')
  if (pending.data.kind === 'idle') assert.equal(pending.data.summonable.length, 0)
  await session.inject({ op: 'add-card', player: 0, code: 46986414, to: 'hand' })
  const full = session.exportSessionDoc()
  const original = JSON.stringify(full)
  const source: DuelDocument = {
    state: {
      ...state,
      title: '引擎原台本',
      cards: buildPuzzleStateFromEngineBoard(session.getBoardState(), { title: '原台本' }).cards,
      steps: full.timeline.map((node) =>
        step(node.id, {
          origin: 'engine',
          actId: node.id,
          endActId: node.id,
          turn: node.boardState.turn,
          phase: duelPhaseFromMask(node.boardState.phase),
          turnPlayer: node.boardState.turnPlayer,
          boardAfter: snapshotEngineBoard(node.boardState, 5),
          texts: [{ id: `text-${node.id}`, text: '保留台词', auto: false }]
        })
      )
    },
    engine: full
  }
  const branch = buildDuelDocumentBranch(source, target.id, '引擎分支')
  assert.ok(
    !branch.state.initialBoardSnapshot?.some((card) => card.code === 46986414),
    '分支初始布景不应包含未来注入'
  )
  assert.equal(branch.engine!.ops.length, target.opIndex + 1)
  assert.equal(branch.engine!.timeline.at(-1)!.id, target.id)
  assert.equal(JSON.stringify(full), original)
  const restored = new DuelSession()
  await restored.importSessionDoc(parseDuelDocumentJson(JSON.stringify(branch)).engine!)
  const restoredPending = restored.getPendingRequest()!
  assert.equal(restoredPending.data.kind, 'idle')
  if (restoredPending.data.kind === 'idle') {
    assert.equal(restoredPending.data.summonable.length, 0, '分支不能重置本回合通常召唤次数')
  }
  assert.equal(restored.getBoardState().allCards.length, target.boardState.allCards.length)
  assert.ok(
    !restored.getBoardState().allCards.some((card) => card.code === 46986414),
    '不带入未来注入'
  )
  assert.ok(!restored.submitAnswer({ kind: 'idle', cmd: 'TO_EP' }).retry, '分支可以继续操作')
  assert.equal(JSON.stringify(full), original, '操作分支不影响原路线')
  const ambiguous = structuredClone(source)
  ambiguous.state.steps!.push(step('unanchored-note'))
  assert.throws(
    () => buildDuelDocumentBranch(ambiguous, 'unanchored-note', '失败'),
    /相邻的引擎步骤/
  )
  const suspended = structuredClone(source)
  suspended.engine!.suspended = true
  suspended.state.cards = reversePileSequences(suspended.state.cards)
  suspended.state.steps = reverseStepBoards(suspended.state.steps!)
  assert.deepEqual(
    buildDuelDocumentBranch(suspended, target.id, '引擎分支'),
    branch,
    '挂起分支牌序与运行中一致'
  )
  assert.throws(() => branchEngineSession(full, 'missing'), /引擎记录/)
  const cycle = structuredClone(full)
  cycle.timeline.find((node) => node.id === target.id)!.parentId = target.id
  assert.throws(() => branchEngineSession(cycle, target.id), /循环/)
  const files = new Map<string, DuelDocument>([['C:/branch-smoke/引擎原台本.ygoduel', source]])
  let failRestore = false
  let branchTitle = '可继续的引擎分支'
  const unsubscribe = useDialogStore.subscribe((state) => {
    const request = state.requests[0]
    if (request)
      queueMicrotask(() =>
        useDialogStore.getState().settle(request.id, request.kind === 'prompt' ? branchTitle : true)
      )
  })
  Object.assign(window.api, {
    getDuelEngineSessionDoc: async () => ({ success: true, doc: session.exportSessionDoc() }),
    restoreDuelEngineSession: async (doc: EngineSessionDoc) =>
      failRestore && doc.currentStepId === target.id
        ? { success: false, error: '模拟引擎恢复失败' }
        : { success: true, payload: await session.importSessionDoc(doc) },
    getDuelDocumentTree: async () => ({
      success: true,
      tree: { rootPath: 'C:/branch-smoke', documents: [], folders: [] }
    }),
    readDuelDocument: async (filePath: string) => ({
      success: true,
      document: structuredClone(files.get(filePath))
    }),
    saveDuelDocument: async (filePath: string, doc: DuelDocument) => {
      files.set(filePath, structuredClone(doc))
      return { success: true, filePath }
    },
    createDuelDocument: async (_folder: string, doc: DuelDocument) => {
      const filePath = `C:/branch-smoke/${doc.state.title}.ygoduel`
      files.set(filePath, structuredClone(doc))
      return { success: true, filePath }
    }
  })
  const originalPath = 'C:/branch-smoke/引擎原台本.ygoduel'
  assert.ok((await openDuelDocument(originalPath)).success)
  await createDuelBranch(target.id)
  assert.equal(
    useDuelStore.getState().currentProjectPath,
    'C:/branch-smoke/可继续的引擎分支.ygoduel'
  )
  assert.ok(useDuelEngineStore.getState().isInitialized)
  assert.equal(useDuelEngineStore.getState().currentStepId, target.id)
  const branchRequest = useDuelEngineStore.getState().pendingRequest!
  assert.equal(branchRequest.data.kind, 'idle')
  if (branchRequest.data.kind === 'idle') assert.equal(branchRequest.data.summonable.length, 0)
  assert.equal(files.get(originalPath)!.engine!.timeline.length, full.timeline.length)
  assert.equal(useDuelStore.getState().state.steps!.at(-1)!.texts![0].text, '保留台词')
  assert.ok((await openDuelDocument(originalPath)).success)
  assert.equal(useDuelEngineStore.getState().currentStepId, full.currentStepId)
  failRestore = true
  branchTitle = '恢复失败的分支'
  await createDuelBranch(target.id)
  assert.equal(useDuelStore.getState().currentProjectPath, originalPath)
  assert.ok(useDuelEngineStore.getState().isInitialized, '分支恢复失败后原引擎仍可使用')
  assert.equal(useDuelEngineStore.getState().currentStepId, full.currentStepId)
  unsubscribe()
  console.log('[duel-branch] 引擎历史、召唤次数、未来注入、挂起牌序通过')
}

async function checkWorkflow(source: DuelDocument): Promise<void> {
  const files = new Map<string, DuelDocument>()
  const originalPath = 'C:/branch-smoke/原台本.ygoduel'
  files.set(originalPath, structuredClone(source))
  let saveFails = false
  let branchReadFails = false
  let nextPrompt: string | null = '新分支'
  const alerts: string[] = []
  const unsubscribe = useDialogStore.subscribe((state) => {
    const request = state.requests[0]
    if (!request) return
    queueMicrotask(() => {
      if (request.kind === 'alert') alerts.push(request.description ?? request.title)
      useDialogStore.getState().settle(request.id, request.kind === 'prompt' ? nextPrompt : true)
    })
  })
  ;(globalThis as unknown as { window: unknown }).window = {
    api: {
      getDuelDocumentTree: async () => ({
        success: true,
        tree: {
          rootPath: 'C:/branch-smoke',
          folders: [],
          documents: [...files].map(([filePath, doc]): DuelDocumentEntry => ({
            filePath,
            fileName: `${doc.state.title}.ygoduel`,
            name: doc.state.title,
            title: doc.state.title,
            categoryPath: '',
            updatedAt: 1,
            stepCount: doc.state.steps?.length ?? 0,
            engineStepCount: 0,
            manualStepCount: doc.state.steps?.length ?? 0
          }))
        }
      }),
      saveDuelDocument: async (path: string, doc: DuelDocument) => {
        if (saveFails) return { success: false, error: '模拟写入失败' }
        files.set(path, structuredClone(doc))
        return { success: true, filePath: path }
      },
      createDuelDocument: async (_folder: string, doc: DuelDocument) => {
        const filePath = `C:/branch-smoke/${doc.state.title}.ygoduel`
        assert.ok(!files.has(filePath), '不能覆盖已有台本')
        files.set(filePath, structuredClone(doc))
        return { success: true, filePath }
      },
      readDuelDocument: async (filePath: string) =>
        branchReadFails && filePath !== originalPath
          ? { success: false, error: '模拟打开失败' }
          : { success: true, document: structuredClone(files.get(filePath)) },
      getDuelEngineSupport: async () => ({ supported: true })
    }
  }
  const prepare = (): void => {
    suspendDuelDocumentAutosave()
    useDuelEngineStore.setState({
      isInitialized: false,
      loading: false,
      replayInfo: null,
      suspendedDoc: null
    })
    useDuelStore.getState().loadProjectAndStart(structuredClone(source.state))
    useDuelStore.getState().setCurrentProjectPath(originalPath)
  }
  prepare()
  nextPrompt = null
  await createDuelBranch('fork')
  assert.equal(files.size, 1, '取消不创建文件')
  nextPrompt = '新分支'
  saveFails = true
  await createDuelBranch('fork')
  assert.equal(files.size, 1, '原台本保存失败不能切换或创建分支')
  assert.equal(useDuelStore.getState().currentProjectPath, originalPath)
  saveFails = false
  await createDuelBranch('fork')
  assert.equal(files.size, 2)
  assert.equal(files.get(originalPath)!.state.steps!.length, 4)
  assert.equal(useDuelStore.getState().currentProjectPath, 'C:/branch-smoke/新分支.ygoduel')
  assert.equal(useDuelStore.getState().state.steps!.length, 2)
  assert.equal(useDuelStore.getState().currentStepIndex, 1)
  assert.equal(useDuelStore.getState().currentTurn, 2)
  assert.equal(useDuelStore.getState().currentPhase, 'M1')
  assert.deepEqual(
    useDuelStore.getState().state.players.map((p) => p.lp),
    [7000, 8000]
  )
  assert.equal(useDuelStore.temporal.getState().pastStates.length, 0)
  assert.ok((await openDuelDocument(originalPath)).success)
  assert.equal(useDuelStore.getState().state.steps!.length, 4, '原台本可重新打开')
  prepare()
  nextPrompt = '打开失败分支'
  branchReadFails = true
  await createDuelBranch('fork')
  assert.equal(useDuelStore.getState().currentProjectPath, originalPath)
  assert.equal(useDuelStore.getState().state.steps!.length, 4)
  assert.ok(alerts.some((message) => message.includes('模拟写入失败')))
  assert.ok(alerts.some((message) => message.includes('已重新打开')))
  unsubscribe()
  suspendDuelDocumentAutosave()
  console.log('[duel-branch] 取消、原台本保护、保存失败、分支切换、失败恢复通过')
}

async function main(): Promise<void> {
  const source = checkManualBranch()
  await checkWorkflow(source)
  await checkEngineBranch()
  console.log('[duel-branch] ALL PASSED')
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
