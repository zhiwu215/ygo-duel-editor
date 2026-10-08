import React from 'react'
import { EngineChainMode } from '@shared/index'
import { useConfigStore } from '../../stores/useConfigStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { cn } from '../../lib/utils'

const MODES: { value: EngineChainMode; label: string; title: string }[] = [
  {
    value: 'auto',
    label: '自动时点',
    title: '默认：只在有触发类效果可以发动时询问（与 ygopro 默认一致）'
  },
  {
    value: 'always',
    label: '全部时点',
    title: '只要手上有可以连锁的卡就询问（等同 ygopro「显示时点」）'
  },
  {
    value: 'ignore',
    label: '忽略时点',
    title: '除了必发效果和召唤/特殊召唤之际的触发时点，一律不询问（等同 ygopro「忽略时点」）'
  }
]

export const ChainModeToggle: React.FC = () => {
  const enabled = useConfigStore((s) => s.config.ruleCheckEnabled !== false)
  const chainMode = useDuelStore((s) => s.chainMode)
  const setChainMode = useDuelStore((s) => s.setChainMode)
  if (!enabled) return null
  return (
    <div className="absolute left-2 top-2 z-40 flex flex-col gap-0.5 rounded-lg border border-border bg-popover px-1.5 py-1.5 text-[11px] shadow-lg select-none">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          title={m.title}
          onClick={() => setChainMode(m.value)}
          className={cn(
            'rounded px-2 py-1 text-left transition-colors cursor-pointer',
            chainMode === m.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
