import { CardLocation, CardPosition, FieldCard } from '@shared/index'

export interface BattleOutcome {
  damage: number
  damagedPlayer: 0 | 1
  destroyedInstanceIds: string[]
}

export function monsterAtk(card: FieldCard): number {
  return card.customAtk ?? card.card?.atk ?? 0
}

export function monsterDef(card: FieldCard): number {
  return card.customDef ?? card.card?.def ?? 0
}

export function isAttackPosition(card: FieldCard): boolean {
  return card.position === CardPosition.FACEUP_ATTACK
}

export function isFaceupMonster(card: FieldCard): boolean {
  return (
    card.location === CardLocation.MZONE &&
    card.position !== CardPosition.FACEDOWN_DEFENSE &&
    card.position !== CardPosition.FACEDOWN_ATTACK
  )
}

export function computeBattle(attacker: FieldCard, target: FieldCard | null): BattleOutcome | null {
  if (!isAttackPosition(attacker)) return null
  const opponent = attacker.controller === 0 ? 1 : 0
  if (!target) {
    return { damage: monsterAtk(attacker), damagedPlayer: opponent, destroyedInstanceIds: [] }
  }
  if (isAttackPosition(target)) {
    const diff = monsterAtk(attacker) - monsterAtk(target)
    if (diff > 0) {
      return {
        damage: diff,
        damagedPlayer: target.controller,
        destroyedInstanceIds: [target.instanceId]
      }
    }
    if (diff < 0) {
      return {
        damage: -diff,
        damagedPlayer: attacker.controller,
        destroyedInstanceIds: [attacker.instanceId]
      }
    }
    return {
      damage: 0,
      damagedPlayer: attacker.controller,
      destroyedInstanceIds: [attacker.instanceId, target.instanceId]
    }
  }
  const diff = monsterAtk(attacker) - monsterDef(target)
  if (diff > 0) {
    return {
      damage: diff,
      damagedPlayer: target.controller,
      destroyedInstanceIds: [target.instanceId]
    }
  }
  return { damage: 0, damagedPlayer: target.controller, destroyedInstanceIds: [] }
}
