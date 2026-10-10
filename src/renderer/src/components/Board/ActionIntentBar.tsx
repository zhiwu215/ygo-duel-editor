import React, { useEffect } from 'react'
import { CardLocation, CardType } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useRuleCheck } from '../../stores/useRuleCheckStore'
import { enginePromptUsesModal } from '../../utils/ruleCheck'
import {
  isDefensePosition,
  resolveBattle,
  resolveDirectAttack,
  getLegalTargetIds
} from '../../utils/duelActionTargets'
import {
  Swords,
  Zap,
  ArrowDownToLine,
  Ban,
  Check,
  X,
  Crosshair,
  MapPin,
  ShieldAlert,
  Sparkles,
  EyeOff
} from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export const ActionIntentBar: React.FC = () => {
  const pendingAction = useDuelStore((s) => s.pendingAction)
  const pendingPlacement = useDuelStore((s) => s.pendingPlacement)
  const pendingEngineSelect = useDuelStore((s) => s.pendingEngineSelect)
  const cancelEngineSelect = useDuelStore((s) => s.cancelEngineSelect)
  const confirmEngineSelect = useDuelStore((s) => s.confirmEngineSelect)
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
  const turnLog = useDuelStore((s) => s.turnLog)
  const rule = useRuleCheck()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const s = useDuelStore.getState()
        if (s.pendingEngineSelect) {
          if (s.pendingEngineSelect.prompt.canCancel) {
            e.preventDefault()
            s.cancelEngineSelect()
          }
          return
        }
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
    !isDefensePosition(selectedCard.position) &&
    rule.allows(selectedCard, 'ATTACK')

  const isSelectedMonster =
    !!selectedCard &&
    selectedCard.location === CardLocation.HAND &&
    selectedCard.card !== undefined &&
    (selectedCard.card.type & CardType.MONSTER) !== 0

  const showSummon =
    !!selectedCard &&
    selectedCard.location === CardLocation.HAND &&
    isSelectedMonster &&
    rule.allows(selectedCard, 'SUMMON')
  const showSpecialSummon =
    !!selectedCard &&
    selectedCard.location === CardLocation.HAND &&
    isSelectedMonster &&
    rule.allows(selectedCard, 'SP_SUMMON')
  const showSet =
    !!selectedCard &&
    selectedCard.location === CardLocation.HAND &&
    rule.allows(selectedCard, isSelectedMonster ? 'SET_MONSTER' : 'SET_SPELL')
  const showActivate = !!selectedCard && rule.allows(selectedCard, 'ACTIVATE')
  const showSendToGrave = !!selectedCard && rule.allows(selectedCard, 'TO_GRAVE')
  const showBanish = !!selectedCard && rule.allows(selectedCard, 'BANISH')

  if (!pendingAction && !pendingPlacement && !pendingEngineSelect && !selectedCard) return null
  if (pendingEngineSelect && enginePromptUsesModal(pendingEngineSelect.prompt)) return null

  const selectTargetCount =
    pendingEngineSelect && pendingEngineSelect.prompt.min === pendingEngineSelect.prompt.max
      ? String(pendingEngineSelect.prompt.min)
      : pendingEngineSelect
        ? `${pendingEngineSelect.prompt.min}~${pendingEngineSelect.prompt.max}`
        : ''

  const chainCardNames =
    pendingEngineSelect && pendingEngineSelect.prompt.kind === 'CHAIN'
      ? pendingEngineSelect.prompt.candidates.map(
          (c) =>
            cards.find((card) => card.code === c.code && card.controller === c.controller)?.card
              ?.name || String(c.code)
        )
      : []
  const chainUniqueNames = [...new Set(chainCardNames)]
  const chainEventName = (() => {
    if (!pendingEngineSelect || pendingEngineSelect.prompt.kind !== 'CHAIN') return ''
    const entry = turnLog.find((e) => e.id === pendingEngineSelect.logId)
    if (!entry) return ''
    if (
      pendingEngineSelect.prompt.candidates.length === 1 &&
      pendingEngineSelect.prompt.candidates[0].code === entry.action.code
    ) {
      return ''
    }
    const eventCard = cards.find((card) => card.code === entry.action.code)
    return eventCard?.card?.name || String(entry.action.code)
  })()
  const chainSelfEffect =
    !!pendingEngineSelect &&
    pendingEngineSelect.prompt.kind === 'CHAIN' &&
    pendingEngineSelect.prompt.candidates.length === 1 &&
    pendingEngineSelect.prompt.candidates[0].code ===
      turnLog.find((e) => e.id === pendingEngineSelect.logId)?.action.code
  const chainTitle =
    chainUniqueNames.length === 1
      ? `要发动【${chainUniqueNames[0]}】${chainSelfEffect ? '的效果' : ''}吗？`
      : chainUniqueNames.length > 1
        ? `要发动哪张卡？${chainUniqueNames.map((n) => `【${n}】`).join('')}`
        : '是否发动效果？'
  const chainPrefix = chainEventName ? `连锁【${chainEventName}】：` : ''

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
      {pendingEngineSelect ? (
        pendingEngineSelect.prompt.kind === 'POSITION' ? (
          <>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="shrink-0 font-medium">请选择表示形式</span>
            {[
              { bit: 0x1, label: '表侧攻击' },
              { bit: 0x4, label: '表侧守备' },
              { bit: 0x8, label: '里侧守备' },
              { bit: 0x2, label: '里侧攻击' }
            ]
              .filter((o) => ((pendingEngineSelect.prompt.positions ?? 0) & o.bit) !== 0)
              .map((o) => (
                <Button
                  key={o.bit}
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[11px]"
                  onClick={() => useDuelStore.getState().chooseEnginePosition(o.bit)}
                >
                  {o.label}
                </Button>
              ))}
          </>
        ) : (
          <>
            {pendingEngineSelect.prompt.kind === 'CHAIN' ? (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            )}
            <span className="shrink-0 font-medium">
              {pendingEngineSelect.prompt.kind === 'TRIBUTE'
                ? '请选择祭品'
                : pendingEngineSelect.prompt.kind === 'CHAIN'
                  ? `${chainPrefix}${chainTitle}`
                  : '请选择卡'}
            </span>
            {pendingEngineSelect.prompt.kind === 'CHAIN' ? (
              <span className="shrink-0 text-muted-foreground">
                点发光的卡连锁发动，不需要则选「不发动」
              </span>
            ) : (
              <span className="shrink-0 text-muted-foreground">
                {selectTargetCount} 张（点击手上/场上高亮的卡）
              </span>
            )}
            {pendingEngineSelect.chosen.length > 0 &&
              pendingEngineSelect.prompt.max > pendingEngineSelect.prompt.min && (
                <Button
                  size="sm"
                  disabled={pendingEngineSelect.chosen.length < pendingEngineSelect.prompt.min}
                  className="h-6 shrink-0 px-1.5 text-[11px]"
                  onClick={confirmEngineSelect}
                >
                  <Check className="h-3 w-3" />
                  确认（{pendingEngineSelect.chosen.length}）
                </Button>
              )}
            {pendingEngineSelect.prompt.canCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[11px]"
                onClick={cancelEngineSelect}
              >
                <X className="h-3 w-3" />
                {pendingEngineSelect.prompt.kind === 'CHAIN' ? '不发动' : '取消'}
              </Button>
            )}
          </>
        )
      ) : pendingAction ? (
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
                : pendingPlacement.mode === 'SP_SUMMON'
                  ? '特殊召唤'
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
          {rule.degraded && (
            <span
              className="flex shrink-0 items-center gap-1 text-amber-500"
              title={`规则校验受限：${rule.warnings.join('；')}`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
          )}
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
          {showSummon && (
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
          {showSpecialSummon && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => selectedCard && beginPlacement('SP_SUMMON', selectedCard.instanceId)}
            >
              <Sparkles className="h-3 w-3" />
              特殊召唤
            </Button>
          )}
          {showSet && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => selectedCard && beginPlacement('SET', selectedCard.instanceId)}
            >
              <EyeOff className="h-3 w-3" />
              盖放
            </Button>
          )}
          {showActivate && (
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
          )}
          {showSendToGrave && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => selectedCard && executeSendToGrave(selectedCard.instanceId)}
            >
              <ArrowDownToLine className="h-3 w-3" />
              送墓
            </Button>
          )}
          {showBanish && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-[11px]"
              onClick={() => selectedCard && executeBanishCard(selectedCard.instanceId)}
            >
              <Ban className="h-3 w-3" />
              除外
            </Button>
          )}
        </>
      )}
    </div>
  )
}
