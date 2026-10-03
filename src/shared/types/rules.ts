export type MasterRule = 2 | 3 | 4 | 5

export interface MasterRuleInfo {
  rule: MasterRule
  name: string
  shortName: string
  description: string
  hasEMZ: boolean // 是否拥有 2 个额外怪兽区 (Extra Monster Zones)
  hasIndependentPZones: boolean // 是否拥有独立的左右灵摆区 (MR3)
  pendulumInSZone: boolean // 灵摆区是否合并在魔陷区 0 和 4 号位 (MR4, MR5)
  mainMonsterZoneCount: number // 主怪兽区格子数 (通常为 5)
  spellTrapZoneCount: number // 魔陷区格子数 (通常为 5)
}

export const MASTER_RULES: Record<MasterRule, MasterRuleInfo> = {
  2: {
    rule: 2,
    name: '大师规则 1/2（经典 / 同调 / 超量时代）',
    shortName: 'MR1/2 经典',
    description: '无额外怪兽区，无灵摆区，经典的 5 前场 + 5 后场。额外怪兽直接召唤至主怪兽区。',
    hasEMZ: false,
    hasIndependentPZones: false,
    pendulumInSZone: false,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  3: {
    rule: 3,
    name: '大师规则 3（ARC-V 灵摆时代）',
    shortName: 'MR3 灵摆',
    description: '无额外怪兽区，场地左右两侧拥有专属独立的蓝/红刻度灵摆区。',
    hasEMZ: false,
    hasIndependentPZones: true,
    pendulumInSZone: false,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  4: {
    rule: 4,
    name: '新大师规则（VRAINS 连接时代）',
    shortName: 'MR4 新大师',
    description:
      '拥有 2 个额外怪兽区 (EMZ)。额外卡组怪兽必须出在 EMZ 或连接怪兽指向的区域。灵摆区合并到魔陷区两端。',
    hasEMZ: true,
    hasIndependentPZones: false,
    pendulumInSZone: true,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  5: {
    rule: 5,
    name: '大师规则 2020（现行大师规则 / MD）',
    shortName: 'MR5 现行',
    description:
      '拥有 2 个额外怪兽区 (EMZ)。融合/同调/超量怪兽解限可自由出在主怪兽区。灵摆区位于魔陷区两端。',
    hasEMZ: true,
    hasIndependentPZones: false,
    pendulumInSZone: true,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  }
}
