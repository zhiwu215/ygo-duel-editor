import { CardLocation, CardPosition, CardType, FieldCard } from '@shared/index'

export type PendingActionKind = 'ATTACK' | 'ACTIVATE' | 'CHAIN' | 'SUMMON'

export interface PendingAction {
  kind: PendingActionKind
  sourceId: string
  sourceName: string
  sourceController: 0 | 1
  targetIds: string[]
  targetPlayer: 0 | 1 | null
}

/** 「发动 / 盖放 / 召唤」放置待选模式：用户先选卡，按钮后必须点击场上某个空格才落子 */
export type PendingPlacementMode = 'ACTIVATE' | 'SET' | 'SUMMON'

export interface PendingPlacementSlot {
  location: number
  sequence: number
  controller: 0 | 1
  /** 该格已有卡时是否允许落子（落子 = 顶掉旧卡送去墓地）。场地魔法位为 true */
  displaces?: boolean
}

export interface PendingPlacement {
  sourceId: string
  sourceName: string
  sourceController: 0 | 1
  mode: PendingPlacementMode
  /** 卡片类型影响可选槽位集合（场地魔法只能去 SZONE seq 5） */
  cardType: number
  /** 当前可落子的所有空槽 (高亮显示 + 点击生效) */
  allowedSlots: PendingPlacementSlot[]
}

export interface BattlePreview {
  attackerName: string
  attackerAtk: number
  targetName: string
  targetValue: number
  targetIsDefense: boolean
  destroyTarget: boolean
  destroyAttacker: boolean
  damage: number
  damageRecipient: 0 | 1
}

export function getBattleStats(card: FieldCard): { atk: number; def: number } {
  return {
    atk: card.customAtk ?? card.card?.atk ?? 0,
    def: card.customDef ?? card.card?.def ?? 0
  }
}

export function isDefensePosition(position: number): boolean {
  return (position & (CardPosition.FACEUP_DEFENSE | CardPosition.FACEDOWN_DEFENSE)) !== 0
}

export function resolveBattle(attacker: FieldCard, target: FieldCard): BattlePreview {
  const attackerStats = getBattleStats(attacker)
  const targetStats = getBattleStats(target)
  const defense = isDefensePosition(target.position)
  const targetValue = defense ? targetStats.def : targetStats.atk
  const attackerName = attacker.card?.name || String(attacker.code)
  const targetName = target.card?.name || String(target.code)
  const diff = attackerStats.atk - targetValue

  if (defense) {
    return {
      attackerName,
      attackerAtk: attackerStats.atk,
      targetName,
      targetValue,
      targetIsDefense: true,
      destroyTarget: diff > 0,
      destroyAttacker: false,
      damage: diff < 0 ? -diff : 0,
      damageRecipient: attacker.controller
    }
  }

  return {
    attackerName,
    attackerAtk: attackerStats.atk,
    targetName,
    targetValue,
    targetIsDefense: false,
    destroyTarget: diff > 0,
    destroyAttacker: diff < 0,
    damage: Math.abs(diff),
    damageRecipient: diff >= 0 ? target.controller : attacker.controller
  }
}

export function resolveDirectAttack(attacker: FieldCard): BattlePreview {
  const attackerStats = getBattleStats(attacker)
  return {
    attackerName: attacker.card?.name || String(attacker.code),
    attackerAtk: attackerStats.atk,
    targetName: '直接攻击',
    targetValue: 0,
    targetIsDefense: false,
    destroyTarget: false,
    destroyAttacker: false,
    damage: attackerStats.atk,
    damageRecipient: attacker.controller === 0 ? 1 : 0
  }
}

export function getLegalTargetIds(cards: FieldCard[], action: PendingAction): string[] {
  if (action.kind === 'ATTACK') {
    return cards
      .filter((c) => c.controller !== action.sourceController && c.location === CardLocation.MZONE)
      .map((c) => c.instanceId)
  }
  return cards.filter((c) => c.instanceId !== action.sourceId).map((c) => c.instanceId)
}

export function isCardMonster(card: FieldCard): boolean {
  if (!card.card) return card.location === CardLocation.MZONE
  return (card.card.type & CardType.MONSTER) !== 0
}
