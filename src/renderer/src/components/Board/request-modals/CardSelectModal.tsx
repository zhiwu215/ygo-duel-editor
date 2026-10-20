import React, { useMemo } from 'react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { useSelectionStore } from '../../../stores/useSelectionStore'
import {
  cancelSelection,
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

export const CardSelectModal: React.FC<{
  request: EngineRequest
  data: DataOf<'card'> | DataOf<'tribute'>
}> = ({ request, data }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
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
  const unit = data.kind === 'tribute' ? '只' : '张'
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])

  const submit = (): void => {
    if (derived && derived.kind !== 'unselect') submitSelection(derived, selectedCards)
  }

  const cancel = (): void => {
    if (derived) cancelSelection(derived)
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? `请选择 ${min === max ? min : `${min}~${max}`} ${unit}`}
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已选 {selectedCards.length} / {min === max ? min : `${min}~${max}`} {unit}
          </span>
          {data.cancelable && (
            <Button variant="outline" size="sm" disabled={loading} onClick={cancel}>
              取消
            </Button>
          )}
          <Button size="sm" disabled={loading || !ready} onClick={submit}>
            {data.kind === 'tribute' ? '确认解放' : '确认'}
          </Button>
        </>
      }
    >
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
        {data.cards.length === 0 && (
          <p className="w-full py-8 text-center text-xs text-muted-foreground">没有可选择的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}
