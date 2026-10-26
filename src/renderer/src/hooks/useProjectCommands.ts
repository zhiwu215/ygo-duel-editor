import { useCallback } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { alertDialog, confirmDialog, promptDialog } from '../stores/useDialogStore'
import { buildPuzzleStateFromEngineBoard } from '../utils/engineBoardToPuzzle'
import { openDuelDocument, saveDuelDocument } from '../utils/duelDocumentActions'
import { flushDuelDocumentAutosave } from '../utils/duelDocumentAutosave'
import { coverageAdvice, formatCoverageWarning } from '../utils/coverageWarning'
import {
  ContentCoverageDetail,
  DEFAULT_DUEL_TEST_SETTINGS,
  EngineExportReplayResult,
  EngineSessionDoc,
  PLACEHOLDER_CARD_NAME,
  isExportableMatch,
  isInGameTestSupported,
  isStandardTag,
  placeholderKindLabel,
  placeholderKindOf
} from '@shared/index'

export interface ProjectCommands {
  handleNew: () => void
  handleSaveProject: () => Promise<void>
  handleSaveProjectAs: () => Promise<void>
  handleOpenProject: () => Promise<void>
  handleExportLua: () => Promise<void>
  handleTestInYgo: () => Promise<void>
  handleImportLua: () => Promise<void>
  handleExportYrp: () => Promise<void>
  handleImportReplay: () => Promise<void>
  handleOpenReplayInYgo: () => Promise<void>
}

