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
    return '这些内容通常来自扩展卡库。建议在 设置 → 路径 中将游戏目录切换到包含对应数据的游戏。占位卡会随「同步并启动」写入游戏的自定义卡库。'
  }
  return '这些内容通常来自扩展卡库。建议在 设置 → 路径 中将游戏目录切换到包含对应数据的游戏。'
}

function sampleIds(ids: number[], names: Record<number, string>): string {
  const labels = ids.slice(0, 5).map((id) => names[id] ?? `#${id}`)
  const more = ids.length > 5 ? ' 等' : ''
  return `：${labels.map((label) => `「${label}」`).join('、')}${more}`
}
