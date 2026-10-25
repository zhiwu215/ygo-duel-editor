import React, { useEffect } from 'react'
import {
  CardLocation,
  CardPosition,
  FIELD_ZONE_SEQUENCE,
  InjectCommand,
  LOCATION_NAMES
} from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { useEngineInjectDropStore } from '../../../stores/useEngineInjectDropStore'
import { buildInjectCommand } from '../../../utils/engineInject'
import { Button } from '../../ui/button'

interface DropChoice {
  label: string
  position?: number
  to?: Extract<InjectCommand, { op: 'add-card' }>['to']
}

function choicesFor(location: number, sequence: number): { label: string; choices: DropChoice[] } {
  if (location === CardLocation.MZONE) {
    return {
      label: '放置到怪兽区',
      choices: [
        { label: '表侧攻击', position: CardPosition.FACEUP_ATTACK },
        { label: '表侧守备', position: CardPosition.FACEUP_DEFENSE },
        { label: '里侧守备', position: CardPosition.FACEDOWN_DEFENSE }
      ]
    }
  }
  if (location === CardLocation.EXTRA) {
    return {
      label: '加入额外卡组',
      choices: [
        { label: '里侧', position: CardPosition.FACEDOWN_DEFENSE },
        { label: '表侧', position: CardPosition.FACEUP }
      ]
    }
  }
  if (location === CardLocation.DECK) {
    return {
      label: '加入卡组',
      choices: [
        { label: '卡组顶', to: 'deck-top' },
        { label: '卡组底', to: 'deck-bottom' }
      ]
    }
  }
  if (location === CardLocation.HAND) {
    return { label: '加入手牌', choices: [{ label: '加入手牌', to: 'hand' }] }
  }
  if (location === CardLocation.GRAVE) {
    return { label: '加入墓地', choices: [{ label: '加入墓地', to: 'grave-top' }] }
  }
  if (location === CardLocation.REMOVED) {
    return { label: '除外', choices: [{ label: '除外', to: 'removed' }] }
  }
  if (
    location === CardLocation.FZONE ||
    (location === CardLocation.SZONE && sequence === FIELD_ZONE_SEQUENCE)
  ) {
    return {
      label: '放置到场地魔法区',
      choices: [
        { label: '表侧', position: CardPosition.FACEUP },
        { label: '里侧', position: CardPosition.FACEDOWN }
      ]
    }
  }
  return {
    label: '放置到魔陷区',
    choices: [
      { label: '里侧', position: CardPosition.FACEDOWN },
      { label: '表侧', position: CardPosition.FACEUP }
    ]
  }
}

export const EngineInjectDropDialog: React.FC = () => {
  const target = useEngineInjectDropStore((s) => s.pending)
  const cancel = useEngineInjectDropStore((s) => s.cancel)
  const inject = useDuelEngineStore((s) => s.inject)
  const loading = useDuelEngineStore((s) => s.loading)
  const masterRule = useDuelStore((s) => s.state.masterRule)

  useEffect(() => {
    if (!target) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [target, cancel])

  useEffect(
    () =>
      useDuelEngineStore.subscribe((state) => {
        if (!state.isInitialized) cancel()
      }),
    [cancel]
  )

  if (!target) return null

  const { label, choices } = choicesFor(target.location, target.sequence)

  const choose = async (choice: DropChoice): Promise<void> => {
    if (loading) return
    cancel()
    if (choice.to) {
      await inject({
        op: 'add-card',
        player: target.controller,
        code: target.card.id,
        to: choice.to
      })
      return
    }
    const command = buildInjectCommand({
      card: target.card,
      controller: target.controller,
      location: target.location,
      sequence: target.sequence,
      ctrlKey: false,
      masterRule,
      position: choice.position
    })
    if (command) await inject(command)
  }

  return (
    <div
      className="fixed inset-0 z-[46] flex items-center justify-center bg-black/40 p-4"
      onClick={cancel}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold">放置「{target.card.name}」</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {label} · {LOCATION_NAMES[target.location] ?? ''}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          {choices.map((choice) => (
            <Button
              key={choice.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void choose(choice)}
              className="h-8 justify-start px-3 text-xs"
            >
              {choice.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="h-8 px-3 text-xs"
          >
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}
