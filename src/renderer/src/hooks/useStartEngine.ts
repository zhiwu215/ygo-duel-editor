import { useCallback } from 'react'
import {
  DuelStep,
  findTagHandMismatches,
  formatTagHandMismatches,
  isEngineSupportedMatch,
  isStandardTag
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'

function isRecordedStep(step: DuelStep): boolean {
  return (
    step.origin === 'engine' ||
    step.origin === 'replay' ||
    Boolean(step.actId) ||
    (step.texts?.length ?? 0) > 0
  )
}

function formatClearStepsWarning(count: number): string {
  return `台本里有 ${count} 个步骤来自对局记录或带有台本文本，但当前没有可恢复的引擎会话。启动规则校验会用当前盘面重新开局（回合数从 1 重新计算、回合内状态重置），这些步骤会被清空，并随自动保存写回台本文件。\n\n需要保留的话，请先取消并用「文件 → 另存为」备份台本。`
}

export function useStartEngine(): () => Promise<void> {
  const startEngine = useDuelEngineStore((s) => s.startEngine)

  return useCallback(async () => {
    const support = useConfigStore.getState().engineSupport
    if (support?.supported === false) {
      await alertDialog(`内置引擎不可用\n${support.reason ?? '当前游戏目录不支持内置规则校验。'}`)
      return
    }
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
    const recordedSteps = useDuelEngineStore.getState().isInitialized
      ? []
      : (state.steps ?? []).filter(isRecordedStep)
    if (recordedSteps.length > 0) {
      const ok = await confirmDialog({
        title: '启动规则校验会清空台本步骤',
        description: formatClearStepsWarning(recordedSteps.length),
        confirmText: '仍然启动',
        destructive: true
      })
      if (ok !== true) return
    }
    await startEngine({ allowMergedMatch: true })
  }, [startEngine])
}
