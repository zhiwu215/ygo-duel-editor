import React, { useState, useEffect, useRef } from 'react'
import { FieldCard, CardType, CardPosition, CardLocation } from '@shared/index'
import { CardActionOptions } from '../../utils/ruleCheck'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { cn } from '../../lib/utils'

interface CardCommandMenuProps {
  card?: FieldCard
  actions?: CardActionOptions
  onClose?: () => void
  anchorRect?: DOMRect | null
}

interface CardCommandMenuContentProps {
  card: FieldCard
  actions: CardActionOptions
  anchorRect: DOMRect
  onClose: () => void
}

const CardCommandMenuContent: React.FC<CardCommandMenuContentProps> = ({
  card,
  actions,
  anchorRect,
  onClose
}) => {
  const [showOptions, setShowOptions] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const {
    executeNormalSummon,
    executeSpecialSummon,
    executeActivateCard,
    executeSetCard,
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
    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [onClose])

  const cdb = card.card
  const isPendulum = cdb ? (cdb.type & CardType.PENDULUM) !== 0 : false
  const setLabel = isPendulum && actions.canSpellSet && !actions.canMonsterSet ? '放置' : '盖放'

  const handleSummon = (): void => {
    if (card.location === CardLocation.HAND) {
      useDuelStore.getState().beginPlacement('SUMMON', card.instanceId)
    } else {
      executeNormalSummon(card.instanceId)
    }
    onClose()
  }

  const handleSpSummon = (): void => {
    if (
      card.location === CardLocation.HAND ||
      card.location === CardLocation.EXTRA ||
      card.location === CardLocation.GRAVE ||
      card.location === CardLocation.REMOVED
    ) {
      useDuelStore.getState().beginPlacement('SP_SUMMON', card.instanceId)
    } else {
      executeSpecialSummon(card.instanceId)
    }
    onClose()
  }

  const handleActivate = (): void => {
    if (actions.activateOptions.length > 1) {
      setShowOptions(true)
      return
    }
    const effectIndex = actions.activateOptions[0]?.effectIndex
    if (card.location === CardLocation.HAND) {
      useDuelStore.getState().beginPlacement('ACTIVATE', card.instanceId, effectIndex)
    } else {
      executeActivateCard(card.instanceId, undefined, false, effectIndex)
    }
    onClose()
  }

  const handleSelectOption = (effectIndex: number): void => {
    if (card.location === CardLocation.HAND) {
      useDuelStore.getState().beginPlacement('ACTIVATE', card.instanceId, effectIndex)
    } else {
      executeActivateCard(card.instanceId, undefined, false, effectIndex)
    }
    onClose()
  }

  const handleSet = (): void => {
    if (card.location === CardLocation.HAND) {
      useDuelStore.getState().beginPlacement('SET', card.instanceId)
    } else {
      executeSetCard(card.instanceId)
    }
    onClose()
  }

  const handleRepos = (): void => {
    void executeReposCard(card.instanceId)
    onClose()
  }

  const handleAttack = (): void => {
    useDuelStore.getState().beginAction('ATTACK', card.instanceId)
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
    ? Math.min(220, actions.activateOptions.length * 36 + 36)
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
    'dark:from-[#3a3d45] dark:via-[#2e3138] dark:to-[#22242a] dark:text-neutral-100 dark:border-neutral-700',
    'dark:hover:from-[#4b505c] dark:hover:via-[#3b3f49] dark:hover:to-[#2a2d34]',
    'dark:active:from-[#22242a] dark:active:to-[#17181c]'
  )

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 60
      }}
      className={cn(
        'rounded-[2px] border border-neutral-500/80 dark:border-neutral-600 shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-75',
        showOptions ? 'w-56' : 'w-24'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {!showOptions ? (
        <div className="flex flex-col w-full">
          {actions.canActivate && (
            <button type="button" className={buttonClass} onClick={handleActivate}>
              发动
            </button>
          )}
          {actions.canSummon && (
            <button type="button" className={buttonClass} onClick={handleSummon}>
              召唤
            </button>
          )}
          {actions.canSpSummon && (
            <button type="button" className={buttonClass} onClick={handleSpSummon}>
              特殊召唤
            </button>
          )}
          {(actions.canMonsterSet || actions.canSpellSet) && (
            <button type="button" className={buttonClass} onClick={handleSet}>
              {setLabel}
            </button>
          )}
          {actions.canRepos && (
            <button type="button" className={buttonClass} onClick={handleRepos}>
              {reposLabel}
            </button>
          )}
          {actions.canAttack && (
            <button
              type="button"
              className={cn(buttonClass, 'text-rose-700 dark:text-rose-400')}
              onClick={handleAttack}
            >
              攻击
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col w-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
          <div className="px-3 py-1.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-300 border-b border-neutral-300 dark:border-neutral-700 bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center justify-between">
            <span>选择发动效果</span>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setShowOptions(false)}
            >
              返回
            </button>
          </div>
          <div className="flex flex-col overflow-y-auto max-h-44 p-1 gap-1">
            {actions.activateOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                className="w-full py-1.5 px-2 text-[11px] font-medium text-left rounded hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer whitespace-normal leading-tight"
                onClick={() => handleSelectOption(opt.effectIndex)}
              >
                <span className="font-bold mr-1 text-primary">{i + 1}.</span>
                <span>{opt.descText || `效果 ${i + 1}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const CardCommandMenu: React.FC<CardCommandMenuProps> = (props) => {
  const store = useCardCommandMenuStore()
  const card = props.card ?? store.card
  const actions = props.actions ?? store.actions
  const anchorRect = props.anchorRect ?? store.anchorRect
  const onClose = props.onClose ?? store.closeMenu

  if (!card || !actions || !anchorRect || !actions.hasAnyAction) return null

  return (
    <CardCommandMenuContent
      card={card}
      actions={actions}
      anchorRect={anchorRect}
      onClose={onClose}
    />
  )
}
