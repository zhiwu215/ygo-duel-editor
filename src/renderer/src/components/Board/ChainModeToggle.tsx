import React from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { TimingPolicy } from '@shared/index'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { ChainAllIcon, ChainBrokenIcon, ChainSmartIcon, ChainAvailableIcon } from './ChainIcons'

type ChainPolicy = TimingPolicy['chain']

interface ChainModeOption {
  value: ChainPolicy
  label: string
  icon: LucideIcon
}

const SMART_CHAIN_MODE: ChainModeOption = {
  value: 'smart',
  label: '智能连锁',
  icon: ChainSmartIcon
}

const CHAIN_MODES: ChainModeOption[] = [
  {
    value: 'all',
    label: '全部连锁',
    icon: ChainAllIcon
  },
  {
    value: 'ignore',
    label: '忽略连锁',
    icon: ChainBrokenIcon
  },
  SMART_CHAIN_MODE,
  {
    value: 'available',
    label: '可用连锁',
    icon: ChainAvailableIcon
  }
]

export const ChainModeToggle: React.FC = () => {
  const timingPolicy = useDuelEngineStore((s) => s.timingPolicy)
  const setTimingPolicy = useDuelEngineStore((s) => s.setTimingPolicy)
  const current = CHAIN_MODES.find((mode) => mode.value === timingPolicy.chain) ?? SMART_CHAIN_MODE

  const update = (chain: ChainPolicy): void => {
    setTimingPolicy({ ...timingPolicy, chain })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="h-7 px-2.5 text-[11px] font-medium gap-1 bg-background/60 text-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer"
          />
        }
        aria-label={`时点策略：${current.label}`}
      >
        <span>{current.label}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-36 p-1">
        {CHAIN_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <DropdownMenuItem
              key={mode.value}
              className="items-center gap-2 cursor-pointer"
              onClick={() => update(mode.value)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium">{mode.label}</span>
              {timingPolicy.chain === mode.value ? (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
