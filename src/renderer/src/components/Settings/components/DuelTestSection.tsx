import { type JSX } from 'react'
import { DEFAULT_DUEL_TEST_SETTINGS, DuelTestDeckOrder } from '@shared/index'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Button } from '../../ui/button'
import { SettingsRow } from './SettingsRow'
import { cn } from '../../../lib/utils'

interface Choice<T extends string> {
  value: T
  label: string
}

interface ChoiceGroupProps<T extends string> {
  value: T
  choices: Choice<T>[]
  onChange: (value: T) => void
}

function ChoiceGroup<T extends string>({
  value,
  choices,
  onChange
}: ChoiceGroupProps<T>): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {choices.map((choice) => (
        <Button
          key={choice.value}
          size="xs"
          variant={choice.value === value ? 'default' : 'outline'}
          className={cn('h-7 px-3 text-xs', choice.value === value && 'shadow-xs')}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  )
}

const DECK_ORDER_CHOICES: Choice<DuelTestDeckOrder>[] = [
  { value: 'fixed', label: '固定牌序' },
  { value: 'random', label: '随机洗牌' }
]

export function DuelTestSection(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const setDuelTestSettings = useConfigStore((state) => state.setDuelTestSettings)
  const settings = config.duelTestSettings ?? DEFAULT_DUEL_TEST_SETTINGS

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <div className="px-5 py-3 text-xs text-muted-foreground border-b border-border/60">
        你一人直接操作双方（上帝视角）：双方手牌与场面都会展示。
      </div>

      <SettingsRow
        title="牌序"
        description="固定牌序：手牌与卡组都按编排生效，对局内洗牌也不打乱；随机洗牌：忽略手牌区，卡组洗牌后开局抽 5 张"
      >
        <ChoiceGroup
          value={settings.deckOrder}
          choices={DECK_ORDER_CHOICES}
          onChange={(deckOrder) => void setDuelTestSettings({ deckOrder })}
        />
      </SettingsRow>
    </section>
  )
}
