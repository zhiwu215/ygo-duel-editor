/**
 * S3 · 选卡底部条 / unselect 弹窗（取代 UnselectCardPanel）。
 *
 * 呈现规则完全由 deriveSelection 决定：
 *   - point 模式：底部操作条（进度 + 已选卡名 + 取消/确认/完成），点卡选择交给 CardItem
 *   - modal 模式：card/tribute/sum 让位给 DuelRequestModals 的弹窗；
 *     unselect 因弹窗不在分发层内，这里保留原「卡图列表弹窗」（逐张提交）
 */
import React, { useMemo } from 'react'
import { FieldCard } from '@shared/index'
import type { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import {
  cancelSelection,
  deriveSelection,
  requestCardKey,
  submitSelection,
  type DerivedSelection
} from '../../utils/duelSelection'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { findCardName, resolveCardName } from '../../utils/cardNames'
import { Button } from '../ui/button'
import { Check, X } from 'lucide-react'

function requestCardName(cards: FieldCard[], requestCard: RequestCard): string {
  const exact = cards.find(
    (card) =>
      card.controller === requestCard.controller &&
      card.location === requestCard.location &&
      card.sequence === requestCard.sequence
  )
  return exact?.card?.name || resolveCardName(requestCard.code)
}

// ------------------------------------------------------------------ unselect 弹窗（含牌堆候选）

const UnselectCardModal: React.FC<{
  request: EngineRequest
  derived: DerivedSelection
  loading: boolean
  cards: FieldCard[]
}> = ({ request, derived, loading, cards }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
    <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">{request.title}</h2>
        <span className="text-[11px] text-muted-foreground">
          {derived.canFinish ? '逐张点击选择，完成后点「完成」' : '请选择一张卡'}
        </span>
      </div>

      <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto p-3">
        {derived.candidates.map((card, index) => (
          <button
            key={`sel-${index}-${requestCardKey(card)}`}
            type="button"
            disabled={loading}
            onClick={() => submitSelection(derived, [card])}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-background/60 p-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
          >
            <img
              src={getCardImageUrl(card.code, true)}
              alt={requestCardName(cards, card)}
              className="h-11 w-8 shrink-0 rounded-sm border border-border/60 object-cover"
              onError={(e) => {
                if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                  e.currentTarget.src = UNKNOWN_CARD_IMAGE
                }
              }}
            />
            <span className="truncate text-xs font-semibold text-foreground">
              {requestCardName(cards, card)}
            </span>
          </button>
        ))}

        {derived.selected.length > 0 && (
          <>
            <div className="mt-1.5 text-[10px] font-bold text-muted-foreground/80">
              已选（点击可取消选择）
            </div>
            {derived.selected.map((card, index) => (
              <button
                key={`unsel-${index}-${requestCardKey(card)}`}
                type="button"
                disabled={loading}
                onClick={() => submitSelection(derived, [card])}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 p-1.5 text-left transition-colors hover:bg-primary/15"
              >
                <img
                  src={getCardImageUrl(card.code, true)}
                  alt={requestCardName(cards, card)}
                  className="h-11 w-8 shrink-0 rounded-sm border border-border/60 object-cover"
                  onError={(e) => {
                    if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                      e.currentTarget.src = UNKNOWN_CARD_IMAGE
                    }
                  }}
                />
                <span className="truncate text-xs font-semibold text-foreground">
                  {requestCardName(cards, card)}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-3 py-2">
        {derived.canCancel && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => cancelSelection(derived)}
          >
            <X />
            取消
          </Button>
        )}
        {derived.canFinish && (
          <Button size="sm" disabled={loading} onClick={() => submitSelection(derived, [])}>
            <Check />
            完成
          </Button>
        )}
      </div>
    </div>
  </div>
)

// ------------------------------------------------------------------ 底部操作条

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
    return <UnselectCardModal request={request} derived={derived} loading={loading} cards={cards} />
  }

  const isUnselect = derived.kind === 'unselect'
  // S4：攻击目标选择（descHint 549）——点一只对方怪兽即确定目标，取消 = 撤销攻击宣言
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
