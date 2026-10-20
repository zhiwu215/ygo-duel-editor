import { useCallback, useState } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'
import { guardExportableMatch } from '../utils/matchExport'
import { formatCoverageWarning } from '../utils/coverageWarning'
import { ContentCoverageDetail, EngineExportReplayResult } from '@shared/index'

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
  handleImportReplay: () => Promise<void>
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
      void alertDialog(`残局脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state])

  const resolveCoverageNames = useCallback(
    async (coverage: ContentCoverageDetail): Promise<Record<number, string>> => {
      const ids = [...new Set([...coverage.missingDataIds, ...coverage.missingScriptIds])]
      if (ids.length === 0) return {}
      try {
        const cards = await window.api.getCardsByIds(ids)
        const names: Record<number, string> = {}
        for (const id of ids) names[id] = cards[id]?.name ?? ''
        return names
      } catch {
        return {}
      }
    },
    []
  )

  const handleTestInYgo = useCallback(
    async (force = false): Promise<void> => {
      const warning = guardExportableMatch(state, 'test')
      if (warning) {
        void alertDialog(warning)
        return
      }
      const res = await window.api.testInYgo(state, force)
      if (res.success) return
      if (res.errorCode === 'content-missing' && res.coverage) {
        const names = await resolveCoverageNames(res.coverage)
        const detail = formatCoverageWarning(res.coverage, names)
        const choice = await confirmDialog({
          title: '当前游戏可能无法完整测试该对局',
          description: `${detail}\n\n这些内容通常来自动漫卡库等扩展卡库。建议在 设置 → 路径 中将游戏目录切换到包含对应数据的游戏 (如 EDOPro)。`,
          confirmText: '去设置切换目录',
          extraAction: { text: '仍然启动', value: 'force' },
          destructive: false
        })
        if (choice === 'force') {
          const retry = await window.api.testInYgo(state, true)
          if (!retry.success && retry.error) {
            void alertDialog(`启动游戏测试失败: ${retry.error}`)
          }
        } else if (choice === true) {
          void window.api.openSettingsWindow('paths')
        }
        return
      }
      if (res.errorCode === 'no-game-directory') {
        void confirmDialog({
          title: '尚未设置游戏目录',
          description: '测试对局前，需要先在 设置 → 路径 中选择游戏主目录 (ygopro 或 MDPro3)。',
          confirmText: '打开设置'
        }).then((ok) => {
          if (ok) void window.api.openSettingsWindow('paths')
        })
      } else if (res.errorCode === 'game-not-found') {
        void alertDialog(
          `未在游戏目录中找到游戏主程序 (ygopro.exe / MDPro3.exe)\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
        )
      } else if (res.error) {
        void alertDialog(`启动游戏测试失败: ${res.error}`)
      }
    },
    [state, resolveCoverageNames]
  )

  const handleImportLua = useCallback(async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      loadState(res.state)
    } else if (res.error) {
      void alertDialog(`导入失败: ${res.error}`)
    }
  }, [loadState])

  const reportReplayResult = useCallback((res: EngineExportReplayResult): void => {
    if (res.success) {
      const gameType = useConfigStore.getState().config.gameType
      const detail =
        gameType === 'mdpro3'
          ? `回放: ${res.yrp3dPath ?? ''}\n\n之后在 MDPro3 的「回放」界面也可以随时观看。`
          : `录像: ${res.yrpPath ?? ''}\n残局脚本: ${res.luaPath ?? ''}\n\n${
              res.manualHint ??
              '之后在 ygopro 的「录像回放」中也可以随时观看（需保留 single 目录下的同名 lua）。'
            }`
      void alertDialog(
        `对局回放导出成功${res.launched && !res.manualHint ? '，已在游戏中打开回放' : ''}\n\n${detail}`
      )
      return
    }
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置游戏目录',
        description: '导出对局回放前，需要先在 设置 → 路径 中选择游戏主目录 (ygopro 或 MDPro3)。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
    } else if (res.errorCode === 'game-not-found') {
      void alertDialog(
        `未在游戏目录中找到游戏主程序 (ygopro.exe / MDPro3.exe)\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
    } else if (res.error) {
      void alertDialog(`导出对局回放失败\n\n${res.error}`)
    }
  }, [])

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

    const runExport = async (force: boolean): Promise<void> => {
      const res = await window.api.duelExportReplay({
        state: currentPuzzleState,
        launch: true,
        force
      })
      if (res.errorCode === 'content-missing' && res.coverage) {
        const names = await resolveCoverageNames(res.coverage)
        const detail = formatCoverageWarning(res.coverage, names)
        const choice = await confirmDialog({
          title: '当前游戏可能无法完整回放该对局',
          description: `${detail}\n\n这些内容通常来自动漫卡库等扩展卡库。建议在 设置 → 路径 中将游戏目录切换到包含对应数据的游戏 (如 EDOPro)。`,
          confirmText: '去设置切换目录',
          extraAction: { text: '仍然导出并启动', value: 'force' },
          destructive: false
        })
        if (choice === 'force') {
          reportReplayResult(
            await window.api.duelExportReplay({
              state: currentPuzzleState,
              launch: true,
              force: true
            })
          )
        } else if (choice === true) {
          void window.api.openSettingsWindow('paths')
        }
        return
      }
      reportReplayResult(res)
    }

    await runExport(false)
  }, [resolveCoverageNames, reportReplayResult])

  const handleImportReplay = useCallback(async (): Promise<void> => {
    const ok = await useDuelEngineStore.getState().importReplay()
    if (ok) return
    const error = useDuelEngineStore.getState().error
    if (error) {
      void alertDialog(`导入对局回放失败\n\n${error}`)
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
    handleImportReplay,
    handleExportScreenplay,
    handleExportSession,
    handleImportSession
  }
}
