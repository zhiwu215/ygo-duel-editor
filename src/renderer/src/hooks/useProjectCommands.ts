import { useCallback, useState } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'
import { guardExportableMatch } from '../utils/matchExport'

export interface ProjectCommands {
  isSaveModalOpen: boolean
  closeSaveModal: () => void
  handleNew: () => void
  handleSaveProject: () => Promise<void>
  handleSaveProjectAs: () => void
  handleOpenProject: () => Promise<void>
  handleExportLua: () => Promise<void>
  handleTestInYgo: () => Promise<void>
  handleImportLua: () => Promise<void>
  handleExportYrp: () => Promise<void>
  handleExportScreenplay: () => Promise<void>
  handleExportSession: () => void
  handleImportSession: () => void
}

export function useProjectCommands(): ProjectCommands {
  const state = useDuelStore((s) => s.state)
  const loadState = useDuelStore((s) => s.loadState)
  const resetDuel = useDuelStore((s) => s.resetDuel)
  const currentProjectPath = useDuelStore((s) => s.currentProjectPath)
  const setCurrentProjectPath = useDuelStore((s) => s.setCurrentProjectPath)

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)

  const handleNew = useCallback((): void => {
    void confirmDialog({
      title: '新建对局',
      description: '确认清空当前局面并新建对局？'
    }).then((ok) => {
      if (ok) resetDuel()
    })
  }, [resetDuel])

  const handleSaveProject = useCallback(async (): Promise<void> => {
    if (!currentProjectPath) {
      setIsSaveModalOpen(true)
      return
    }
    const res = await window.api.saveProjectToPath(currentProjectPath, state)
    if (res.success) return
    if (res.error) {
      void alertDialog(`保存失败：${res.error}\n将打开另存为对话框。`)
    }
    setIsSaveModalOpen(true)
  }, [currentProjectPath, state])

  const handleSaveProjectAs = useCallback((): void => {
    setIsSaveModalOpen(true)
  }, [])

  const handleOpenProject = useCallback(async (): Promise<void> => {
    const res = await window.api.loadProjectFile()
    if (res.success && res.state) {
      loadState(res.state)
      if (res.filePath) setCurrentProjectPath(res.filePath)
    }
  }, [loadState, setCurrentProjectPath])

  const handleExportLua = useCallback(async (): Promise<void> => {
    const warning = guardExportableMatch(state, 'lua')
    if (warning) {
      void alertDialog(warning)
      return
    }
    const res = await window.api.exportLuaFile(state)
    if (res.success && res.filePath) {
      void alertDialog(`Lua 决斗脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state])

  const handleTestInYgo = useCallback(async (): Promise<void> => {
    const warning = guardExportableMatch(state, 'test')
    if (warning) {
      void alertDialog(warning)
      return
    }
    const res = await window.api.testInYgo(state)
    if (res.success) return
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置 ygo 游戏目录',
        description:
          '使用 ygo 测试对局前，需要先在 设置 → 路径 中选择 ygopro.exe 所在的游戏根目录。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
    } else if (res.errorCode === 'ygopro-not-found') {
      void alertDialog(
        `未在游戏目录中找到 ygopro.exe\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
    } else if (res.error) {
      void alertDialog(`启动 ygo 测试失败: ${res.error}`)
    }
  }, [state])

  const handleImportLua = useCallback(async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      loadState(res.state)
    } else if (res.error) {
      void alertDialog(`导入失败: ${res.error}`)
    }
  }, [loadState])

  const handleExportYrp = useCallback(async (): Promise<void> => {
    const isEngine = useDuelEngineStore.getState().isInitialized
    const timeline = useDuelEngineStore.getState().timeline
    if (!isEngine || timeline.length === 0) {
      void alertDialog(
        '无法导出录像\n\n还没有经过游戏引擎的操作记录。请先在对局中通过引擎召唤、发动、盖放卡片，再导出 YRP 录像。'
      )
      return
    }
    const currentPuzzleState = useDuelStore.getState().state
    const warning = guardExportableMatch(currentPuzzleState, 'yrp')
    if (warning) {
      void alertDialog(warning)
      return
    }
    const res = await window.api.duelExportReplay({
      state: currentPuzzleState,
      launch: true
    })
    if (res.success) {
      void alertDialog(
        `YRP 录像导出成功${res.launched ? '，已在 ygopro 中打开回放' : ''}\n\n录像: ${res.yrpPath}\n残局脚本: ${res.luaPath}\n\n之后在 ygopro 的「录像回放」中也可以随时观看（需保留 single 目录下的同名 lua）。`
      )
      return
    }
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置 ygo 游戏目录',
        description: '导出 YRP 录像前，需要先在 设置 → 路径 中选择 ygopro.exe 所在的游戏根目录。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
    } else if (res.errorCode === 'ygopro-not-found') {
      void alertDialog(
        `未在游戏目录中找到 ygopro.exe\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
    } else if (res.error) {
      void alertDialog(`导出 YRP 录像失败\n\n${res.error}`)
    }
  }, [])

  const handleExportScreenplay = useCallback(async (): Promise<void> => {
    if (!window.api?.exportScreenplayFile) return
    const res = await window.api.exportScreenplayFile(state)
    if (res.success && res.filePath) {
      void alertDialog(`同人决斗剧本台本已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state])

  const handleExportSession = useCallback((): void => {
    void useDuelEngineStore.getState().exportSession()
  }, [])

  const handleImportSession = useCallback((): void => {
    void useDuelEngineStore.getState().importSession()
  }, [])

  const closeSaveModal = useCallback((): void => {
    setIsSaveModalOpen(false)
  }, [])

  return {
    isSaveModalOpen,
    closeSaveModal,
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    handleExportYrp,
    handleExportScreenplay,
    handleExportSession,
    handleImportSession
  }
}
