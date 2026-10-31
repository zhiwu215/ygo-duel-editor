import {
  CardLocation,
  DuelActionType,
  DuelLogCardRef,
  DuelPhase,
  DuelStep,
  DuelSummonKind,
  PHASE_SHORT_NAMES
} from '@shared/index'

const SUMMON_LABELS: Record<DuelSummonKind, string> = {
  normal: '召唤',
  special: '特殊召唤',
  flip: '反转召唤',
  fusion: '融合召唤',
  synchro: '同调召唤',
  xyz: '超量召唤',
  link: '连接召唤',
  ritual: '仪式召唤',
  pendulum: '灵摆召唤'
}

const MOVE_REASON_LABELS: Record<string, string> = {
  加入手牌: '加入',
  回到手牌: '回到',
  回到场上: '回到',
  送入: '送至'
}

const ACTION_LABELS: Partial<Record<DuelActionType, string>> = {
  DRAW: '抽卡',
  SEARCH: '加入',
  SALVAGE: '回收',
  NORMAL_SUMMON: '召唤',
  SPECIAL_SUMMON: '特殊召唤',
  FLIP_SUMMON: '反转召唤',
  XYZ_SUMMON: '超量召唤',
  FUSION_SUMMON: '融合召唤',
  SYNCHRO_SUMMON: '同调召唤',
  LINK_SUMMON: '连接召唤',
  RITUAL_SUMMON: '仪式召唤',
  DETACH_MATERIAL: '送至',
  SET_MONSTER: '盖放',
  SET_SPELL_TRAP: '盖放',
  ACTIVATE: '发动',
  ACTIVATE_FIELD: '发动',
  SET_PENDULUM: '放置',
  ATTACK: '攻击',
  TO_GRAVE: '送至',
  TO_DECK: '送至',
  BANISH: '送至',
  PLACE: '放置',
  CHANGE_POS: '更改表示形式',
  HAND_OPEN: '公开手卡',
  SEND_TO_GRAVE: '送至'
}

export function phaseLabel(phase: DuelPhase): string {
  return PHASE_SHORT_NAMES[phase]
}

export function summonLogLabel(kind: DuelSummonKind): string {
  return SUMMON_LABELS[kind] ?? '特殊召唤'
}

export function moveLogLabel(reasonText: string): string {
  return MOVE_REASON_LABELS[reasonText] ?? reasonText
}

export function revealLogLabel(source: 'deck' | 'hand' | 'field'): string {
  if (source === 'hand') return '公开手卡'
  if (source === 'field') return '公开盖卡'
  return '公开卡组'
}

export function handMoveLogLabel(fromLocation: number | undefined): string {
  if (fromLocation === CardLocation.DECK || fromLocation === CardLocation.EXTRA) return '加入'
  if (fromLocation === CardLocation.GRAVE || fromLocation === CardLocation.REMOVED) return '回收'
  return '回到'
}

export function isPendulumZone(card: DuelLogCardRef): boolean {
  return (
    card.location === CardLocation.PZONE ||
    (card.location === CardLocation.SZONE && card.sequence >= 6)
  )
}

export function stepActionLogLabel(step: DuelStep): string | undefined {
  if (step.actionType === 'TO_HAND') return handMoveLogLabel(step.fromLocation)
  return ACTION_LABELS[step.actionType]
}

export function positionChangeLabel(card: DuelLogCardRef): string {
  return card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE
    ? '盖放'
    : '更改表示形式'
}

export function sideName(controller: 0 | 1): string {
  return controller === 0 ? '我方' : '对方'
}

export function cardLabel(card: DuelLogCardRef, fallback = '卡片'): string {
  return card.name || (card.code > 0 ? String(card.code) : fallback)
}