export function useProjectCommands(): ProjectCommands {
  const state = useDuelStore((s) => s.state)
  const loadState = useDuelStore((s) => s.loadState)
  const resetDuel = useDuelStore((s) => s.resetDuel)

  const handleNew = useCallback((): void => {
    void confirmDialog({
      title: '新建对局',
      description: '确认清空当前局面并新建对局？'
    }).then(async (ok) => {
      if (!ok) return
      if (useDuelStore.getState().sceneEditing) useDuelStore.getState().exitSceneMode()
      await flushDuelDocumentAutosave()
      const engine = useDuelEngineStore.getState()
      if (engine.isInitialized) engine.stopEngine()
      engine.setSuspendedDoc(null)
      resetDuel()
    })
  }, [resetDuel])

  const handleSaveProject = useCallback(async (): Promise<void> => {
    const result = await saveDuelDocument(false)
    if (!result.success && result.error) {
      void alertDialog(`保存失败：${result.error}`)
    }
  }, [])

  const handleSaveProjectAs = useCallback(async (): Promise<void> => {
    const result = await saveDuelDocument(true)
    if (!result.success && result.error) {
      void alertDialog(`保存失败：${result.error}`)
    }
  }, [])

  const handleOpenProject = useCallback(async (): Promise<void> => {
    const result = await window.api.openDuelDocumentDialog()
    if (!result.success || !result.filePath) {
      if (result.error) void alertDialog(`打开失败：${result.error}`)
      return
    }
    const opened = await openDuelDocument(result.filePath)
    if (!opened.success) {
      void alertDialog(`打开失败：${opened.error ?? '未知错误'}`)
    }
  }, [])

  const handleExportLua = useCallback(async (): Promise<void> => {
    if (!isExportableMatch(state.matchConfig)) return
    const choice = await confirmDialog({
      title: '导出脚本',
      description: '选择导出为残局还是整局。',
      confirmText: '残局',
      extraAction: { text: '整局', value: 'full' },
      destructive: false
    })
    if (choice !== true && choice !== 'full') return
    const duelType = choice === 'full' ? 'full' : 'puzzle'
    const res = await window.api.exportLuaFile({ ...state, duelType })
    if (res.success && res.filePath) {
      void alertDialog(`脚本导出成功！\n路径: ${res.filePath}`)
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
        for (const id of ids) {
          const kind = placeholderKindOf(id)
          names[id] = kind
            ? `${PLACEHOLDER_CARD_NAME}（${placeholderKindLabel(kind)}）`
            : (cards[id]?.name ?? '')
        }
        return names
      } catch {
        return {}
      }
    },
    []
  )

  const handleTestInYgo = useCallback(
    async (force = false): Promise<void> => {
      if (!isInGameTestSupported(state.matchConfig)) return

      const testSettings =
        useConfigStore.getState().config.duelTestSettings ?? DEFAULT_DUEL_TEST_SETTINGS

      const res = await window.api.testInYgo(state, force, testSettings)
      if (res.success) return
      if (res.errorCode === 'content-missing' && res.coverage) {
        const names = await resolveCoverageNames(res.coverage)
        const detail = formatCoverageWarning(res.coverage, names)
        const choice = await confirmDialog({
          title: '当前游戏可能无法完整测试该对局',
          description: `${detail}\n\n${coverageAdvice(res.coverage)}`,
          confirmText: '同步并启动',
          extraAction: { text: '去设置切换目录', value: 'settings' },
          destructive: false
        })
        if (choice === 'settings') {
          void window.api.openSettingsWindow('paths')
        } else if (choice === true) {
          const sync = await window.api.syncCustomCardsToGame()
          if (!sync.success) {
            void alertDialog(`同步自定义卡到游戏失败\n\n${sync.error ?? '未知错误'}`)
            return
          }
          const retry = await window.api.testInYgo(state, false, testSettings)
          if (retry.success) return
          if (retry.errorCode === 'content-missing' && retry.coverage) {
            const retryNames = await resolveCoverageNames(retry.coverage)
            const retryDetail = formatCoverageWarning(retry.coverage, retryNames)
            void alertDialog(`同步后仍缺少以下内容，无法启动游戏测试\n\n${retryDetail}`)
          } else if (retry.error) {
            void alertDialog(`同步后仍然无法启动游戏测试\n\n${retry.error}`)
          } else {
            void alertDialog('同步后仍然无法启动游戏测试。')
          }
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
      await flushDuelDocumentAutosave()
      const engine = useDuelEngineStore.getState()
      if (engine.isInitialized) engine.stopEngine()
      engine.setSuspendedDoc(null)
      loadState(res.state)
    } else if (res.error) {
      void alertDialog(`导入失败: ${res.error}`)
    }
  }, [loadState])

  const reportReplayResult = useCallback(
    (res: EngineExportReplayResult): void => {
      if (res.success) {
        const gameType = useConfigStore.getState().config.gameType
        const detail =
          gameType === 'mdpro3'
            ? `回放: ${res.yrp3dPath ?? ''}\n\n之后在 MDPro3 的「回放」界面也可以随时观看。`
            : `录像: ${res.yrpPath ?? ''}${res.luaPath ? `\n回放脚本: ${res.luaPath}` : ''}\n\n${
                res.manualHint ??
                (res.luaPath
                  ? '之后在 ygopro 的「录像回放」中也可以随时观看（需保留 single 目录下的同名 lua）。'
                  : '之后在 ygopro 的「录像回放」中也可以随时观看。')
              }`
        void alertDialog(
          `对局回放导出成功${res.launched && !res.manualHint ? '，已在游戏中打开回放' : ''}\n\n${detail}`
        )
        return
      }
      if (res.errorCode === 'content-missing' && res.coverage) {
        void (async () => {
          const names = await resolveCoverageNames(res.coverage!)
          const detail = formatCoverageWarning(res.coverage!, names)
          void alertDialog(`同步后仍缺少以下内容，无法导出对局回放\n\n${detail}`)
        })()
      } else if (res.errorCode === 'no-game-directory') {
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
    },
    [resolveCoverageNames]
  )

  const handleExportYrp = useCallback(
    async (sessionDoc?: EngineSessionDoc, launch = false): Promise<void> => {
      const engine = useDuelEngineStore.getState()
      const active = engine.isInitialized && !engine.replayInfo
      const sourceDoc = active ? undefined : (sessionDoc ?? engine.suspendedDoc)
      const timeline = active ? engine.timeline : (sourceDoc?.timeline ?? [])
      if (timeline.length <= 1) return
      const editorState = useDuelStore.getState().state
      if (!isExportableMatch(editorState.matchConfig)) return
      if (!active) {
        if (!sourceDoc) return
        const restored = await window.api.restoreDuelEngineSession(sourceDoc)
        if (!restored.success) {
          void alertDialog(`恢复引擎会话失败，无法导出回放\n\n${restored.error ?? '未知错误'}`)
          return
        }
      }
      const initialBoard = timeline[0]?.boardState
      const engineState = initialBoard
        ? buildPuzzleStateFromEngineBoard(initialBoard, {
            title: editorState.title,
            masterRule: editorState.masterRule
          })
        : null
      const currentPuzzleState = engineState
        ? {
            ...engineState,
            title: editorState.title,
            hint: editorState.hint,
            duelType: editorState.duelType,
            series: editorState.series,
            sourceRef: editorState.sourceRef,
            matchConfig: editorState.matchConfig,
            firstTurnAttack: editorState.firstTurnAttack,
            duelists: editorState.duelists,
            scenarios: editorState.scenarios
          }
        : editorState

      const runExport = async (
        force: boolean,
        overwrite = false,
        exportName?: string
      ): Promise<void> => {
        const res = await window.api.duelExportReplay({
          state: currentPuzzleState,
          name: exportName,
          overwrite,
          launch,
          force
        })
        if (res.errorCode === 'replay-exists') {
          const replaceText = isStandardTag(currentPuzzleState.matchConfig)
            ? '覆盖会替换现有回放。'
            : '覆盖会替换现有回放和回放脚本。'
          const choice = await confirmDialog({
            title: '存在同名回放',
            description: `检测到同名文件：\n${res.existingPath}\n\n${replaceText}也可以改名后导出。`,
            confirmText: '覆盖',
            extraAction: { text: '改名', value: 'rename' },
            destructive: true
          })
          if (choice === 'rename') {
            const newName = await promptDialog({
              title: '重命名回放',
              placeholder: '输入新的回放名称',
              initialValue: res.name ?? currentPuzzleState.title
            })
            if (newName?.trim()) {
              await runExport(false, false, newName.trim())
            }
          } else if (choice === true) {
            await runExport(false, true, exportName)
          }
          return
        }
        if (res.errorCode === 'content-missing' && res.coverage) {
          const names = await resolveCoverageNames(res.coverage)
          const detail = formatCoverageWarning(res.coverage, names)
          const choice = await confirmDialog({
            title: '当前游戏可能无法完整回放该对局',
            description: `${detail}\n\n${coverageAdvice(res.coverage)}`,
            confirmText: '同步并启动',
            extraAction: { text: '去设置切换目录', value: 'settings' },
            destructive: false
          })
          if (choice === 'settings') {
            void window.api.openSettingsWindow('paths')
          } else if (choice === true) {
            const sync = await window.api.syncCustomCardsToGame()
            if (!sync.success) {
              void alertDialog(`同步自定义卡到游戏失败\n\n${sync.error ?? '未知错误'}`)
              return
            }
            reportReplayResult(
              await window.api.duelExportReplay({
                state: currentPuzzleState,
                name: exportName,
                overwrite,
                launch,
                force: false
              })
            )
          }
          return
        }
        reportReplayResult(res)
      }

      await runExport(false)
    },
    [resolveCoverageNames, reportReplayResult]
  )

  const handleImportReplay = useCallback(async (): Promise<void> => {
    const ok = await useDuelEngineStore.getState().importReplay()
    if (ok) return
    const error = useDuelEngineStore.getState().error
    if (error) {
      void alertDialog(`导入对局回放失败\n\n${error}`)
    }
  }, [])

  const handleOpenReplayInYgo = useCallback(async (): Promise<void> => {
    const engine = useDuelEngineStore.getState()
    const filePath = engine.replayInfo?.filePath
    if (!filePath) {
      if (engine.isInitialized && engine.timeline.length > 1) {
        await handleExportYrp(undefined, true)
        return
      }
      if (engine.suspendedDoc && engine.suspendedDoc.timeline.length > 1) {
        await handleExportYrp(engine.suspendedDoc, true)
        return
      }
      void alertDialog('当前没有可打开的回放。请先导入回放，或在引擎模式下打完一局后再试。')
      return
    }
    const res = await window.api.duelOpenReplay(filePath)
    if (res.success) {
      if (res.manualHint) {
        void alertDialog(`回放已保存到游戏 replay 目录\n\n${res.manualHint}`)
      }
      return
    }
    if (res.errorCode === 'no-game-directory') {
      void confirmDialog({
        title: '尚未设置游戏目录',
        description: '用游戏打开回放前，需要先在 设置 → 路径 中选择游戏主目录 (ygopro 或 MDPro3)。',
        confirmText: '打开设置'
      }).then((ok) => {
        if (ok) void window.api.openSettingsWindow('paths')
      })
      return
    }
    if (res.errorCode === 'game-not-found') {
      void alertDialog(
        `未在游戏目录中找到游戏主程序 (ygopro.exe / MDPro3.exe)\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
      )
      return
    }
    void alertDialog(`打开回放失败\n\n${res.error ?? '未知错误'}`)
  }, [handleExportYrp])

  return {
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    handleExportYrp,
    handleImportReplay,
    handleOpenReplayInYgo
  }
}
