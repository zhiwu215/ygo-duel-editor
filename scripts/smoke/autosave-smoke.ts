/**
 * 自动保存冒烟：验证文档修改会写回当前台本、预览/暂停期间不写盘。
 */
import type { DuelDocument, DuelDocumentWriteResult } from '@shared/index'
import { normalizeDuelState } from '@shared/index'
import { useDuelStore } from '../../src/renderer/src/stores/useDuelStore'
import {
  flushDuelDocumentAutosave,
  getDuelDocumentSaveStatus,
  hasUnsavedDuelDocument,
  markDuelDocumentDirty,
  resumeDuelDocumentAutosave,
  suspendDuelDocumentAutosave
} from '../../src/renderer/src/utils/duelDocumentAutosave'
import {
  clearDuelDocumentDraft,
  readDuelDocumentDraft,
  writeDuelDocumentDraft
} from '../../src/renderer/src/utils/duelDocumentDraft'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

const saveCalls: { filePath: string; document: DuelDocument }[] = []

;(globalThis as unknown as { window: unknown }).window = {
  api: {
    saveDuelDocument: async (
      filePath: string,
      document: DuelDocument
    ): Promise<DuelDocumentWriteResult> => {
      saveCalls.push({ filePath, document })
      return { success: true, filePath }
    }
  }
}

const storage = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key)
}

function initialState(): ReturnType<typeof normalizeDuelState> {
  return normalizeDuelState({
    version: '1.2.0',
    title: '自动保存测试',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0 as 0 | 1,
    firstTurnAttack: false,
    cards: [],
    steps: [],
    duelists: [
      { id: 'duelist_0_0', team: 0, name: '我方', lp: 8000, isFirst: true, turnOrder: 1 },
      { id: 'duelist_1_0', team: 1, name: '对方', lp: 8000, turnOrder: 2 }
    ],
    matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false },
    scenarios: {}
  })
}

function prepare(filePath: string | null): void {
  useDuelStore.setState({
    state: initialState(),
    currentProjectPath: filePath,
    previewReturn: null
  })
  resumeDuelDocumentAutosave()
}

async function checkSavesChangedDocument(): Promise<void> {
  prepare('C:/tmp/autosave.ygoduel')
  useDuelStore.getState().addStep({
    turn: 1,
    turnPlayer: 0,
    phase: 'M1',
    actionPlayer: 0,
    actionType: 'NORMAL_SUMMON',
    cardName: '魔鬼机车',
    description: '通常召唤'
  })
  markDuelDocumentDirty()
  assert(getDuelDocumentSaveStatus().status === 'pending', '修改后状态应为待保存')
  assert(hasUnsavedDuelDocument(), '修改后应存在未保存内容')

  const saved = await flushDuelDocumentAutosave()
  assert(saved, '自动保存应成功')
  assert(saveCalls.length === 1, `应写入 1 次，实际 ${saveCalls.length} 次`)
  assert(saveCalls[0].filePath === 'C:/tmp/autosave.ygoduel', '应写回当前台本路径')
  assert(saveCalls[0].document.state.title === '自动保存测试', '应保存当前标题')
  assert(saveCalls[0].document.state.steps?.length === 1, '应保存新增步骤')
  assert(getDuelDocumentSaveStatus().status === 'saved', '保存后状态应为已保存')
  assert(!hasUnsavedDuelDocument(), '保存后不应再有未保存内容')
}

async function checkNoPathOnlyMarksUnsaved(): Promise<void> {
  prepare(null)
  const before = saveCalls.length
  useDuelStore.getState().setTitle('未保存标题')
  markDuelDocumentDirty()
  assert(getDuelDocumentSaveStatus().status === 'unsaved', '无路径时状态应为未保存')
  const saved = await flushDuelDocumentAutosave()
  assert(!saved, '无路径时不应自动保存')
  assert(saveCalls.length === before, '无路径时不应调用写盘')
}

async function checkSuspendSkipsSaves(): Promise<void> {
  prepare('C:/tmp/suspended.ygoduel')
  const before = saveCalls.length
  suspendDuelDocumentAutosave()
  useDuelStore.getState().setTitle('暂停期间修改')
  markDuelDocumentDirty()
  assert(!hasUnsavedDuelDocument(), '暂停期间不应累计未保存内容')
  await flushDuelDocumentAutosave()
  assert(saveCalls.length === before, '暂停期间不应调用写盘')
  resumeDuelDocumentAutosave()
  assert(getDuelDocumentSaveStatus().status === 'idle', '恢复后状态应重置')
}

async function checkPreviewSkipsSaves(): Promise<void> {
  prepare('C:/tmp/preview.ygoduel')
  const state = useDuelStore.getState().state
  useDuelStore.setState({
    previewReturn: {
      state,
      currentTurn: 1,
      currentPhase: 'M1',
      currentChain: 0,
      activeTurnPlayer: 0
    }
  })
  const before = saveCalls.length
  markDuelDocumentDirty()
  assert(!(await flushDuelDocumentAutosave()), '预览期间不应保存')
  assert(saveCalls.length === before, '预览期间不应调用写盘')

  useDuelStore.setState({ previewReturn: null })
  markDuelDocumentDirty()
  assert(await flushDuelDocumentAutosave(), '退出预览后应能保存')
  assert(saveCalls.length === before + 1, '退出预览后应写入 1 次')
}

async function checkDebouncedSave(): Promise<void> {
  prepare('C:/tmp/debounced.ygoduel')
  const before = saveCalls.length
  useDuelStore.getState().setTitle('定时自动保存')
  markDuelDocumentDirty()
  assert(getDuelDocumentSaveStatus().status === 'pending', '修改后应进入待保存状态')
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert(saveCalls.length === before + 1, '停止修改后应由定时器触发 1 次保存')
  assert(saveCalls[before].document.state.title === '定时自动保存', '定时保存应写入最新标题')
  assert(getDuelDocumentSaveStatus().status === 'saved', '定时保存后状态应为已保存')
}

async function checkDraftRoundTrip(): Promise<void> {
  prepare('C:/tmp/draft.ygoduel')
  useDuelStore.getState().setTitle('草稿标题')
  writeDuelDocumentDraft()
  const draft = readDuelDocumentDraft()
  assert(Boolean(draft), '应写入未保存草稿')
  assert(draft!.filePath === 'C:/tmp/draft.ygoduel', '草稿应记录当前台本路径')
  assert(draft!.state.title === '草稿标题', '草稿应记录当前标题')
  clearDuelDocumentDraft()
  assert(readDuelDocumentDraft() === null, '清除后不应再读到草稿')

  prepare(null)
  const empty = initialState()
  empty.title = ''
  useDuelStore.setState({ state: empty })
  writeDuelDocumentDraft()
  assert(readDuelDocumentDraft() === null, '空内容不应写入草稿')
}

async function main(): Promise<void> {
  await checkSavesChangedDocument()
  await checkNoPathOnlyMarksUnsaved()
  await checkSuspendSkipsSaves()
  await checkPreviewSkipsSaves()
  await checkDebouncedSave()
  await checkDraftRoundTrip()
  console.log('[autosave] ALL PASSED')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
