import { EngineEditedCardInfo } from '@shared/index'
import { resolveCardName } from '../../utils/cardNames'
import { useDuelStore } from '../useDuelStore'
import { isSameCardInstance } from './identityMap'

export function syncCardEditToDuelStore(editedCard: EngineEditedCardInfo): void {
  const newCode = editedCard.newCode
  const cardData = editedCard.card
  const oldName = resolveCardName(editedCard.oldCode)
  const newName = cardData?.name ?? resolveCardName(newCode)
  const targetId = editedCard.instanceId

  useDuelStore.setState((prev) => {
    const nextCards =
      editedCard.action === 'remove'
        ? prev.state.cards.filter((c) => !isSameCardInstance(c.instanceId, targetId))
        : prev.state.cards.map((c) => {
            if (isSameCardInstance(c.instanceId, targetId)) {
              return {
                ...c,
                code: newCode,
                card: cardData ?? c.card
              }
            }
            return c
          })

    const nextSnapshot =
      prev.state.initialBoardSnapshot && editedCard.originKind === 'initial'
        ? editedCard.action === 'remove'
          ? prev.state.initialBoardSnapshot.filter(
              (s) => !isSameCardInstance(s.instanceId, targetId)
            )
          : prev.state.initialBoardSnapshot.map((s) => {
              if (isSameCardInstance(s.instanceId, targetId)) {
                return { ...s, code: newCode }
              }
              return s
            })
        : prev.state.initialBoardSnapshot

    const nextSteps = (prev.state.steps || []).map((step) => {
      let stepChanged = false
      let boardAfter = step.boardAfter
      if (boardAfter && boardAfter.length > 0) {
        if (editedCard.action === 'remove') {
          const filtered = boardAfter.filter((c) => !isSameCardInstance(c.instanceId, targetId))
          if (filtered.length !== boardAfter.length) {
            boardAfter = filtered
            stepChanged = true
          }
        } else {
          let boardCardChanged = false
          boardAfter = boardAfter.map((c) => {
            if (isSameCardInstance(c.instanceId, targetId)) {
              boardCardChanged = true
              return { ...c, code: newCode }
            }
            return c
          })
          if (boardCardChanged) {
            stepChanged = true
          }
        }
      }

      let cardCode = step.cardCode
      let cardName = step.cardName
      const isStepCard = isSameCardInstance(step.instanceId, targetId)
      if (isStepCard && editedCard.action === 'replace') {
        cardCode = newCode
        cardName = newName
        stepChanged = true
      }

      let targetCardName = step.targetCardName
      const isTargetCard = isSameCardInstance(step.targetInstanceId, targetId)
      if (isTargetCard && editedCard.action === 'replace') {
        targetCardName = newName
        stepChanged = true
      }

      let description = step.description
      if (
        (isStepCard || isTargetCard) &&
        description &&
        oldName &&
        oldName !== newName &&
        description.includes(oldName)
      ) {
        description = description.split(oldName).join(newName)
        stepChanged = true
      }

      let texts = step.texts
      if ((isStepCard || isTargetCard) && texts && oldName && oldName !== newName) {
        texts = texts.map((block) => ({
          ...block,
          text: block.text.includes(oldName) ? block.text.split(oldName).join(newName) : block.text
        }))
        stepChanged = true
      }

      if (!stepChanged) return step
      return {
        ...step,
        ...(cardCode !== undefined ? { cardCode } : {}),
        ...(cardName !== undefined ? { cardName } : {}),
        ...(targetCardName !== undefined ? { targetCardName } : {}),
        ...(boardAfter ? { boardAfter } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(texts ? { texts } : {})
      }
    })

    return {
      ...prev,
      state: {
        ...prev.state,
        cards: nextCards,
        ...(nextSnapshot ? { initialBoardSnapshot: nextSnapshot } : {}),
        steps: nextSteps
      }
    }
  })
}
