import { useCallback } from 'react'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { BlockingTaskNotice, useBlockingTaskStore } from '../stores/useBlockingTaskStore'
import { alertDialog, choiceDialog, confirmDialog, promptDialog } from '../stores/useDialogStore'
import { buildPuzzleStateFromEngineBoard } from '../utils/engineBoardToPuzzle'
import { openDuelDocument, saveDuelDocument } from '../utils/duelDocumentActions'
import { flushDuelDocumentAutosave } from '../utils/duelDocumentAutosave'
import { commitDuelDocumentTitle, flushDuelDocumentTitle } from '../utils/duelDocumentTitle'
import { preloadCardImages } from '../utils/cardImage'
import { stripDetachedEngineSteps } from '../utils/stepHistory'
import { coverageAdvice, formatCoverageWarning } from '../utils/coverageWarning'
import {
  ContentCoverageDetail,
  DEFAULT_DUEL_TEST_SETTINGS,
  DuelPuzzleState,
  EngineExportReplayParams,
  EngineExportReplayResult,
  EngineSessionDoc,
  PLACEHOLDER_CARD_NAME,
  ReplayExportFormat,
  ReplayExportView,
  hasSessionInjections,
  isExportableMatch,
  isInGameTestSupported,
  isStandardTag,
  placeholderKindLabel,
  placeholderKindOf,
  withEditorPileOrder
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

interface ReplayExportSelection {
  format: ReplayExportFormat
  view?: ReplayExportView
}

const EXPORT_REPLAY_NOTICE: BlockingTaskNotice = {
  title: '正在导出对局回放',
  detail: '正在生成回放文件，可能需要几秒，请稍候。'
}

const RESTORE_FOR_EXPORT_NOTICE: BlockingTaskNotice = {
  title: '正在导出对局回放',
  detail: '正在恢复引擎会话，请稍候。'
}

const EXPORT_AND_OPEN_REPLAY_NOTICE: BlockingTaskNotice = {
  title: '正在用游戏打开回放',
  detail: '正在生成回放并启动游戏客户端，游戏窗口出现前请稍候。',
  minVisibleMs: 2000
}

const OPEN_REPLAY_NOTICE: BlockingTaskNotice = {
  title: '正在用游戏打开回放',
  detail: '正在启动游戏客户端，游戏窗口出现前请稍候。',
  minVisibleMs: 2000
}

async function chooseReplayExport(): Promise<ReplayExportSelection | null> {
  const value = await choiceDialog({
    title: '导出对局回放',
    description: '选择导出格式与手牌视角。YRP3D 只能在 MDPro3 中观看。',
    choices: [
      {
        label: 'YRP（ygopro / EDOPro）',
        value: 'yrp',
        description: '普通回放：双方手牌可见'
      },
      {
        label: 'YRP3D · 回放（我方视角）',
        value: 'yrp3d-player',
        description: 'MDPro3 打开：我方手牌可见，对方手牌显示为卡背'
      },
      {
        label: 'YRP3D · 观战',
        value: 'yrp3d-observer',
        description: 'MDPro3 打开：双方手牌都显示为卡背'
      }
    ]
  })
  if (!value) return null
  if (value === 'yrp') return { format: 'yrp' }
  if (value === 'yrp3d-observer') return { format: 'yrp3d', view: 'observer' }
  return { format: 'yrp3d', view: 'player' }
}

export function useProjectCommands(): ProjectCommands {
  const state = useDuelStore((s) => s.state)
  const loadState = useDuelStore((s) => s.loadState)
  const resetDuel = useDuelStore((s) => s.resetDuel)

  const resolveExportState = useCallback(
    (source: DuelPuzzleState): DuelPuzzleState =>
      useDuelEngineStore.getState().isInitialized ? withEditorPileOrder(source) : source,
    []
  )

  const handleNew = useCallback((): void => {
    void confirmDialog({
      title: '新建对局',
      description: '确认清空当前局面并新建对局？'
    }).then(async (ok) => {
      if (!ok) return
      if (useDuelStore.getState().sceneEditing) useDuelStore.getState().exitSceneMode()
      await flushDuelDocumentTitle()
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
    const res = await window.api.exportLuaFile({ ...resolveExportState(state), duelType })
    if (res.success && res.filePath) {
      void alertDialog(`脚本导出成功！\n路径: ${res.filePath}`)
    } else if (res.error) {
      void alertDialog(`导出失败: ${res.error}`)
    }
  }, [state, resolveExportState])

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

      const testState = resolveExportState(stripDetachedEngineSteps(state))
      const testSettings =
        useConfigStore.getState().config.duelTestSettings ?? DEFAULT_DUEL_TEST_SETTINGS

      const res = await window.api.testInYgo(testState, force, testSettings)
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
          const missingIds = [...res.coverage.missingDataIds, ...res.coverage.missingScriptIds]
          const sync = await window.api.syncCustomCardsToGame(undefined, missingIds)
          if (!sync.success) {
            void alertDialog(`同步自定义卡到游戏失败\n\n${sync.error ?? '未知错误'}`)
            return
          }
          const retry = await window.api.testInYgo(testState, false, testSettings)
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
    [state, resolveCoverageNames, resolveExportState]
  )

  const handleImportLua = useCallback(async (): Promise<void> => {
    const res = await window.api.importLuaFile()
    if (res.success && res.state) {
      await flushDuelDocumentTitle()
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
        const detail = res.yrp3dPath
          ? `YRP3D 回放: ${res.yrp3dPath}\n回放脚本: ${res.luaPath ?? ''}\n\n之后在 MDPro3 的「回放」界面也可以随时观看。`
          : `录像: ${res.yrpPath ?? ''}${res.luaPath ? `\n回放脚本: ${res.luaPath}` : ''}\n\n${
              res.manualHint ??
              (res.luaPath
                ? '之后在 ygopro 的「录像回放」中也可以随时观看（需保留 single 目录下的同名 lua）。'
                : '之后在 ygopro 的「录像回放」中也可以随时观看。')
            }`
        void alertDialog(
          `对局回放导出成功${res.launched && !res.manualHint ? '，已在游戏中打开回放' : ''}\n\n${detail}${
            res.warnings?.length ? `\n\n注意:\n${res.warnings.join('\n\n')}` : ''
          }`
        )
        return
      }
      if (res.errorCode === 'no-mdpro3-directory') {
        void confirmDialog({
          title: '尚未设置 MDPro3 目录',
          description:
            '导出 YRP3D 回放需要指定 MDPro3 主目录（回放写入其 replay 目录，脚本写入 single 目录）。可以在 设置 → 路径 中设置。',
          confirmText: '打开设置'
        }).then((ok) => {
          if (ok) void window.api.openSettingsWindow('paths')
        })
      } else if (res.errorCode === 'content-missing' && res.coverage) {
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
      } else if (res.errorCode === 'replay-start') {
        void alertDialog(res.error ?? '当前引擎会话无法从中间盘面导出 YRP 回放。')
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
    async (
      sessionDoc?: EngineSessionDoc,
      launch = false,
      selection?: ReplayExportSelection
    ): Promise<void> => {
      let engine = useDuelEngineStore.getState()
      let active = engine.isInitialized && !engine.replayInfo
      let sourceDoc = active ? undefined : (sessionDoc ?? engine.suspendedDoc)
      if ((active ? engine.timeline : (sourceDoc?.timeline ?? [])).length <= 1) return
      const sessionWithInjections = active ? await engine.getSessionDoc() : sourceDoc
      if (sessionWithInjections && hasSessionInjections(sessionWithInjections)) {
        await alertDialog(
          '当前对局包含注入的卡片\n\n将自动重打生成不含注入操作的回放，完成后继续导出。'
        )
        useDuelEngineStore.setState({ autoReplayBusy: true })
        let replayed = false
        try {
          if (active) {
            await engine.suspendEngine()
            if (useDuelEngineStore.getState().isInitialized) {
              void alertDialog(`自动重打前无法挂起当前引擎会话\n${engine.error ?? '未知错误'}`)
              return
            }
          } else if (useDuelEngineStore.getState().suspendedDoc !== sourceDoc) {
            useDuelEngineStore.getState().setSuspendedDoc(sourceDoc ?? null)
          }
          replayed = await useDuelEngineStore.getState().replaySuspendedToClean()
          if (replayed) {
            await preloadCardImages(useDuelStore.getState().state.cards.map((card) => card.code))
          }
        } finally {
          useDuelEngineStore.setState({ autoReplayBusy: false })
        }
        if (!replayed) {
          void alertDialog(
            `自动重打失败，无法生成回放\n\n${
              useDuelEngineStore.getState().error ?? '现有操作无法在新的初始场面上重演。'
            }\n\n当前盘面未改变，可以手动重打后再导出。`
          )
          return
        }
        engine = useDuelEngineStore.getState()
        active = engine.isInitialized && !engine.replayInfo
        sourceDoc = undefined
      }
      const timeline = active ? engine.timeline : (sourceDoc?.timeline ?? [])
      if (timeline.length <= 1) return
      const startBoard = timeline[0]?.boardState
      if (startBoard && (startBoard.turn !== 1 || startBoard.turnPlayer !== 0)) {
        void alertDialog(
          `当前引擎会话从第 ${startBoard.turn} 回合、${
            startBoard.turnPlayer === 0 ? '我方' : '对方'
          }行动开始。\n\nYRP 回放固定从第 1 回合玩家 0 开始，从中间盘面导出的回放会在游戏里报 Error occurs.。\n\n请回到布景起点/第 1 回合我方先攻的开局重新启动引擎后再导出；当前盘面请用游戏测试验证。`
        )
        return
      }
      const editorState = useDuelStore.getState().state
      if (!isExportableMatch(editorState.matchConfig)) return
      const exportSelection = selection ?? (await chooseReplayExport())
      if (!exportSelection) return
      if (!active) {
        if (!sourceDoc) return
        const restored = await useBlockingTaskStore
          .getState()
          .run(RESTORE_FOR_EXPORT_NOTICE, () => window.api.restoreDuelEngineSession(sourceDoc))
        if (!restored.success) {
          void alertDialog(`恢复引擎会话失败，无法导出回放\n\n${restored.error ?? '未知错误'}`)
          return
        }
      }
      const initialBoard = timeline[0]?.boardState
      const engineState = initialBoard
        ? buildPuzzleStateFromEngineBoard(initialBoard, {
            title: editorState.title,
            masterRule: editorState.masterRule,
            hostName: editorState.duelists?.[0]?.name,
            clientName: editorState.duelists?.[1]?.name
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
            scenarios: editorState.scenarios
          }
        : editorState

      const exportReplay = (params: EngineExportReplayParams): Promise<EngineExportReplayResult> =>
        useBlockingTaskStore
          .getState()
          .run(launch ? EXPORT_AND_OPEN_REPLAY_NOTICE : EXPORT_REPLAY_NOTICE, () =>
            window.api.duelExportReplay(params)
          )

      const runExport = async (
        force: boolean,
        overwrite = false,
        exportName?: string
      ): Promise<void> => {
        const res = await exportReplay({
          state: currentPuzzleState,
          name: exportName,
          overwrite,
          launch,
          force,
          format: exportSelection.format,
          view: exportSelection.view
        })
        if (res.errorCode === 'no-mdpro3-directory') {
          const choice = await confirmDialog({
            title: '尚未设置 MDPro3 目录',
            description:
              '导出 YRP3D 回放需要指定 MDPro3 主目录（回放写入其 replay 目录，脚本写入 single 目录）。现在选择吗？',
            confirmText: '选择目录',
            destructive: false
          })
          if (choice === true) {
            const picked = await useConfigStore.getState().selectMdpro3Dir()
            if (picked) await runExport(force, overwrite, exportName)
          }
          return
        }
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
              title: '重命名回放和项目',
              placeholder: '输入新的回放与项目名称',
              initialValue: res.name ?? currentPuzzleState.title
            })
            if (newName?.trim()) {
              const name = newName.trim()
              await commitDuelDocumentTitle(name)
              await runExport(false, false, name)
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
            const missingIds = [...res.coverage.missingDataIds, ...res.coverage.missingScriptIds]
            const sync = await window.api.syncCustomCardsToGame(
              exportSelection.format === 'yrp3d' ? 'mdpro3' : undefined,
              missingIds
            )
            if (!sync.success) {
              void alertDialog(`同步自定义卡到游戏失败\n\n${sync.error ?? '未知错误'}`)
              return
            }
            reportReplayResult(
              await exportReplay({
                state: currentPuzzleState,
                name: exportName,
                overwrite,
                launch,
                force: false,
                format: exportSelection.format,
                view: exportSelection.view
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
      const activeSession = engine.isInitialized && engine.timeline.length > 1
      const suspendedSession = !!engine.suspendedDoc && engine.suspendedDoc.timeline.length > 1
      if (!activeSession && !suspendedSession) {
        void alertDialog('当前没有可打开的回放。请先导入回放，或在引擎模式下打完一局后再试。')
        return
      }
      const selection: ReplayExportSelection =
        useConfigStore.getState().config.gameType === 'mdpro3'
          ? { format: 'yrp3d', view: 'player' }
          : { format: 'yrp' }
      if (activeSession) {
        await handleExportYrp(undefined, true, selection)
        return
      }
      await handleExportYrp(engine.suspendedDoc ?? undefined, true, selection)
      return
    }
    const res = await useBlockingTaskStore
      .getState()
      .run(OPEN_REPLAY_NOTICE, () => window.api.duelOpenReplay(filePath))
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
