import React, { useEffect, useMemo } from 'react'
import {
  CardLocation,
  CardPosition,
  EnginePendingAction,
  isCardMatchingEngineOption
} from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import {
  enginePromptUsesModal,
  getActionsFromEngine,
  getFallbackActions
} from '../../utils/ruleCheck'
import {
  Sparkles,
  MapPin,
  Check,
  X,
  Crosshair,
  ArrowDownToLine,
  Ban,
  EyeOff,
  Zap
} from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const BoardSelectionControls: React.FC<{ pendingAction: EnginePendingAction }> = ({
  pendingAction
}) => {
  const pickedOptionIds = useDuelEngineStore((s) => s.pickedOptionIds)
  const confirmPendingSelection = useDuelEngineStore((s) => s.confirmPendingSelection)
  const clearPendingSelection = useDuelEngineStore((s) => s.clearPendingSelection)

  const min = pendingAction.min ?? 1
  const max = pendingAction.max ?? 1
  const ready = pickedOptionIds.length >= Math.max(min, 1)
  const cancelOpt = pendingAction.options.find((o) => o.type === 'PASS')

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'text-[11px] font-bold tabular-nums',
          ready ? 'text-emerald-500' : 'text-muted-foreground'
        )}
      >
        已选 {pickedOptionIds.length}/{min === max ? min : `${min}~${max}`}
      </span>
      <Button
        size="sm"
        disabled={!ready}
        className="h-6 px-2.5 text-[11px]"
        onClick={() => void confirmPendingSelection()}
      >
        <Check className="h-3 w-3 mr-0.5" />
        确认
      </Button>
      {cancelOpt && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            clearPendingSelection()
            void useDuelEngineStore.getState().submitAction(cancelOpt.id)
          }}
        >
          <X className="h-3 w-3 mr-0.5" />
          取消
        </Button>
      )}
    </div>
  )
}

