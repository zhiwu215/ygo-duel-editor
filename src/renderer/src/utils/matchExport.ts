import { DuelPuzzleState, isExportableMatch } from '@shared/index'

const GUARD_TEXTS = {
  lua: {
    title: '无法导出 Lua',
    cause: '暂无法导出 Lua。',
    hint: '请在对阵选择器中切换至 1v1 或 2v2 后再进行导出。'
  },
  test: {
    title: '无法测试对局',
    cause: '暂无法生成 Lua。',
    hint: '请在对阵选择器中切换至 1v1 或 2v2 后再进行测试。'
  },
  yrp: {
    title: '无法导出录像',
    cause: '暂无法导出 YRP。',
    hint: ''
  }
}

export type MatchExportKind = keyof typeof GUARD_TEXTS

export function guardExportableMatch(state: DuelPuzzleState, kind: MatchExportKind): string | null {
  if (isExportableMatch(state.matchConfig)) return null
  const t0 = state.matchConfig?.team0Count ?? 1
  const t1 = state.matchConfig?.team1Count ?? 1
  const text = GUARD_TEXTS[kind]
  return `${text.title}\n\n当前对阵 (${t0}v${t1}) 仅用于剧情编排，${text.cause}\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。${text.hint}`
}
