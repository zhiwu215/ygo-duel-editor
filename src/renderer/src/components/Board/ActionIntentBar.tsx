import React, { useEffect } from 'react'
import { CardLocation, CardType } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import {
  isDefensePosition,
  resolveBattle,
  resolveDirectAttack,
  getLegalTargetIds
} from '../../utils/duelActionTargets'
import { Swords, Zap, ArrowDownToLine, Ban, Check, X, Crosshair, MapPin } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export const ActionIntentBar: React.FC = () => {
  const pendingAction = useDuelStore((s) => s.pendingAction)
  const pendingPlacement = useDuelStore((s) => s.pendingPlacement)
  const selectedCardId = useDuelStore((s) => s.selectedCardId)
  const cards = useDuelStore((s) => s.state.cards)
  const beginAction = useDuelStore((s) => s.beginAction)
  const beginPlacement = useDuelStore((s) => s.beginPlacement)
  const commitPendingAction = useDuelStore((s) => s.commitPendingAction)
  const cancelPendingAction = useDuelStore((s) => s.cancelPendingAction)
  const cancelPlacement = useDuelStore((s) => s.cancelPlacement)
  const setActionTargetPlayer = useDuelStore((s) => s.setActionTargetPlayer)
  const executeActivateCard = useDuelStore((s) => s.executeActivateCard)
  const executeSendToGrave = useDuelStore((s) => s.executeSendToGrave)
  const executeBanishCard = useDuelStore((s) => s.executeBanishCard)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const s = useDuelStore.getState()
        if (s.pendingAction) {
          e.preventDefault()
          s.cancelPendingAction()
        } else if (s.pendingPlacement) {
          e.preventDefault()
          s.cancelPlacement()
        }
      } else if (e.key === 'Enter') {
        const s = useDuelStore.getState()
        if (s.pendingAction) {
          e.preventDefault()
          s.commitPendingAction()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selectedCard = selectedCardId
    ? cards.find((c) => c.instanceId === selectedCardId)
    : undefined

  const sourceCard = pendingAction
    ? cards.find((c) => c.instanceId === pendingAction.sourceId)
    : undefined

  const preview = (() => {
    if (!pendingAction || !sourceCard || pendingAction.kind !== 'ATTACK') return null
    if (pendingAction.targetPlayer !== null) return resolveDirectAttack(sourceCard)
    const targetId = pendingAction.targetIds[0]
    if (!targetId) return null
    const target = cards.find((c) => c.instanceId === targetId)
    if (!target) return null
    return resolveBattle(sourceCard, target)
  })()

  const legalCount = pendingAction ? getLegalTargetIds(cards, pendingAction).length : 0
  const hasTarget =
    !!pendingAction && (pendingAction.targetIds.length > 0 || pendingAction.targetPlayer !== null)

  const canAttack =
    !!selectedCard &&
    selectedCard.location === CardLocation.MZONE &&
    !isDefensePosition(selectedCard.position)

  const isSelectedMonster =
    !!selectedCard &&
    selectedCard.location === CardLocation.HAND &&
    selectedCard.card !== undefined &&
    (selectedCard.card.type & CardType.MONSTER) !== 0

  if (!pendingAction && !pendingPlacement && !selectedCard) return null

  return (
    <div
      className={cn(
        'absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs shadow-lg',
        pendingAction
          ? 'border-amber-500/40 bg-popover'
          : pendingPlacement
            ? 'border-amber-400/60 bg-popover'
            : 'border-border bg-popover'
      )}
    >
      {pendingAction ? (
        <>
          <Crosshair className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="shrink-0 font-medium">
            【{pendingAction.sourceName}】{pendingAction.kind === 'ATTACK' ? '攻击' : '发动'}
          </span>
          {preview ? (
            <span className="min-w-0 truncate text-muted-foreground">
              {pendingAction.targetPlayer !== null
                ? `直接攻击 → 造成 ${preview.damage} 伤害`
                : `${preview.attackerAtk} vs ${preview.targetIsDefense ? '守备 ' : ''}${preview.targetValue} → ${
                    preview.destroyTarget
                      ? '战斗破坏对方怪兽'
                      : preview.destroyAttacker
                        ? '攻击怪兽被破坏'
                        : '未分胜负'
                  }${preview.damage > 0 ? `，${preview.damageRecipient === 0 ? '我方' : '对方'} -${preview.damage}` : ''}`}
            </span>
          ) : (
            <span className="shrink-0 text-muted-foreground">
              请选择目标（{legalCount} 个可选）
            </span>
          )}
          {pendingAction.kind === 'ATTACK' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => setActionTargetPlayer(pendingAction.sourceController === 0 ? 1 : 0)}
            >
              直接攻击
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={cancelPendingAction}
          >
            <X className="h-3 w-3" />
            取消
          </Button>
          <Button
            size="sm"
            disabled={!hasTarget}
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={commitPendingAction}
          >
            <Check className="h-3 w-3" />
            记录
          </Button>
        </>
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
            <X className="h-3 w-3" />
            取消
          </Button>
        </>
      ) : (
        <>
          <span className="shrink-0 max-w-32 truncate font-medium">
            {selectedCard?.card?.name || `卡片 ${selectedCard?.code}`}
          </span>
          {canAttack && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px] text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
              onClick={() => selectedCard && beginAction('ATTACK', selectedCard.instanceId)}
            >
              <Swords className="h-3 w-3" />
              攻击
            </Button>
          )}
          {selectedCard && selectedCard.location === CardLocation.HAND && isSelectedMonster && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => selectedCard && beginPlacement('SUMMON', selectedCard.instanceId)}
            >
              <Crosshair className="h-3 w-3" />
              召唤
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={() => {
              if (!selectedCard) return
              if (selectedCard.location === CardLocation.HAND) {
                beginPlacement('ACTIVATE', selectedCard.instanceId)
              } else {
                executeActivateCard(selectedCard.instanceId)
              }
            }}
          >
            <Zap className="h-3 w-3" />
            发动
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={() => selectedCard && executeSendToGrave(selectedCard.instanceId)}
          >
            <ArrowDownToLine className="h-3 w-3" />
            送墓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[11px]"
            onClick={() => selectedCard && executeBanishCard(selectedCard.instanceId)}
          >
            <Ban className="h-3 w-3" />
            除外
          </Button>
        </>
      )}
    </div>
  )
}
