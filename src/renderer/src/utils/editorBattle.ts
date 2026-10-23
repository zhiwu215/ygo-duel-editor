import {
  CardLocation,
  CardPosition,
  FieldCard,
  ManualOp,
  createLightweightSnapshot
} from '@shared/index'
import { useAttackTargetingStore } from '../stores/useAttackTargetingStore'
import { useDuelStore } from '../stores/useDuelStore'
import { recordEditorStep } from '../stores/duel/editorStepRecorder'
import { computeBattle, isAttackPosition } from './battleDamage'
import { resolveCardName } from './cardNames'

function duelistKey(card: { duelistId?: string; controller: 0 | 1 }): string {
  return card.duelistId ?? `duelist_${card.controller}`
}

export function executeEditorAttack(attacker: FieldCard, target: FieldCard | null): void {
  useAttackTargetingStore.getState().cancel()
  if (!isAttackPosition(attacker)) return
  const duel = useDuelStore.getState()
  const live = duel.state.cards.find((c) => c.instanceId === attacker.instanceId)
  if (!live) return
  const liveTarget = target
    ? (duel.state.cards.find((c) => c.instanceId === target.instanceId) ?? null)
    : null
  const outcome = computeBattle(live, liveTarget)
  if (!outcome) return
  const opponent = live.controller === 0 ? 1 : 0
  const destroyedIds = new Set(outcome.destroyedInstanceIds)
  const ops: ManualOp[] = []
  for (const id of outcome.destroyedInstanceIds) {
    const card = duel.state.cards.find((c) => c.instanceId === id)
    if (card && card.location !== CardLocation.GRAVE) {
      ops.push({
        type: 'move',
        instanceId: id,
        toLocation: CardLocation.GRAVE,
        toSequence: 0,
        customPos: CardPosition.FACEUP
      })
    }
  }
  let lpChange: { player: 0 | 1; oldLp: number; newLp: number } | undefined
  if (outcome.damage > 0) {
    const player = outcome.damagedPlayer
    const oldLp = duel.state.players[player]?.lp ?? 0
    const newLp = Math.max(0, oldLp - outcome.damage)
    ops.push({ type: 'lp', player, value: newLp })
    lpChange = { player, oldLp, newLp }
  }
  const destroyedCards = duel.state.cards.filter((c) => destroyedIds.has(c.instanceId))
  const destroyedGraveKeys = new Set(destroyedCards.map(duelistKey))
  const boardAfter = createLightweightSnapshot(
    duel.state.cards.filter((c) => !destroyedIds.has(c.instanceId))
  ).map((snap) => {
    if (snap.location === CardLocation.GRAVE && destroyedGraveKeys.has(duelistKey(snap))) {
      return { ...snap, sequence: snap.sequence + 1 }
    }
    return snap
  })
  const graveInsertIndex = new Map<string, number>()
  for (const card of destroyedCards) {
    const key = duelistKey(card)
    const insertIdx = graveInsertIndex.get(key) ?? 0
    graveInsertIndex.set(key, insertIdx + 1)
    const snapshot = createLightweightSnapshot([card])[0]
    boardAfter.push({
      ...snapshot,
      location: CardLocation.GRAVE,
      sequence: insertIdx,
      position: CardPosition.FACEUP
    })
  }
  const attackerName = live.card?.name ?? resolveCardName(live.code)
  const targetName = liveTarget ? (liveTarget.card?.name ?? resolveCardName(liveTarget.code)) : null
  const damageText = outcome.damage > 0 ? `，造成 ${outcome.damage} 点战斗伤害` : ''
  const description = targetName
    ? `【${attackerName}】攻击【${targetName}】${damageText}`
    : `【${attackerName}】直接攻击${damageText}`
  const beforeIndex = useDuelStore.getState().currentStepIndex
  duel.withSingleUndoStep(() => {
    recordEditorStep({
      actionType: 'ATTACK',
      controller: live.controller,
      instanceId: live.instanceId,
      cardCode: live.code,
      cardName: attackerName,
      fromLocation: live.location,
      fromSequence: live.sequence,
      toLocation: live.location,
      toSequence: live.sequence,
      targetInstanceId: liveTarget?.instanceId,
      targetCardName: targetName ?? undefined,
      targetPlayer: targetName ? undefined : opponent,
      description,
      boardAfter,
      ops,
      lpChange
    })
    if (beforeIndex === null) {
      const after = useDuelStore.getState()
      const steps = after.state.steps || []
      if (steps.length > 0) after.previewStepBoard(steps.length - 1)
    }
  })
}
