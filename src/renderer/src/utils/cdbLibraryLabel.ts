const LABEL_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^cards\.cdb$/i, label: '基本卡片数据库' },
  { pattern: /^cards-rush\.cdb$/i, label: '超速决斗（Rush）卡库' },
  { pattern: /^cards-skills\.cdb$/i, label: '速决（Speed Duel）技能卡库' },
  { pattern: /^cards-unofficial\.cdb$/i, label: '动漫/非官方卡库' },
  { pattern: /^goat-entries\.cdb$/i, label: 'Goat 格式卡库' },
  { pattern: /^prerelease-/i, label: '先行发布卡库' },
  { pattern: /^release-/i, label: '补充发布卡库' }
]

export function cdbLibraryLabel(path: string): string {
  const segments = path.split(/[\\/]/)
  const name = segments[segments.length - 1] ?? path
  const parent = segments[segments.length - 2] ?? ''
  if (/^cards\.cdb$/i.test(name) && /^expansions$/i.test(parent)) {
    return '扩展卡库（expansions）'
  }
  for (const rule of LABEL_RULES) {
    if (rule.pattern.test(name)) return rule.label
  }
  return name
}
