export type MasterRule = 2 | 3 | 4 | 5

export const YGOPRO_MASTER_RULES: readonly MasterRule[] = [3, 4, 5]
export const SELECTABLE_MASTER_RULES: readonly MasterRule[] = [2, ...YGOPRO_MASTER_RULES]

export interface MasterRuleInfo {
  rule: MasterRule
  name: string
  hasEMZ: boolean // 是否拥有 2 个额外怪兽区 (Extra Monster Zones)
  hasIndependentPZones: boolean // 是否拥有独立的左右灵摆区 (MR3)
  pendulumInSZone: boolean // 灵摆区是否合并在魔陷区 0 和 4 号位 (MR4, MR5)
  mainMonsterZoneCount: number // 主怪兽区格子数 (通常为 5)
  spellTrapZoneCount: number // 魔陷区格子数 (通常为 5)
}

export const MASTER_RULES: Record<MasterRule, MasterRuleInfo> = {
  2: {
    rule: 2,
    name: '经典',
    hasEMZ: false,
    hasIndependentPZones: false,
    pendulumInSZone: false,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  3: {
    rule: 3,
    name: '大师规则3',
    hasEMZ: false,
    hasIndependentPZones: true,
    pendulumInSZone: false,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  4: {
    rule: 4,
    name: '新大师规则（2017）',
    hasEMZ: true,
    hasIndependentPZones: false,
    pendulumInSZone: true,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  },
  5: {
    rule: 5,
    name: '大师规则（2020）',
    hasEMZ: true,
    hasIndependentPZones: false,
    pendulumInSZone: true,
    mainMonsterZoneCount: 5,
    spellTrapZoneCount: 5
  }
}
