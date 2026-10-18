import React, { useEffect, useMemo } from 'react'
import { CardLocation, CardPosition } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { getFallbackActions } from '../../utils/ruleCheck'
import { resolveCardName } from '../../utils/cardNames'
import { Sparkles, MapPin, X, Crosshair, ArrowDownToLine, Ban, EyeOff, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/**
 * 底部动作条（自由编排模式）。
 *
 * 引擎激活时：idle/battle 的动作由 CardCommandMenu（pendingRequest 数据源）承担，
 * 选卡询问由 DuelSelectionBar 承担，这里只在自由编排模式下提供本地语义动作
 * （召唤/特召/盖放/发动/改变形式/攻击/送墓/除外）与「发动/盖放」待放落点提示。
 */
export const ActionIntentBar: React.FC = () => {
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
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

  // 选卡询问（card/tribute/sum/unselect）由 DuelSelectionBar + CardItem 点选接管，动作条让位
  const selectionRequestActive =
    pendingRequest?.data.kind === 'card' ||
    pendingRequest?.data.kind === 'tribute' ||
    pendingRequest?.data.kind === 'sum' ||
    pendingRequest?.data.kind === 'unselect'

  const cardActions = useMemo(
    () => (!isEngine && selectedCard ? getFallbackActions(selectedCard) : null),
    [isEngine, selectedCard]
  )

  if (
    selectionRequestActive ||
    (!pendingPlacement && (!selectedCard || !cardActions?.hasAnyAction))
  ) {
    return null
  }

  const handleSummon = (): void => {
    if (selectedCard) beginPlacement('SUMMON', selectedCard.instanceId)
  }

  const handleSpSummon = (): void => {
    if (selectedCard) executeSpecialSummon(selectedCard.instanceId)
  }

  const handleSet = (): void => {
    if (selectedCard) beginPlacement('SET', selectedCard.instanceId)
  }

  const handleActivate = (): void => {
    if (!selectedCard) return
    if (selectedCard.location === CardLocation.HAND) {
      beginPlacement('ACTIVATE', selectedCard.instanceId)
    } else {
      executeActivateCard(selectedCard.instanceId)
    }
  }

  const handleRepos = (): void => {
    if (selectedCard) void executeReposCard(selectedCard.instanceId)
  }

  const handleAttack = (): void => {
    if (selectedCard) executeAttackCard(selectedCard.instanceId)
  }

  const reposLabel =
    selectedCard?.position === CardPosition.FACEDOWN_DEFENSE
      ? '反转召唤'
      : selectedCard?.position === CardPosition.FACEUP_ATTACK
        ? '转为守备'
        : '转为攻击'

  return (
    <div
      className={cn(
        'absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs shadow-lg select-none',
        pendingPlacement ? 'border-amber-400/60 bg-popover' : 'border-border bg-popover'
      )}
    >
      {pendingPlacement ? (
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
            {selectedCard ? resolveCardName(selectedCard.code) : ''}
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
    </div>
  )
}
