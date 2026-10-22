import type { JSX } from 'react'
import { Check } from 'lucide-react'
import {
  AGENT_REASONING_EFFORT_LABELS,
  AgentReasoningEffort,
  AgentReasoningEfforts,
  agentReasoningLevels
} from '@shared/index'
import { PICKER_EMPTY, PICKER_OPTION } from './modelPickerStyles'

interface ModelPickerEffortListProps {
  efforts?: AgentReasoningEfforts
  value?: AgentReasoningEffort
  onPick: (effort: AgentReasoningEffort) => void
}

export function ModelPickerEffortList({
  efforts,
  value,
  onPick
}: ModelPickerEffortListProps): JSX.Element {
  const levels = agentReasoningLevels(efforts)

  if (levels.length === 0) {
    return <div className={PICKER_EMPTY}>当前模型未提供推理等级。</div>
  }

  return (
    <div className="flex flex-col py-0.5">
      {levels.map((level) => {
        const selected = level === value
        return (
          <button
            key={level}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => onPick(level)}
            className={PICKER_OPTION}
          >
            <span className="min-w-0 flex-1 truncate">{AGENT_REASONING_EFFORT_LABELS[level]}</span>
            {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
