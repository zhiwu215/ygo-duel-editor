import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useBlockingTaskStore } from '../stores/useBlockingTaskStore'
import { alertDialog, promptDialog, useDialogStore } from '../stores/useDialogStore'
import { buildDuelDocument } from '../utils/duelDocumentBuild'
import { buildDuelDocumentBranch } from '../utils/duelDocumentBranch'
import { createDuelDocumentForCurrentDuel } from '../utils/duelDocumentCreate'
import { openDuelDocument } from '../utils/duelDocumentActions'
import {
  flushDuelDocumentAutosave,
  getDuelDocumentRevision,
  notifyDuelDocumentSaved,
  resumeDuelDocumentAutosave,
  suspendDuelDocumentAutosave
} from '../utils/duelDocumentAutosave'
import { flushDuelDocumentTitle } from '../utils/duelDocumentTitle'
import {
  findDocumentTitleConflict,
  findDuelDocumentEntry,
  nextAvailableDocumentTitle
} from '../utils/duelDocumentTree'

export async function createDuelBranch(stepId: string): Promise<void> {
  const current = useDuelStore.getState()
  const engine = useDuelEngineStore.getState()
  if (
    current.sceneEditing ||
    engine.loading ||
    engine.replayInfo ||
    useBlockingTaskStore.getState().notice ||
    useDialogStore.getState().requests.length > 0
  ) {
    return
  }
  const stepIndex = current.state.steps?.findIndex((step) => step.id === stepId) ?? -1
  if (stepIndex < 0) return
  try {
    const result = await window.api.getDuelDocumentTree()
    if (!result.success || !result.tree) throw new Error(result.error ?? '读取台本库失败')
    if (useDialogStore.getState().requests.length > 0) return
    const tree = result.tree
    const folder = findDuelDocumentEntry(tree, current.currentProjectPath)?.categoryPath ?? ''
    const defaultTitle = nextAvailableDocumentTitle(
      tree,
      folder,
      `${current.state.title.trim() || '未命名台本'}_分支`
    )
    const title = await promptDialog({
      title: '从此步创建分支',
      description: `将保留前 ${stepIndex + 1} 步和台词，从这一步结束后继续。分支保存为独立台本，原台本的完整路线会保留在台本库中。`,
      initialValue: defaultTitle,
      confirmText: '创建分支',
      validate: (value) => {
        if (!value.trim()) return '请输入分支名称。'
        return findDocumentTitleConflict(tree, folder, value)
          ? '已存在同名台本，请换一个名称。'
          : null
      }
    })
    if (title === null) return
    await useBlockingTaskStore
      .getState()
      .run(
        { title: '正在创建分支', detail: '保存原台本，并恢复分支起点的决斗进度。' },
        async () => {
          if (useDuelStore.getState().currentProjectPath !== current.currentProjectPath) {
            throw new Error('当前台本已切换，请重新选择分支起点。')
          }
          await flushDuelDocumentTitle()
          let source = structuredClone(await buildDuelDocument())
          if (useDuelEngineStore.getState().isInitialized && !source.engine) {
            throw new Error('无法读取引擎历史，已取消创建分支。')
          }
          const branch = buildDuelDocumentBranch(source, stepId, title)
          if (!useDuelStore.getState().currentProjectPath) {
            const created = await createDuelDocumentForCurrentDuel()
            if (!created.success) throw new Error(created.error ?? '保存原台本失败')
            source = structuredClone(await buildDuelDocument())
          }
          await flushDuelDocumentAutosave()
          const sourcePath = useDuelStore.getState().currentProjectPath
          if (!sourcePath) throw new Error('原台本尚未保存，已取消创建分支。')
          const revision = getDuelDocumentRevision()
          const saved = await window.api.saveDuelDocument(sourcePath, source)
          if (!saved.success) throw new Error(saved.error ?? '保存原台本失败')
          notifyDuelDocumentSaved(revision)
          suspendDuelDocumentAutosave()
          try {
            const created = await window.api.createDuelDocument(folder, branch)
            if (!created.success || !created.filePath) {
              throw new Error(created.error ?? '保存分支失败')
            }
            try {
              const opened = await openDuelDocument(created.filePath, { atEnd: true })
              if (!opened.success) throw new Error(opened.error ?? '打开分支失败')
              useDuelStore.getState().clearUndoHistory()
            } catch (error) {
              suspendDuelDocumentAutosave()
              const restored = await openDuelDocument(sourcePath, { atEnd: true })
              const detail = error instanceof Error ? error.message : '打开分支失败'
              throw new Error(
                `${detail}\n分支文件已保存，原台本${restored.success ? '已重新打开' : '已保存在台本库中，请重新打开'}。`
              )
            }
          } finally {
            resumeDuelDocumentAutosave()
          }
        }
      )
  } catch (error) {
    await alertDialog(`创建分支失败\n\n${error instanceof Error ? error.message : '未知错误'}`)
  }
}

export function useDuelBranch(stepId: string): { disabled: boolean; createBranch: () => void } {
  const sceneEditing = useDuelStore((state) => state.sceneEditing)
  const engineBusy = useDuelEngineStore((state) => state.loading || state.replayInfo !== null)
  const blocking = useBlockingTaskStore((state) => state.notice !== null)
  const dialogOpen = useDialogStore((state) => state.requests.length > 0)
  return {
    disabled: sceneEditing || engineBusy || blocking || dialogOpen,
    createBranch: () => void createDuelBranch(stepId)
  }
}
