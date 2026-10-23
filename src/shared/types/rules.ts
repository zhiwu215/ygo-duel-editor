export type MasterRule = 2 | 3 | 4 | 5

export function getPzoneSzoneSequence(masterRule: number): [number, number] {
  return masterRule >= 4 ? [0, 4] : [6, 7]
}

export function resolveMasterRuleFromDuelRule(duelRule: number): MasterRule | null {
  if (duelRule === 2 || duelRule === 3 || duelRule === 4 || duelRule === 5) {
    return duelRule
  }
  return null
}

const YGOPRO_MASTER_RULES: readonly MasterRule[] = [3, 4, 5]
export const SELECTABLE_MASTER_RULES: readonly MasterRule[] = [2, ...YGOPRO_MASTER_RULES]

interface MasterRuleInfo {
  rule: MasterRule
  name: string
  hasEMZ: boolean
  hasIndependentPZones: boolean
  pendulumInSZone: boolean
  mainMonsterZoneCount: number
  spellTrapZoneCount: number
}

export const MASTER_RULES: Record<MasterRule, MasterRuleInfo> = {
  2: {
    rule: 2,
    name: '大师规则2',
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
