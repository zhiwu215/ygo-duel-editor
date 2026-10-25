import { useCallback } from 'react'
import {
  boardFingerprintMatches,
  computeBoardFingerprint,
  findTagHandMismatches,
  formatTagHandMismatches,
  isEngineSupportedMatch,
  isStandardTag
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { clearEditorSteps } from '../stores/duelEngine/stepRecords'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'

function canResumeSuspended(): boolean {
  const doc = useDuelEngineStore.getState().suspendedDoc
  if (!doc) return false
  return boardFingerprintMatches(
    doc.boardFingerprint,
    computeBoardFingerprint(useDuelStore.getState().state)
  )
}

export function useStartEngine(): (options?: { skipResume?: boolean }) => Promise<void> {
  const startEngine = useDuelEngineStore((s) => s.startEngine)
  const resumeSuspended = useDuelEngineStore((s) => s.resumeSuspended)

  return useCallback(
    async (options?: { skipResume?: boolean }) => {
      const support = useConfigStore.getState().engineSupport
      if (support?.supported === false) {
        await alertDialog(`内置引擎不可用\n${support.reason ?? '当前游戏目录不支持内置规则校验。'}`)
        return
      }
      const wasSceneEditing = useDuelStore.getState().sceneEditing
      if (wasSceneEditing) useDuelStore.getState().exitSceneMode()
      const state = useDuelStore.getState().state
      if (isStandardTag(state.matchConfig)) {
        const mismatches = findTagHandMismatches(state)
        if (mismatches.length > 0) {
          await alertDialog(formatTagHandMismatches())
          return
        }
      }
      const matchConfig = state.matchConfig
      if (!isEngineSupportedMatch(matchConfig)) {
        const team0Count = matchConfig?.team0Count ?? 1
        const team1Count = matchConfig?.team1Count ?? 1
        const ok = await confirmDialog({
          title: '多人数模式只能近似校验',
          description: `内置规则校验引擎只支持 1v1 与 2v2 标准。当前 ${team0Count}v${team1Count} 会把同队角色合并到同一方，手牌、目标和效果范围会混在一起（例如多张卡同时高亮），不代表真实对局。\n\n仍要启动近似校验吗？`,
          confirmText: '仍要启动',
          destructive: false
        })
        if (ok !== true) return
      }
      if (wasSceneEditing) {
        if ((useDuelStore.getState().state.steps ?? []).length > 0) clearEditorSteps()
        useDuelEngineStore.getState().setSuspendedDoc(null)
      }
      useDuelStore.getState().exitPreview()
      if (useDuelEngineStore.getState().suspendedDoc) {
        if (!options?.skipResume && canResumeSuspended()) {
          const restored = await resumeSuspended()
          if (!restored) {
            await alertDialog(
              `继续上次会话失败\n${useDuelEngineStore.getState().error ?? '引擎无法恢复上次的会话。'}`
            )
          }
          return
        }
        const steps = useDuelStore.getState().state.steps ?? []
        const reason = options?.skipResume
          ? '上次引擎会话无法恢复。'
          : '当前盘面与上次保存的引擎会话不一致，无法继续上次进度。'
        const choice = await confirmDialog({
          title: '上次会话无法续接',
          description: `${reason}将从当前盘面开始新的引擎会话。${
            steps.length > 0
              ? `\n\n已有 ${steps.length} 个步骤会保留为历史步骤（文字仍可编辑），不会被删除。`
              : ''
          }`,
          confirmText: '开始新会话',
          destructive: false,
          ...(steps.length > 0 ? { extraAction: { text: '清空步骤', value: 'clear' } } : {})
        })
        if (choice === 'clear') {
          clearEditorSteps()
        } else if (choice !== true) {
          return
        }
      } else {
        const steps = useDuelStore.getState().state.steps ?? []
        if (steps.length > 0) {
          const choice = await confirmDialog({
            title: '台本中已有步骤',
            description: `开始校验会从当前盘面创建新的引擎会话。当前 ${steps.length} 个步骤会保留为历史步骤（文字仍可编辑），可在引擎里继续编写后续内容。`,
            confirmText: '开始校验',
            extraAction: { text: '清空步骤', value: 'clear' },
            destructive: false
          })
          if (choice === 'clear') {
            clearEditorSteps()
          } else if (choice !== true) {
            return
          }
        }
      }
      await startEngine({ allowMergedMatch: true })
    },
    [startEngine, resumeSuspended]
  )
}
