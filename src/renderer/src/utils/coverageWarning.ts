import { ContentCoverageDetail, isPlaceholderCard } from '@shared/index'

export function formatCoverageWarning(
  coverage: ContentCoverageDetail,
  names: Record<number, string>
): string {
  const parts: string[] = []
  if (coverage.missingDataIds.length > 0) {
    parts.push(
      `缺少卡库数据 ${coverage.missingDataIds.length} 张${sampleIds(coverage.missingDataIds, names)}`
    )
  }
  if (coverage.missingScriptIds.length > 0) {
    parts.push(
      `缺少效果脚本 ${coverage.missingScriptIds.length} 张${sampleIds(coverage.missingScriptIds, names)}`
    )
  }
  return parts.join('\n')
}

export function coverageAdvice(coverage: ContentCoverageDetail): string {
  const ids = [...new Set([...coverage.missingDataIds, ...coverage.missingScriptIds])]
  if (ids.length > 0 && ids.every(isPlaceholderCard)) {
    return '占位卡会随「同步并启动」写入游戏的自定义卡库 (yde-custom.cdb)，无需准备扩展卡库。'
  }
  if (ids.some(isPlaceholderCard)) {
    return '「同步并启动」会先从已添加的附加卡库导入这些卡的数据、脚本和卡图，写入游戏目录；只有附加卡库里也找不到时，才需要切换游戏目录。占位卡会随同步写入游戏的自定义卡库。'
  }
  return '「同步并启动」会先从已添加的附加卡库导入这些卡的数据、脚本和卡图，写入游戏目录；只有附加卡库里也找不到时，才需要切换游戏目录。'
}

function sampleIds(ids: number[], names: Record<number, string>): string {
  const labels = ids.slice(0, 5).map((id) => names[id] ?? `#${id}`)
  const more = ids.length > 5 ? ' 等' : ''
  return `：${labels.map((label) => `「${label}」`).join('、')}${more}`
}
