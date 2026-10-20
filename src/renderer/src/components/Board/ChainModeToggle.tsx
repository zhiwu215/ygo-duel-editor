import React from 'react'
import { Check } from 'lucide-react'
import { TimingPolicy } from '@shared/index'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { ChainModeIcon } from './ChainIcons'

type ChainPolicy = TimingPolicy['chain']
type EffectYnPolicy = TimingPolicy['effectYn']

const CHAIN_MODES: { value: ChainPolicy; label: string; description: string }[] = [
  {
    value: 'smart',
    label: '智能连锁',
    description: '仅在关键时点询问（可选诱发、连锁结算中），其余窗口自动通过'
  },
  {
    value: 'available',
    label: '可用连锁',
    description: '只要有可连锁候选就停下询问'
  },
  {
    value: 'all',
    label: '全部连锁',
    description: '每个连锁窗口都停下询问，无候选也确认'
  },
  {
    value: 'ignore',
    label: '忽略连锁',
    description: '无强制效果时从不询问连锁'
  }
]

const EFFECT_YN_MODES: { value: EffectYnPolicy; label: string; description: string }[] = [
  {
    value: 'ask',
    label: '询问',
    description: '每次出现可选发动效果时由你决定'
  },
  {
    value: 'never',
    label: '不发动',
    description: '自动回答否，不影响强制效果与脚本确认'
  }
]

export const ChainModeToggle: React.FC = () => {
  const timingPolicy = useDuelEngineStore((s) => s.timingPolicy)
  const setTimingPolicy = useDuelEngineStore((s) => s.setTimingPolicy)
  const current = CHAIN_MODES.find((mode) => mode.value === timingPolicy.chain) ?? CHAIN_MODES[0]

  const update = (patch: Partial<TimingPolicy>): void => {
    setTimingPolicy({ ...timingPolicy, ...patch })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="xs" className="h-[24px] gap-1.5 px-2 text-[11px]" />
        }
        title={`时点策略：${current.label}`}
        aria-label={`时点策略：${current.label}`}
      >
        <ChainModeIcon mode={timingPolicy.chain} size={14} />
        <span className="hidden sm:inline">{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>连锁时点</DropdownMenuLabel>
          {CHAIN_MODES.map((mode) => (
            <DropdownMenuItem
              key={mode.value}
              title={mode.description}
              className="items-center gap-2"
              onClick={() => update({ chain: mode.value })}
            >
              <ChainModeIcon mode={mode.value} size={14} className="shrink-0" />
              <span className="text-xs font-semibold">{mode.label}</span>
              {timingPolicy.chain === mode.value ? (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>可选发动效果</DropdownMenuLabel>
          {EFFECT_YN_MODES.map((mode) => (
            <DropdownMenuItem
              key={mode.value}
              title={mode.description}
              className="items-center gap-2"
              onClick={() => update({ effectYn: mode.value })}
            >
              <span className="w-3.5 shrink-0" />
              <span className="text-xs font-semibold">{mode.label}</span>
              {timingPolicy.effectYn === mode.value ? (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
