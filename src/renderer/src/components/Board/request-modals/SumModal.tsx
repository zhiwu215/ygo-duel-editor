import React, { useMemo } from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { useSelectionStore } from '../../../stores/useSelectionStore'
import {
  deriveSelection,
  pickSelected,
  requestCardKey,
  submitSelection
} from '../../../utils/duelSelection'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { RequestCardTile } from './RequestCardTile'
import { DataOf } from './engine'
import { useCardMeta } from './useCardMeta'

export const SumModal: React.FC<{ request: EngineRequest; data: DataOf<'sum'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const allCards = useMemo(() => [...data.mustSelect, ...data.cards], [data.mustSelect, data.cards])
  const meta = useCardMeta(allCards)
  const selectedKeys = useSelectionStore((s) => s.selectedKeys)
  const toggleSelected = useSelectionStore((s) => s.toggle)
  const derived = useMemo(() => deriveSelection(request), [request])

  const {
    selected: selectedCards,
    min,
    max,
    ready
  } = useMemo(
    () => pickSelected(data.cards, selectedKeys, data.min, data.max),
    [data.cards, selectedKeys, data.min, data.max]
  )
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedSum = selectedCards.reduce((sum, card) => sum + (card.opParam ?? 0), 0)
  const mustSum = data.mustSelect.reduce((sum, card) => sum + (card.opParam ?? 0), 0)
  const hasOpParam = allCards.some((card) => card.opParam !== undefined)

  const submit = (): void => {
    if (derived) submitSelection(derived, selectedCards)
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width="max-w-2xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已选 {selectedCards.length} / {min === max ? min : `${min}~${max}`} 张
            {hasOpParam && ` · 合计 ${mustSum + selectedSum} / 目标 ${data.sumVal}`}
          </span>
          <Button size="sm" disabled={loading || !ready} onClick={submit}>
            确认
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {data.mustSelect.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground">必定选择</span>
            <div className="flex flex-wrap gap-2">
              {data.mustSelect.map((card, index) => (
                <RequestCardTile
                  key={`must-${index}-${card.code}`}
                  card={card}
                  meta={meta}
                  badge="必选"
                  selected
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {data.cards.map((card, index) => (
            <RequestCardTile
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
              card={card}
              meta={meta}
              selected={selectedKeySet.has(requestCardKey(card))}
              disabled={loading}
              onClick={() => toggleSelected(card)}
            />
          ))}
        </div>
        {data.cards.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">没有可选择的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}
