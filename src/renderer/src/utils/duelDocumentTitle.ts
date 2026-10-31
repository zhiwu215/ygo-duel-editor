import { useDuelStore } from '../stores/useDuelStore'
import { alertDialog } from '../stores/useDialogStore'
import { flushDuelDocumentAutosave, markDuelDocumentDirty } from './duelDocumentAutosave'

export function documentTitleFromPath(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() ?? ''
  return name.replace(/\.ygoduel$/i, '')
}

async function applyTitle(rawTitle: string): Promise<void> {
  const sourcePath = useDuelStore.getState().currentProjectPath
  const previousTitle = useDuelStore.getState().state.title.trim()
  const nextTitle = rawTitle.trim()
  const setTitle = useDuelStore.getState().setTitle
  if (!sourcePath) {
    if (useDuelStore.getState().state.title !== nextTitle) setTitle(nextTitle)
    return
  }

  const currentTitle = documentTitleFromPath(sourcePath)
  if (!nextTitle || nextTitle === currentTitle) {
    if (useDuelStore.getState().state.title !== currentTitle) setTitle(currentTitle)
    return
  }

  await flushDuelDocumentAutosave()
  const result = await window.api.renameDuelDocument(sourcePath, nextTitle)
  if (useDuelStore.getState().currentProjectPath !== sourcePath) return

  if (!result.success || !result.filePath) {
    if (useDuelStore.getState().state.title.trim() === nextTitle) setTitle(currentTitle)
    await alertDialog(`重命名台本失败\n\n${result.error ?? '未知错误'}`)
    return
  }

  const actualTitle = documentTitleFromPath(result.filePath)
  const titleUntouched = useDuelStore.getState().state.title.trim() === previousTitle
  useDuelStore.setState({ currentProjectPath: result.filePath })
  if (titleUntouched || useDuelStore.getState().state.title.trim() === nextTitle) {
    setTitle(actualTitle)
  }
  markDuelDocumentDirty()
}

let titleCommitChain: Promise<void> = Promise.resolve()

export function commitDuelDocumentTitle(title: string): Promise<void> {
  const run = async (): Promise<void> => {
    try {
      await applyTitle(title)
    } catch (err) {
      await alertDialog(`重命名台本失败\n\n${err instanceof Error ? err.message : '未知错误'}`)
    }
  }
  titleCommitChain = titleCommitChain.then(run, run)
  return titleCommitChain
}

export function flushDuelDocumentTitle(): Promise<void> {
  return titleCommitChain
}
