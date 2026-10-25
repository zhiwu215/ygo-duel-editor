import React, { useMemo } from 'react'
import { CardLocation, CardPosition, type FieldCard } from '@shared/index'
import { useAttackTargetingStore } from '../../../stores/useAttackTargetingStore'
import { useCardCommandMenuStore } from '../../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { useDuelStore } from '../../../stores/useDuelStore'
import { executeEditorAttack } from '../../../utils/editorBattle'
import { deriveCardEngineActions } from '../../../utils/engineActions'
import { isFaceupMonster } from '../../../utils/battleDamage'

interface CardAttackActionButtonProps {
  card: FieldCard
}

export const CardAttackActionButton: React.FC<CardAttackActionButtonProps> = ({ card }) => {
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const submitAnswer = useDuelEngineStore((s) => s.submitAnswer)
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const cards = useDuelStore((s) => s.state.cards)
  const targetingAttacker = useAttackTargetingStore((s) => s.attacker)
  const closeCommandMenu = useCardCommandMenuStore((s) => s.closeMenu)

  const actions = useMemo(
    () => deriveCardEngineActions(pendingRequest, card),
    [pendingRequest, card]
  )
  const engineAttack = actions?.attack
  const editorTargetable =
    targetingAttacker !== null &&
    targetingAttacker.instanceId !== card.instanceId &&
    card.controller !== targetingAttacker.controller &&
    isFaceupMonster(card)
  const editorAttackable =
    !isEngineActive &&
    targetingAttacker === null &&
    currentPhase === 'BP' &&
    card.location === CardLocation.MZONE &&
    card.position === CardPosition.FACEUP_ATTACK
  const editorDirect =
    editorAttackable &&
    !cards.some((c) => c.controller !== card.controller && c.location === CardLocation.MZONE)

  const label = engineAttack
    ? `攻击${engineAttack.directAttackable ? '（可直攻）' : ''}`
    : editorTargetable
      ? '攻击'
      : editorAttackable
        ? `攻击${editorDirect ? '（可直攻）' : ''}`
        : null
  if (!label) return null

  const handleClick = (event: React.MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    closeCommandMenu()
    if (engineAttack) {
      submitAnswer({ kind: 'battle', cmd: 'ATTACK', card: engineAttack })
      return
    }
    if (targetingAttacker && editorTargetable) {
      executeEditorAttack(targetingAttacker, card)
      return
    }
    if (!editorAttackable) return
    if (editorDirect) {
      executeEditorAttack(card, null)
    } else {
      useAttackTargetingStore.getState().start(card)
    }
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleClick}
      className="absolute left-1/2 top-1/2 z-30 min-w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-rose-300 bg-white/95 px-2.5 py-1 text-xs font-bold tracking-wider text-rose-600 shadow-md hover:bg-white cursor-pointer"
    >
      {label}
    </button>
  )
}
