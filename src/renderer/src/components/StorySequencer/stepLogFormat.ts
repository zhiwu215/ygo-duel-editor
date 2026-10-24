import {
  CardLocation,
  DuelLogCardRef,
  DuelSummonKind,
  PHASE_SHORT_NAMES,
  duelPhaseFromMask
} from '@shared/index'

const SUMMON_LABELS: Record<DuelSummonKind, string> = {
  normal: '通常召唤',
  special: '特殊召唤',
  flip: '反转召唤',
  fusion: '融合召唤',
  synchro: '同调召唤',
  xyz: '超量召唤',
  link: '连接召唤',
  ritual: '仪式召唤',
  pendulum: '灵摆召唤'
}

const ZONE_NAMES: Record<number, string> = {
  [CardLocation.HAND]: '手牌',
  [CardLocation.GRAVE]: '墓地',
  [CardLocation.DECK]: '主卡组',
  [CardLocation.EXTRA]: '额外卡组',
  [CardLocation.REMOVED]: '除外区',
  [CardLocation.FZONE]: '场地魔法区',
  [CardLocation.OVERLAY]: '超量素材',
  [CardLocation.PZONE]: '灵摆区'
}

export function phaseName(mask: number): string {
  return PHASE_SHORT_NAMES[duelPhaseFromMask(mask)]
}

export function summonLabel(kind: DuelSummonKind): string {
  return SUMMON_LABELS[kind] ?? '特殊召唤'
}

export function zoneName(location: number, sequence: number): string {
  if (location === CardLocation.MZONE) {
    if (sequence >= 5) return `EX怪兽区${sequence === 5 ? '1' : '2'}`
    return '怪兽区'
  }
  if (location === CardLocation.SZONE) {
    if (sequence >= 6) return '灵摆区'
    if (sequence === 5) return '场地魔法区'
    return '魔陷区'
  }
  return ZONE_NAMES[location] ?? '未知区域'
}

export function sideName(controller: 0 | 1): string {
  return controller === 0 ? '我方' : '对方'
}

export function cardLabel(card: DuelLogCardRef, fallback = '卡片'): string {
  return card.name || (card.code > 0 ? String(card.code) : fallback)
}

export function zoneLabel(
  card: Pick<DuelLogCardRef, 'controller' | 'location' | 'sequence'>
): string {
  return `${sideName(card.controller)}${zoneName(card.location, card.sequence)}`
}

export function cardWithZone(card: DuelLogCardRef): string {
  return `「${cardLabel(card)}」${zoneLabel(card)}`
}

export function moveSummary(from: DuelLogCardRef | undefined, to: DuelLogCardRef): string {
  return from ? `${zoneLabel(from)} → ${zoneLabel(to)}` : zoneLabel(to)
}
