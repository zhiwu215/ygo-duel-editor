import React, { useState, useEffect, useRef } from 'react'
import { CardLocation, Answer } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { deriveCardEngineActions } from '../../utils/engineActions'
import { buildCardEngineActionMap, reposActionLabel } from '../../utils/cardMenuActions'
import { cn } from '../../lib/utils'

export const CardCommandMenu: React.FC = () => {
  const store = useCardCommandMenuStore()
  const card = store.card
  const actions = store.actions
  const anchorRect = store.anchorRect
  const onClose = store.closeMenu

  const [showOptions, setShowOptions] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const {
    executeNormalSummon,
    executeSpecialSummon,
    executeActivateCard,
    executeSetCard,
    executeAttackCard,
    executeReposCard
  } = useDuelStore()

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
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

  const requestActions = React.useMemo(
    () => deriveCardEngineActions(pendingRequest, card),
    [pendingRequest, card]
  )
  const actionMap = React.useMemo(
    () => (requestActions ? buildCardEngineActionMap(requestActions, card?.position) : null),
    [requestActions, card]
  )
  const useRequestActions = Boolean(isEngine && actionMap)

  if (!card || !actions || !anchorRect) return null

  const submitAnswer = (answer: Answer): void => {
    void useDuelEngineStore.getState().submitAnswer(answer)
    onClose()
  }

  const handleSummon = (): void => {
    if (useRequestActions && actionMap?.summon) {
      submitAnswer(actionMap.summon.answer)
    } else if (!isEngine) {
      executeNormalSummon(card.instanceId)
    }
    onClose()
  }

  const handleSpSummon = (): void => {
    if (useRequestActions && actionMap?.spSummon) {
      submitAnswer(actionMap.spSummon.answer)
    } else if (!isEngine) {
      executeSpecialSummon(card.instanceId)
    }
    onClose()
  }

  const handleActivate = (): void => {
    if (useRequestActions && actionMap) {
      if (actionMap.activate.length > 1) {
        setShowOptions(true)
        return
      }
      if (actionMap.activate.length === 1) {
        submitAnswer(actionMap.activate[0].answer)
        return
      }
    }
    if (!isEngine) {
      if (card.location === CardLocation.HAND) {
        useDuelStore.getState().beginPlacement('ACTIVATE', card.instanceId)
      } else {
        executeActivateCard(card.instanceId)
      }
    }
    onClose()
  }

  const handleSet = (): void => {
    if (useRequestActions && actionMap?.set) {
      submitAnswer(actionMap.set.answer)
      return
    }
    if (!isEngine) {
      executeSetCard(card.instanceId)
    }
    onClose()
  }

  const handleRepos = (): void => {
    if (useRequestActions && actionMap?.repos) {
      submitAnswer(actionMap.repos.answer)
    } else if (!isEngine) {
      void executeReposCard(card.instanceId)
    }
    onClose()
  }

  const handleAttack = (): void => {
    if (useRequestActions && actionMap?.attack) {
      submitAnswer(actionMap.attack.answer)
    } else if (!isEngine) {
      executeAttackCard(card.instanceId)
    }
    onClose()
  }

  const handleChain = (): void => {
    if (useRequestActions && actionMap?.chain) {
      submitAnswer(actionMap.chain.answer)
    }
  }

  const reposLabel = reposActionLabel(card.position)

  const attackLabel =
    useRequestActions && requestActions?.attack?.directAttackable ? '攻击（可直攻）' : '攻击'

  const buttonCount = useRequestActions
    ? (actionMap?.summon ? 1 : 0) +
      (actionMap?.spSummon ? 1 : 0) +
      (actionMap?.set ? 1 : 0) +
      (actionMap?.repos ? 1 : 0) +
      (actionMap?.attack ? 1 : 0) +
      (actionMap?.activate.length ? 1 : 0) +
      (actionMap?.chain ? 1 : 0)
    : !isEngine
      ? (actions.canActivate ? 1 : 0) +
        (actions.canSummon ? 1 : 0) +
        (actions.canSpSummon ? 1 : 0) +
        (actions.canMonsterSet || actions.canSpellSet ? 1 : 0) +
        (actions.canRepos ? 1 : 0) +
        (actions.canAttack ? 1 : 0)
      : 0

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
            onClick={() => setShowOptions(false)}
            className="w-full px-2 py-1 text-center text-[11px] text-neutral-400 hover:text-neutral-200 mt-1 cursor-pointer"
          >
            返回
          </button>
        </div>
      ) : (
        <>
          {useRequestActions ? (
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
              {actionMap?.chain ? (
                <button
                  type="button"
                  onClick={handleChain}
                  className={cn(buttonClass, 'text-teal-700 dark:text-teal-400')}
                >
                  发动连锁
                </button>
              ) : null}
            </>
          ) : (
            <>
              {actions.canActivate && (
                <button type="button" onClick={handleActivate} className={buttonClass}>
                  发动
                </button>
              )}
              {actions.canSummon && (
                <button type="button" onClick={handleSummon} className={buttonClass}>
                  召唤
                </button>
              )}
              {actions.canSpSummon && (
                <button type="button" onClick={handleSpSummon} className={buttonClass}>
                  特殊召唤
                </button>
              )}
              {(actions.canMonsterSet || actions.canSpellSet) && (
                <button type="button" onClick={handleSet} className={buttonClass}>
                  盖放
                </button>
              )}
              {actions.canRepos && (
                <button type="button" onClick={handleRepos} className={buttonClass}>
                  {reposLabel}
                </button>
              )}
              {actions.canAttack && (
                <button
                  type="button"
                  onClick={handleAttack}
                  className={cn(buttonClass, 'text-rose-700 dark:text-rose-400')}
                >
                  攻击
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
