import React, { useState, useEffect, useRef } from 'react'
import {
  Answer,
  CardLocation,
  CardPosition,
  PLACEHOLDER_MONSTER_CARD_CODE,
  PLACEHOLDER_SPELL_TRAP_CARD_CODE,
  placeholderKindOf
} from '@shared/index'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useAttackTargetingStore } from '../../stores/useAttackTargetingStore'
import { executeEditorAttack } from '../../utils/editorBattle'
import { deriveCardEngineActions } from '../../utils/engineActions'
import { buildCardEngineActionMap, reposActionLabel } from '../../utils/cardMenuActions'
import { cn } from '../../lib/utils'

export const CardCommandMenu: React.FC = () => {
  const store = useCardCommandMenuStore()
  const card = store.card
  const anchorRect = store.anchorRect
  const onClose = store.closeMenu

  const [optionsCardId, setOptionsCardId] = useState<string | null>(null)
  const showOptions = optionsCardId !== null && optionsCardId === card?.instanceId
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOptionsCardId(null)
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOptionsCardId(null)
        onClose()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const engineLoading = useDuelEngineStore((s) => s.loading)
  const cards = useDuelStore((s) => s.state.cards)
  const currentPhase = useDuelStore((s) => s.currentPhase)

  const requestActions = React.useMemo(
    () => deriveCardEngineActions(pendingRequest, card),
    [pendingRequest, card]
  )
  const actionMap = React.useMemo(
    () => (requestActions ? buildCardEngineActionMap(requestActions, card?.position) : null),
    [requestActions, card]
  )
  const useRequestActions = Boolean(isEngine && actionMap)

  const isEditorAttackable =
    !isEngine &&
    currentPhase === 'BP' &&
    card !== null &&
    card.location === CardLocation.MZONE &&
    card.position === CardPosition.FACEUP_ATTACK
  const editorDirectAttackable =
    isEditorAttackable &&
    card !== null &&
    !cards.some((c) => c.controller !== card.controller && c.location === CardLocation.MZONE)

  if (!card || !anchorRect) return null

  const placeholderKind = placeholderKindOf(card.code)
  const canSwitchPlaceholder =
    isEngine &&
    !isReplay &&
    !engineLoading &&
    card.location === CardLocation.HAND &&
    placeholderKind !== null
  const showPlaceholderChoice = canSwitchPlaceholder && placeholderKind === 'neutral'

  const submitAnswer = (answer: Answer): void => {
    void useDuelEngineStore.getState().submitAnswer(answer)
    onClose()
  }

  const convertPlaceholder = async (targetCode: number): Promise<void> => {
    if (!canSwitchPlaceholder) return
    const rect = anchorRect
    const ref = {
      controller: card.controller,
      location: card.location,
      sequence: card.sequence,
      instanceId: card.instanceId,
      duelistId: card.duelistId
    }
    onClose()
    const replaced = await useDuelEngineStore.getState().replaceCard(ref, targetCode)
    if (!replaced) return
    const nextCard = useDuelStore
      .getState()
      .state.cards.find(
        (item) =>
          item.controller === card.controller &&
          item.location === card.location &&
          item.sequence === card.sequence &&
          item.duelistId === card.duelistId &&
          item.code === targetCode
      )
    if (nextCard) useCardCommandMenuStore.getState().openMenu(nextCard, rect)
  }

  const handleSummon = (): void => {
    if (actionMap?.summon) {
      submitAnswer(actionMap.summon.answer)
    }
    onClose()
  }

  const handleSpSummon = (): void => {
    if (actionMap?.spSummon) {
      submitAnswer(actionMap.spSummon.answer)
    }
    onClose()
  }

  const handleActivate = (): void => {
    if (actionMap) {
      if (actionMap.activate.length > 1) {
        setOptionsCardId(card.instanceId)
        return
      }
      if (actionMap.activate.length === 1) {
        submitAnswer(actionMap.activate[0].answer)
        return
      }
    }
    onClose()
  }

  const handleSet = (): void => {
    if (actionMap?.set) {
      submitAnswer(actionMap.set.answer)
      return
    }
    onClose()
  }

  const handleRepos = (): void => {
    if (actionMap?.repos) {
      submitAnswer(actionMap.repos.answer)
    }
    onClose()
  }

  const handleAttack = (): void => {
    if (actionMap?.attack) {
      submitAnswer(actionMap.attack.answer)
    }
    onClose()
  }

  const handleChain = (): void => {
    if (actionMap?.chain) {
      submitAnswer(actionMap.chain.answer)
    }
    onClose()
  }

  const handleEditorAttack = (): void => {
    if (card) {
      if (editorDirectAttackable) {
        executeEditorAttack(card, null)
      } else {
        useAttackTargetingStore.getState().start(card)
      }
    }
    onClose()
  }

  const reposLabel = reposActionLabel(card.position)

  const attackLabel = useRequestActions
    ? requestActions?.attack?.directAttackable
      ? '攻击（可直攻）'
      : '攻击'
    : editorDirectAttackable
      ? '攻击（可直攻）'
      : '攻击'

  const actionButtonCount = useRequestActions
    ? (actionMap?.summon ? 1 : 0) +
      (actionMap?.spSummon ? 1 : 0) +
      (actionMap?.set ? 1 : 0) +
      (actionMap?.repos ? 1 : 0) +
      (actionMap?.attack ? 1 : 0) +
      (actionMap?.chain ? 1 : 0) +
      (actionMap?.activate.length ? 1 : 0)
    : isEditorAttackable
      ? 1
      : 0
  const placeholderButtonCount = showPlaceholderChoice ? 2 : canSwitchPlaceholder ? 1 : 0
  const buttonCount = showPlaceholderChoice ? 2 : actionButtonCount + placeholderButtonCount

  const activateOptionList: { id: string; label: string }[] =
    actionMap?.activate.map((spec, i) => ({
      id: `req-act-${i}`,
      label: spec.label
    })) ?? []

  if (buttonCount === 0 && !showOptions) return null

  const menuWidth = showOptions ? 220 : 96
  const menuHeight = showOptions
    ? Math.min(220, activateOptionList.length * 36 + 36)
    : Math.max(26, buttonCount * 26)

  const x = Math.min(
    Math.max(8, anchorRect.left + (anchorRect.width - menuWidth) / 2),
    window.innerWidth - menuWidth - 8
  )
  const y = Math.min(
    Math.max(8, anchorRect.top + (anchorRect.height - menuHeight) / 2 - 8),
    window.innerHeight - menuHeight - 8
  )

  const buttonClass = cn(
    'w-full h-[26px] px-2 flex items-center justify-center font-sans text-xs font-bold tracking-wider cursor-pointer select-none transition-colors border-b last:border-b-0',
    'bg-gradient-to-b from-[#e8e8e8] via-[#d6d6d6] to-[#bebebe] text-neutral-900 border-neutral-400/80',
    'hover:from-[#f5f5f5] hover:via-[#e6e6e6] hover:to-[#cecece]',
    'active:from-[#b0b0b0] active:to-[#9a9a9a]',
    'dark:from-neutral-700 dark:via-neutral-800 dark:to-neutral-900 dark:text-neutral-100 dark:border-neutral-700/80',
    'dark:hover:from-neutral-600 dark:hover:via-neutral-700 dark:hover:to-neutral-800'
  )

  return (
    <div
      ref={menuRef}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 flex flex-col rounded-sm border border-neutral-500/80 shadow-2xl overflow-hidden bg-neutral-900/95"
      onClick={(e) => e.stopPropagation()}
    >
      {showOptions ? (
        <div className="flex flex-col p-1 gap-1 max-h-[220px] overflow-y-auto w-[220px]">
          <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 border-b border-neutral-700/60 truncate">
            选择要发动的效果
          </div>
          {activateOptionList.map((opt, index) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const spec = actionMap?.activate[index]
                if (spec) submitAnswer(spec.answer)
              }}
              className="w-full px-2 py-1.5 text-left text-xs font-medium rounded hover:bg-neutral-800 active:bg-neutral-700 text-neutral-200 truncate cursor-pointer transition-colors"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOptionsCardId(null)}
            className="w-full px-2 py-1 text-center text-[11px] text-neutral-400 hover:text-neutral-200 mt-1 cursor-pointer"
          >
            返回
          </button>
        </div>
      ) : showPlaceholderChoice ? (
        <>
          <button
            type="button"
            onClick={() => void convertPlaceholder(PLACEHOLDER_MONSTER_CARD_CODE)}
            className={buttonClass}
          >
            作为怪兽
          </button>
          <button
            type="button"
            onClick={() => void convertPlaceholder(PLACEHOLDER_SPELL_TRAP_CARD_CODE)}
            className={buttonClass}
          >
            作为魔陷
          </button>
        </>
      ) : (
        <>
          {actionMap?.activate.length ? (
            <button type="button" onClick={handleActivate} className={buttonClass}>
              发动
            </button>
          ) : null}
          {actionMap?.summon ? (
            <button type="button" onClick={handleSummon} className={buttonClass}>
              召唤
            </button>
          ) : null}
          {actionMap?.spSummon ? (
            <button type="button" onClick={handleSpSummon} className={buttonClass}>
              特殊召唤
            </button>
          ) : null}
          {actionMap?.set ? (
            <button type="button" onClick={handleSet} className={buttonClass}>
              盖放
            </button>
          ) : null}
          {actionMap?.repos ? (
            <button type="button" onClick={handleRepos} className={buttonClass}>
              {reposLabel}
            </button>
          ) : null}
          {actionMap?.attack ? (
            <button
              type="button"
              onClick={handleAttack}
              className={cn(buttonClass, 'text-rose-700 dark:text-rose-400')}
            >
              {attackLabel}
            </button>
          ) : null}
          {!useRequestActions && isEditorAttackable ? (
            <button
              type="button"
              onClick={handleEditorAttack}
              className={cn(buttonClass, 'text-rose-700 dark:text-rose-400')}
            >
              {attackLabel}
            </button>
          ) : null}
          {actionMap?.chain ? (
            <button type="button" onClick={handleChain} className={buttonClass}>
              发动
            </button>
          ) : null}
          {canSwitchPlaceholder ? (
            <button
              type="button"
              onClick={() =>
                void convertPlaceholder(
                  placeholderKind === 'monster'
                    ? PLACEHOLDER_SPELL_TRAP_CARD_CODE
                    : PLACEHOLDER_MONSTER_CARD_CODE
                )
              }
              className={buttonClass}
            >
              {placeholderKind === 'monster' ? '转为魔陷' : '转为怪兽'}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
