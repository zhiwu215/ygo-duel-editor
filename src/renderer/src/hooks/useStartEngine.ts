import { useCallback } from 'react'
import {
  findTagHandMismatches,
  formatTagHandMismatches,
  isEngineSupportedMatch,
  isStandardTag
} from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useConfigStore } from '../stores/useConfigStore'
import { alertDialog, confirmDialog } from '../stores/useDialogStore'

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
    await startEngine({ allowMergedMatch: true })
  }, [startEngine])
}
