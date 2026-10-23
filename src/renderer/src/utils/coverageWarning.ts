import { ContentCoverageDetail } from '@shared/index'

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

function sampleIds(ids: number[], names: Record<number, string>): string {
  const labels = ids.slice(0, 5).map((id) => names[id] ?? `#${id}`)
  const more = ids.length > 5 ? ' 等' : ''
  return `：${labels.map((label) => `「${label}」`).join('、')}${more}`
}
