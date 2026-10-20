import React, { useMemo } from 'react'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import {
  cancelSelection,
  deriveSelection,
  requestCardKey,
  submitSelection
} from '../../utils/duelSelection'
import { findCardName } from '../../utils/cardNames'
import { UnselectCardModal } from './request-modals/UnselectCardModal'
import { requestCardName } from '../../utils/duelSelection'
import { Button } from '../ui/button'
import { Check, X } from 'lucide-react'

export const DuelSelectionBar: React.FC = () => {
  const request = useDuelEngineStore((s) => s.pendingRequest)
  const loading = useDuelEngineStore((s) => s.loading)
  const lastAttacker = useDuelEngineStore((s) => s.lastAttacker)
  const cards = useDuelStore((s) => s.state.cards)
  const selectedKeys = useSelectionStore((s) => s.selectedKeys)

  const derived = useMemo(() => deriveSelection(request), [request])

  if (!request || !derived) return null

  if (derived.mode === 'modal') {
    if (derived.kind !== 'unselect') return null
    return <UnselectCardModal derived={derived} loading={loading} cards={cards} />
  }

  const isUnselect = derived.kind === 'unselect'
  const isAttackTarget = derived.attackTarget === true
  const isSingleAttackTarget = isAttackTarget && derived.min === 1 && derived.max === 1
  const attackerName = lastAttacker ? findCardName(lastAttacker.code) : null
  const attackTargetHint = attackerName ? `选择【${attackerName}】的攻击对象` : '选择攻击对象'
  const selected = isUnselect
    ? derived.selected
    : derived.candidates.filter((card) => selectedKeys.includes(requestCardKey(card)))
  const range = derived.min === derived.max ? `${derived.max}` : `${derived.min}~${derived.max}`
  const canConfirm = !isUnselect && selected.length >= derived.min && selected.length <= derived.max

  let hint: string
  if (isAttackTarget) {
    hint = attackTargetHint
  } else if (isUnselect) {
    hint =
      selected.length > 0
        ? `已选 ${selected.length} 张${derived.canFinish ? ' — 点「完成」确认' : ''}`
        : '请点击场上 / 手牌中的卡片进行选择'
  } else if (selected.length > 0) {
    hint = `选择中 · 已选 ${selected.length} / ${range} 张`
  } else {
    hint = `请点击场上 / 手牌中的卡片进行选择（需要 ${range} 张）`
  }

  return (
    <div className="fixed bottom-[172px] left-1/2 z-[60] flex max-w-[720px] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-2 shadow-2xl backdrop-blur select-none">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold text-foreground">{hint}</span>
        {isAttackTarget && isSingleAttackTarget && (
          <span className="text-[11px] text-muted-foreground">点击对方场上的怪兽确定攻击对象</span>
        )}
        {selected.length > 0 && (
          <span className="max-w-[320px] truncate text-[11px] text-muted-foreground">
            {selected.map((card) => requestCardName(cards, card)).join('、')}
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {derived.canCancel && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => cancelSelection(derived)}
          >
            <X />
            {isAttackTarget ? '取消攻击' : '取消'}
          </Button>
        )}
        {isUnselect ? (
          derived.canFinish && (
            <Button size="sm" disabled={loading} onClick={() => submitSelection(derived, [])}>
              <Check />
              完成
            </Button>
          )
        ) : isSingleAttackTarget ? null : (
          <Button
            size="sm"
            disabled={loading || !canConfirm}
            onClick={() => submitSelection(derived, selected)}
          >
            <Check />
            {derived.kind === 'tribute' ? '确认解放' : '确认'}
          </Button>
        )}
      </div>
    </div>
  )
}
