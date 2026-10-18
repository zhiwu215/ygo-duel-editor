import React, { useState, useEffect, useRef } from 'react'
import { FieldCard, CardPosition, CardLocation, Answer, RequestCard } from '@shared/index'
import { CardActionOptions } from '../../utils/ruleCheck'
import { useDuelStore } from '../../stores/useDuelStore'
import { useCardCommandMenuStore } from '../../stores/useCardCommandMenuStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { deriveCardEngineActions } from '../../utils/engineActions'
import { resolveCardName } from '../../utils/cardNames'
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

  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)

  // 引擎激活时，动作完全来自 pendingRequest 请求清单（合法才显示）
  const requestActions = React.useMemo(
    () => deriveCardEngineActions(pendingRequest, card ?? null),
    [pendingRequest, card]
  )
  const useRequestActions = Boolean(isEngine && requestActions)

  if (!card || !actions || !anchorRect) return null

  const submitAnswer = (answer: Answer): void => {
    void useDuelEngineStore.getState().submitAnswer(answer)
    onClose()
  }

  const handleSummon = (): void => {
    if (useRequestActions && requestActions?.summon) {
      submitAnswer({ kind: 'idle', cmd: 'SUMMON', card: requestActions.summon })
    } else if (!isEngine) {
      executeNormalSummon(card.instanceId)
    }
    onClose()
  }

  const handleSpSummon = (): void => {
    if (useRequestActions && requestActions?.spSummon) {
      submitAnswer({ kind: 'idle', cmd: 'SPSUMMON', card: requestActions.spSummon })
    } else if (!isEngine) {
      executeSpecialSummon(card.instanceId)
    }
    onClose()
  }

  /** 发动答案按请求来源编码（战斗阶段的 ACTIVATE 必须用 battle 答案） */
  const submitActivate = (cardReq: RequestCard): void => {
    if (requestActions?.requestKind === 'battle') {
      submitAnswer({ kind: 'battle', cmd: 'ACTIVATE', card: cardReq })
    } else {
      submitAnswer({ kind: 'idle', cmd: 'ACTIVATE', card: cardReq })
    }
  }

  const handleActivate = (): void => {
    if (useRequestActions && requestActions) {
      if (requestActions.activate.length > 1) {
        setShowOptions(true)
        return
      }
      if (requestActions.activate.length === 1) {
        submitActivate(requestActions.activate[0])
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
    if (useRequestActions) {
      const setCard = requestActions?.sset ?? requestActions?.mset
      if (setCard) {
        submitAnswer({ kind: 'idle', cmd: requestActions?.sset ? 'SSET' : 'MSET', card: setCard })
        return
      }
    }
    if (!isEngine) {
      executeSetCard(card.instanceId)
    }
    onClose()
  }

  const handleRepos = (): void => {
    if (useRequestActions && requestActions?.repos) {
      submitAnswer({ kind: 'idle', cmd: 'REPOS', card: requestActions.repos })
    } else if (!isEngine) {
      void executeReposCard(card.instanceId)
    }
    onClose()
  }

  const handleAttack = (): void => {
    if (useRequestActions && requestActions?.attack) {
      submitAnswer({ kind: 'battle', cmd: 'ATTACK', card: requestActions.attack })
    } else if (!isEngine) {
      executeAttackCard(card.instanceId)
    }
    onClose()
  }

  const handleChain = (): void => {
    if (useRequestActions && requestActions?.chain) {
      submitAnswer({ kind: 'chain', card: requestActions.chain })
    }
  }

  const reposLabel =
    card.position === CardPosition.FACEDOWN_DEFENSE
      ? '反转召唤'
      : card.position === CardPosition.FACEUP_ATTACK
        ? '转为守备'
        : '转为攻击'

  // S4：战斗请求携带 directAttackable 时在菜单上提示可直攻（真正的直攻/目标分支由引擎 yesno 询问决定）
  const attackLabel =
    useRequestActions && requestActions?.attack?.directAttackable ? '攻击（可直攻）' : '攻击'

  /** 请求模式下多效果列表的标签（效果全文由确认弹窗展示；R7 换 strings 表） */
  const getActivateLabel = (code: number, idx: number): string =>
    `发动 [${resolveCardName(code)}]（效果 ${idx + 1}）`

  const buttonCount = useRequestActions
    ? (requestActions?.summon ? 1 : 0) +
      (requestActions?.spSummon ? 1 : 0) +
      (requestActions?.sset || requestActions?.mset ? 1 : 0) +
      (requestActions?.repos ? 1 : 0) +
      (requestActions?.attack ? 1 : 0) +
      (requestActions?.activate.length ? 1 : 0) +
      (requestActions?.chain ? 1 : 0)
    : !isEngine
      ? // 非引擎（自由编排）模式：沿用本地规则推导的动作
        (actions.canActivate ? 1 : 0) +
        (actions.canSummon ? 1 : 0) +
        (actions.canSpSummon ? 1 : 0) +
        (actions.canMonsterSet || actions.canSpellSet ? 1 : 0) +
        (actions.canRepos ? 1 : 0) +
        (actions.canAttack ? 1 : 0)
      : 0

  const activateOptionList: { id: string; label: string }[] =
    requestActions?.activate.map((c, i) => ({
      id: `req-act-${i}`,
      label: getActivateLabel(c.code, i)
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
                const cardReq = requestActions?.activate[index]
                if (cardReq) submitActivate(cardReq)
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
              {requestActions?.activate.length ? (
                <button type="button" onClick={handleActivate} className={buttonClass}>
                  发动
                </button>
              ) : null}
              {requestActions?.summon ? (
                <button type="button" onClick={handleSummon} className={buttonClass}>
                  召唤
                </button>
              ) : null}
              {requestActions?.spSummon ? (
                <button type="button" onClick={handleSpSummon} className={buttonClass}>
                  特殊召唤
                </button>
              ) : null}
              {requestActions?.sset || requestActions?.mset ? (
                <button type="button" onClick={handleSet} className={buttonClass}>
                  盖放
                </button>
              ) : null}
              {requestActions?.repos ? (
                <button type="button" onClick={handleRepos} className={buttonClass}>
                  {reposLabel}
                </button>
              ) : null}
              {requestActions?.attack ? (
                <button
                  type="button"
                  onClick={handleAttack}
                  className={cn(buttonClass, 'text-rose-700 dark:text-rose-400')}
                >
                  {attackLabel}
                </button>
              ) : null}
              {requestActions?.chain ? (
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
