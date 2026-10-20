import React, { useMemo, useState } from 'react'
import { ATTRIBUTE_NAMES, CdbCard, RACE_NAMES } from '@shared/index'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { AnnounceCardPicker } from './AnnounceCardPicker'
import { AnnounceMaskPicker } from './AnnounceMaskPicker'
import { AnnounceNumberPicker } from './AnnounceNumberPicker'
import { DataOf, submitAnswer } from './engine'

const ANNOUNCE_REQUIRED = 1

export const AnnounceModal: React.FC<{ request: EngineRequest; data: DataOf<'announce'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)

  const [mask, setMask] = useState(0)
  const [number, setNumber] = useState<number | null>(null)
  const [pickedCard, setPickedCard] = useState<CdbCard | null>(null)

  const requiredCount = Math.max(data.count || 0, ANNOUNCE_REQUIRED)

  const maskOptions = useMemo(() => {
    if (data.announceType !== 'race' && data.announceType !== 'attrib') return []
    const table = data.announceType === 'race' ? RACE_NAMES : ATTRIBUTE_NAMES
    const available = data.availableMask ?? 0
    return Object.entries(table)
      .map(([bit, label]) => ({ value: Number(bit), label }))
      .filter((entry) => available === 0 || (available & entry.value) !== 0)
  }, [data.announceType, data.availableMask])

  const selectedMaskOptions = maskOptions.filter((entry) => (mask & entry.value) !== 0)

  const toggleMask = (value: number): void => {
    setMask((current) => {
      if ((current & value) !== 0) return current & ~value
      const selectedCount = maskOptions.filter((entry) => (current & entry.value) !== 0).length
      if (selectedCount >= requiredCount) return current
      return current | value
    })
  }

  let canConfirm = false
  let announceValue = 0
  if (data.announceType === 'race' || data.announceType === 'attrib') {
    canConfirm = selectedMaskOptions.length === requiredCount
    announceValue = mask
  } else if (data.announceType === 'number') {
    canConfirm = number !== null
    announceValue = number ?? 0
  } else {
    canConfirm = pickedCard !== null
    announceValue = pickedCard?.id ?? 0
  }

  const confirmLabel =
    data.announceType === 'race'
      ? '宣言种族'
      : data.announceType === 'attrib'
        ? '宣言属性'
        : data.announceType === 'number'
          ? `宣言 ${number ?? ''}`
          : `宣言 ${pickedCard?.name ?? ''}`

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width={data.announceType === 'card' ? 'max-w-2xl' : 'max-w-lg'}
      footer={
        <Button size="sm" disabled={loading || !canConfirm} onClick={() => submitAnswer({ kind: 'announce', value: announceValue })}>
          {confirmLabel}
        </Button>
      }
    >
      {(data.announceType === 'race' || data.announceType === 'attrib') && (
        <AnnounceMaskPicker
          options={maskOptions}
          requiredCount={requiredCount}
          selectedMask={mask}
          onToggle={toggleMask}
          loading={loading}
        />
      )}

      {data.announceType === 'number' && (
        <AnnounceNumberPicker numbers={data.numbers ?? []} value={number} onSelect={setNumber} />
      )}

      {data.announceType === 'card' && (
        <AnnounceCardPicker
          requiredCount={requiredCount}
          pickedCard={pickedCard}
          onPick={setPickedCard}
        />
      )}
    </RequestModalShell>
  )
}
