export const CardLocation = {
  DECK: 0x01,
  HAND: 0x02,
  MZONE: 0x04,
  SZONE: 0x08,
  GRAVE: 0x10,
  REMOVED: 0x20,
  EXTRA: 0x40,
  OVERLAY: 0x80,
  FZONE: 0x100,
  PZONE: 0x200
} as const

export const LOCATION_NAMES: Record<number, string> = {
  [CardLocation.DECK]: '主卡组',
  [CardLocation.HAND]: '手牌',
  [CardLocation.MZONE]: '怪兽区',
  [CardLocation.SZONE]: '魔陷区',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.REMOVED]: '除外区',
  [CardLocation.EXTRA]: '额外卡组',
  [CardLocation.OVERLAY]: '超量素材',
  [CardLocation.FZONE]: '场地魔法区',
  [CardLocation.PZONE]: '灵摆区'
}

export const PILE_LOCATIONS: ReadonlySet<number> = new Set<number>([
  CardLocation.DECK,
  CardLocation.EXTRA,
  CardLocation.GRAVE,
  CardLocation.REMOVED
])

export function isPileLocation(location: number): boolean {
  return PILE_LOCATIONS.has(location)
}

export function isSpellTrapLocation(location: number): boolean {
  return (
    location === CardLocation.SZONE ||
    location === CardLocation.FZONE ||
    location === CardLocation.PZONE
  )
}
