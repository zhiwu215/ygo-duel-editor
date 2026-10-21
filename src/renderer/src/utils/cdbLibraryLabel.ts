export interface CdbLibraryMeta {
  label: string
  description: string
}

const LIBRARY_RULES: Array<{ pattern: RegExp; meta: CdbLibraryMeta }> = [
  {
    pattern: /^cards-rush\.cdb$/i,
    meta: { label: 'Rush 卡库', description: '超速决斗（Rush Duel）专用卡' }
  },
  {
    pattern: /^cards-skills-unofficial\.cdb$/i,
    meta: { label: '非官方技能卡库', description: '非官方 DL 技能卡，客户端不并入检索' }
  },
  {
    pattern: /^cards-skills\.cdb$/i,
    meta: { label: 'DL 技能卡库', description: '决斗链接（Speed Duel）技能卡' }
  },
  {
    pattern: /^cards-unofficial\.cdb$/i,
    meta: { label: '动漫/非官方卡库', description: '动漫、漫画及其它非官方卡片' }
  },
  {
    pattern: /^cards\.cdb$/i,
    meta: { label: '基本卡片数据库', description: 'OCG/TCG 正式卡与基础数据' }
  },
  {
    pattern: /^goat-entries\.cdb$/i,
    meta: { label: 'GOAT 格式卡', description: '2005 年 4 月 GOAT 环境专用卡' }
  },
  {
    pattern: /^prerelease-betb-en\.cdb$/i,
    meta: { label: 'BETB 先行发布卡', description: 'BETB 英文先行发布卡' }
  },
  {
    pattern: /^prerelease-cards-rush\.cdb$/i,
    meta: { label: 'Rush 先行发布卡', description: 'Rush Duel 先行发布卡' }
  },
  {
    pattern: /^prerelease-dbgv\.cdb$/i,
    meta: { label: 'DBGV 先行发布卡', description: 'DBGV 先行发布卡（Zenet/千年神器）' }
  },
  {
    pattern: /^prerelease-imph\.cdb$/i,
    meta: { label: 'IMPH 先行发布卡', description: 'IMPH 先行发布卡（太阳神使徒等）' }
  },
  {
    pattern: /^prerelease-others\.cdb$/i,
    meta: { label: '其它先行发布卡', description: '不属于单独卡包的先行发布卡' }
  },
  {
    pattern: /^prerelease-rv02\.cdb$/i,
    meta: { label: 'RV02 先行发布卡', description: 'RV02 先行发布卡（Cubic/方界）' }
  },
  {
    pattern: /^prerelease-yac1\.cdb$/i,
    meta: { label: 'YAC1 先行发布卡', description: 'YAC1 先行发布卡（经典卡强化）' }
  },
  {
    pattern: /^release-betb\.cdb$/i,
    meta: { label: 'BETB 正式补充卡', description: 'BETB 正式发布后的补充卡' }
  },
  {
    pattern: /^acs\.cdb$/i,
    meta: { label: 'ACS 动画/剧场版卡', description: '动画、剧场版角色卡（冥界之王等）' }
  },
  {
    pattern: /^ifzcg\.cdb$/i,
    meta: { label: 'ZCG 卡库', description: 'ZCG 动画/自制卡（游戏、地缚神等）' }
  },
  {
    pattern: /^kcg\.cdb$/i,
    meta: { label: 'KCG 自制/动画卡', description: 'KCG 自制与动画卡（奥雷卡尔克斯等）' }
  },
  {
    pattern: /^pre-errata\.cdb$/i,
    meta: { label: '勘误前卡片', description: 'OCG 勘误前版本（三眼怪、黑森林魔女、遗言状）' }
  },
  {
    pattern: /^fixanime\.cdb$/i,
    meta: { label: '动漫卡修正数据', description: 'Anime/VG 动漫卡的修正数据' }
  },
  {
    pattern: /^neet\.cdb$/i,
    meta: { label: 'NEET 自制卡', description: 'NEET 系列自制/动画卡' }
  },
  {
    pattern: /^不会写的卡\.cdb$/i,
    meta: { label: 'NEET 补充卡', description: 'NEET 系列的补充卡片' }
  },
  {
    pattern: /^prerelease-/i,
    meta: { label: '先行发布卡', description: '先行发布 / 未正式发售卡片' }
  },
  {
    pattern: /^release-/i,
    meta: { label: '补充发布卡', description: '正式发售后补充的卡片' }
  }
]

export function cdbLibraryMeta(path: string): CdbLibraryMeta {
  const segments = path.split(/[\\/]/)
  const name = segments[segments.length - 1] ?? path
  const parent = segments[segments.length - 2] ?? ''
  if (/^cards\.cdb$/i.test(name) && /^expansions$/i.test(parent)) {
    return { label: '扩展卡库', description: '游戏 expansions 目录中的额外卡片' }
  }
  for (const rule of LIBRARY_RULES) {
    if (rule.pattern.test(name)) return rule.meta
  }
  return { label: name, description: '未识别的卡库文件' }
}

export function cdbLibraryLabel(path: string): string {
  return cdbLibraryMeta(path).label
}
