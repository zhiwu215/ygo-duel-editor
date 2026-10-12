import React, { useState, useEffect, useRef } from 'react'
import { FieldCard, CardPosition, CardLocation, isCardMatchingEngineOption } from '@shared/index'
import { CardActionOptions } from '../../utils/ruleCheck'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { cn } from '../../lib/utils'

interface CardCommandMenuProps {
  card?: FieldCard
  actions?: CardActionOptions
  onClose?: () => void
  anchorRect?: DOMRect | null
}

export const CardCommandMenu: React.FC<CardCommandMenuProps> = (props) => {
  const store = useCardCommandMenuStore()
  const card = props.card ?? store.card
  const actions = props.actions ?? store.actions
  const anchorRect = props.anchorRect ?? store.anchorRect
  const onClose = props.onClose ?? store.closeMenu

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

  const pendingAction = useDuelEngineStore((s) => s.pendingAction)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const engineActions = React.useMemo(() => {
    if (!card || !pendingAction || !pendingAction.options) return []
    return pendingAction.options.filter((opt) => isCardMatchingEngineOption(card, opt))
  }, [card, pendingAction])

  if (!card || !actions || !anchorRect || !actions.hasAnyAction) return null

  const summonOpt = engineActions.find((o) => o.type === 'SUMMON')
  const spSummonOpt = engineActions.find((o) => o.type === 'SPSUMMON')
  const setOpt = engineActions.find((o) => o.type === 'SSET' || o.type === 'MSET')
  const activateOpts = engineActions.filter((o) => o.type === 'ACTIVATE')
  const activateOpt = activateOpts[0]
  const reposOpt = engineActions.find((o) => o.type === 'REPOS')
  const attackOpt = engineActions.find((o) => o.type === 'ATTACK')

  const handleSummon = (): void => {
    if (summonOpt) {
      void useDuelEngineStore.getState().submitAction(summonOpt.id)
    } else if (!isEngine) {
      executeNormalSummon(card.instanceId)
    }
    onClose()
  }

  const handleSpSummon = (): void => {
    if (spSummonOpt) {
      void useDuelEngineStore.getState().submitAction(spSummonOpt.id)
    } else if (!isEngine) {
      executeSpecialSummon(card.instanceId)
    }
    onClose()
  }

  const handleActivate = (): void => {
    if (activateOpts.length > 1) {
      setShowOptions(true)
      return
    }
    if (activateOpt) {
      void useDuelEngineStore.getState().submitAction(activateOpt.id)
    } else if (!isEngine) {
      if (card.location === CardLocation.HAND) {
        useDuelStore.getState().beginPlacement('ACTIVATE', card.instanceId)
      } else {
        executeActivateCard(card.instanceId)
      }
    }
    onClose()
  }

  const handleSelectOption = (optId: string): void => {
    void useDuelEngineStore.getState().submitAction(optId)
    onClose()
  }

  const handleSet = (): void => {
    if (setOpt) {
      void useDuelEngineStore.getState().submitAction(setOpt.id)
    } else if (!isEngine) {
      executeSetCard(card.instanceId)
    }
    onClose()
  }

  const handleRepos = (): void => {
    if (reposOpt) {
      void useDuelEngineStore.getState().submitAction(reposOpt.id)
    } else if (!isEngine) {
      void executeReposCard(card.instanceId)
    }
    onClose()
  }

  const handleAttack = (): void => {
    if (attackOpt) {
      void useDuelEngineStore.getState().submitAction(attackOpt.id)
    } else if (!isEngine) {
      executeAttackCard(card.instanceId)
    }
    onClose()
  }

  const reposLabel =
    card.position === CardPosition.FACEDOWN_DEFENSE
      ? '反转召唤'
      : card.position === CardPosition.FACEUP_ATTACK
        ? '转为守备'
        : '转为攻击'

  const buttonCount =
    (actions.canActivate ? 1 : 0) +
    (actions.canSummon ? 1 : 0) +
    (actions.canSpSummon ? 1 : 0) +
    (actions.canMonsterSet || actions.canSpellSet ? 1 : 0) +
    (actions.canRepos ? 1 : 0) +
    (actions.canAttack ? 1 : 0)

  const menuWidth = showOptions ? 220 : 96
  const menuHeight = showOptions
    ? Math.min(220, activateOpts.length * 36 + 36)
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
          {activateOpts.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectOption(opt.id)}
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
    </div>
  )
}