export const ActionIntentBar: React.FC = () => {
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const enginePendingAction = useDuelEngineStore((s) => s.pendingAction)
  const pendingPlacement = useDuelStore((s) => s.pendingPlacement)
  const cancelPlacement = useDuelStore((s) => s.cancelPlacement)
  const selectedCardId = useDuelStore((s) => s.selectedCardId)
  const cards = useDuelStore((s) => s.state.cards)
  const beginPlacement = useDuelStore((s) => s.beginPlacement)
  const executeActivateCard = useDuelStore((s) => s.executeActivateCard)
  const executeSendToGrave = useDuelStore((s) => s.executeSendToGrave)
  const executeBanishCard = useDuelStore((s) => s.executeBanishCard)
  const executeSpecialSummon = useDuelStore((s) => s.executeSpecialSummon)
  const executeReposCard = useDuelStore((s) => s.executeReposCard)
  const executeAttackCard = useDuelStore((s) => s.executeAttackCard)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const s = useDuelStore.getState()
        if (s.pendingPlacement) {
          e.preventDefault()
          s.cancelPlacement()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selectedCard = selectedCardId
    ? cards.find((c) => c.instanceId === selectedCardId)
    : undefined

  const isModalActive = enginePromptUsesModal(enginePendingAction)

  const hasEngineInteractive =
    Boolean(enginePendingAction) &&
    !isModalActive &&
    [
      'SELECT_PLACE',
      'SELECT_CHAIN',
      'SELECT_YESNO',
      'SELECT_EFFECTYN',
      'SELECT_CARD',
      'SELECT_TRIBUTE'
    ].includes(enginePendingAction!.kind)

  const cardActions = useMemo(() => {
    if (!selectedCard) return null
    if (!isEngine) {
      return getFallbackActions(selectedCard)
    }
    return getActionsFromEngine(selectedCard, enginePendingAction?.options || [])
  }, [selectedCard, isEngine, enginePendingAction])

  const engineActions = useMemo(() => {
    if (!selectedCard || !enginePendingAction || !enginePendingAction.options) return []
    return enginePendingAction.options.filter((opt) =>
      isCardMatchingEngineOption(selectedCard, opt)
    )
  }, [selectedCard, enginePendingAction])

  const summonOpt = engineActions.find((o) => o.type === 'SUMMON')
  const spSummonOpt = engineActions.find((o) => o.type === 'SPSUMMON')
  const setOpt = engineActions.find((o) => o.type === 'SSET' || o.type === 'MSET')
  const activateOpt = engineActions.find((o) => o.type === 'ACTIVATE')
  const reposOpt = engineActions.find((o) => o.type === 'REPOS')
  const attackOpt = engineActions.find((o) => o.type === 'ATTACK')

  const handleSummon = (): void => {
    if (!selectedCard) return
    if (summonOpt) {
      void useDuelEngineStore.getState().submitAction(summonOpt.id)
    } else if (!isEngine) {
      beginPlacement('SUMMON', selectedCard.instanceId)
    }
  }

  const handleSpSummon = (): void => {
    if (!selectedCard) return
    if (spSummonOpt) {
      void useDuelEngineStore.getState().submitAction(spSummonOpt.id)
    } else if (!isEngine) {
      executeSpecialSummon(selectedCard.instanceId)
    }
  }

  const handleSet = (): void => {
    if (!selectedCard) return
    if (setOpt) {
      void useDuelEngineStore.getState().submitAction(setOpt.id)
    } else if (!isEngine) {
      beginPlacement('SET', selectedCard.instanceId)
    }
  }

  const handleActivate = (): void => {
    if (!selectedCard) return
    if (activateOpt) {
      void useDuelEngineStore.getState().submitAction(activateOpt.id)
    } else if (!isEngine) {
      if (selectedCard.location === CardLocation.HAND) {
        beginPlacement('ACTIVATE', selectedCard.instanceId)
      } else {
        executeActivateCard(selectedCard.instanceId)
      }
    }
  }

  const handleRepos = (): void => {
    if (!selectedCard) return
    if (reposOpt) {
      void useDuelEngineStore.getState().submitAction(reposOpt.id)
    } else if (!isEngine) {
      void executeReposCard(selectedCard.instanceId)
    }
  }

  const handleAttack = (): void => {
    if (!selectedCard) return
    if (attackOpt) {
      void useDuelEngineStore.getState().submitAction(attackOpt.id)
    } else if (!isEngine) {
      executeAttackCard(selectedCard.instanceId)
    }
  }

  const reposLabel =
    selectedCard?.position === CardPosition.FACEDOWN_DEFENSE
      ? '反转召唤'
      : selectedCard?.position === CardPosition.FACEUP_ATTACK
        ? '转为守备'
        : '转为攻击'

  if (!hasEngineInteractive && !pendingPlacement && (!selectedCard || !cardActions?.hasAnyAction)) {
    return null
  }

  return (
    <div
      className={cn(
        'absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs shadow-lg select-none',
        hasEngineInteractive
          ? 'border-sky-500/50 bg-popover ring-1 ring-sky-500/20'
          : pendingPlacement
            ? 'border-amber-400/60 bg-popover'
            : 'border-border bg-popover'
      )}
    >
      {hasEngineInteractive && enginePendingAction ? (
        <div className="flex items-center gap-2">
          {enginePendingAction.kind === 'SELECT_PLACE' && (
            <MapPin className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          )}
          {enginePendingAction.kind === 'SELECT_CHAIN' && (
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          )}
          {(enginePendingAction.kind === 'SELECT_YESNO' ||
            enginePendingAction.kind === 'SELECT_EFFECTYN') && (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {(enginePendingAction.kind === 'SELECT_CARD' ||
            enginePendingAction.kind === 'SELECT_TRIBUTE') && (
            <Crosshair className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          )}
          <span className="font-medium text-xs text-foreground">
            {enginePendingAction.title}
            {enginePendingAction.subtitle ? ` (${enginePendingAction.subtitle})` : ''}
          </span>

          {(enginePendingAction.kind === 'SELECT_CARD' ||
            enginePendingAction.kind === 'SELECT_TRIBUTE') &&
          !isModalActive ? (
            <BoardSelectionControls pendingAction={enginePendingAction} />
          ) : (
            <div className="flex items-center gap-1">
              {enginePendingAction.options.map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={opt.type === 'PASS' || opt.type === 'NO' ? 'secondary' : 'default'}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => void useDuelEngineStore.getState().submitAction(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : pendingPlacement ? (
        <>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="shrink-0 font-medium">
            【{pendingPlacement.sourceName}】
            {pendingPlacement.mode === 'ACTIVATE'
              ? '发动'
              : pendingPlacement.mode === 'SET'
                ? '盖放'
                : '召唤'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={cancelPlacement}
          >
            <X className="h-3 w-3 mr-1" />
            取消
          </Button>
        </>
      ) : (
        <>
          <span className="shrink-0 max-w-32 truncate font-medium text-foreground">
            {selectedCard?.card?.name || `卡片 ${selectedCard?.code}`}
          </span>
          {cardActions?.canSummon && (
            <Button
              variant="default"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold cursor-pointer"
              onClick={handleSummon}
            >
              <Crosshair className="h-3 w-3 mr-1" />
              召唤
            </Button>
          )}
          {cardActions?.canSpSummon && (
            <Button
              variant="secondary"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold cursor-pointer"
              onClick={handleSpSummon}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              特殊召唤
            </Button>
          )}
          {(cardActions?.canMonsterSet || cardActions?.canSpellSet) && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold cursor-pointer"
              onClick={handleSet}
            >
              <EyeOff className="h-3 w-3 mr-1" />
              盖放
            </Button>
          )}
          {cardActions?.canActivate && (
            <Button
              variant="default"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              onClick={handleActivate}
            >
              <Zap className="h-3 w-3 mr-1" />
              发动
            </Button>
          )}
          {cardActions?.canRepos && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold cursor-pointer"
              onClick={handleRepos}
            >
              {reposLabel}
            </Button>
          )}
          {cardActions?.canAttack && (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] font-bold cursor-pointer"
              onClick={handleAttack}
            >
              攻击
            </Button>
          )}
          {!isEngine && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[11px] cursor-pointer"
                onClick={() => selectedCard && executeSendToGrave(selectedCard.instanceId)}
              >
                <ArrowDownToLine className="h-3 w-3 mr-1" />
                送墓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[11px] cursor-pointer"
                onClick={() => selectedCard && executeBanishCard(selectedCard.instanceId)}
              >
                <Ban className="h-3 w-3 mr-1" />
                除外
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
