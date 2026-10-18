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
    value: 'available',
    label: '自动时点',
    description: '有卡可连锁时才询问，无卡可连时自动放弃'
  },
  {
    value: 'all',
    label: '全部时点',
    description: '每个连锁时点都停下询问（含无卡可连）'
  },
  {
    value: 'ignore',
    label: '忽略时点',
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
      <DropdownMenuContent side="top" align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>连锁时点</DropdownMenuLabel>
          {CHAIN_MODES.map((mode) => (
            <DropdownMenuItem
              key={mode.value}
              className="items-start gap-2"
              onClick={() => update({ chain: mode.value })}
            >
              <ChainModeIcon mode={mode.value} size={14} className="mt-0.5 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold">{mode.label}</span>
                <span className="text-[10px] leading-snug text-muted-foreground">
                  {mode.description}
                </span>
              </span>
              {timingPolicy.chain === mode.value ? (
                <Check className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
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
              className="items-start gap-2"
              onClick={() => update({ effectYn: mode.value })}
            >
              <span className="mt-0.5 w-3.5 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold">{mode.label}</span>
                <span className="text-[10px] leading-snug text-muted-foreground">
                  {mode.description}
                </span>
              </span>
              {timingPolicy.effectYn === mode.value ? (
                <Check className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
