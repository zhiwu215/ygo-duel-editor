import type { JSX } from 'react'
import {
  AGENT_MODEL_INPUTS,
  AGENT_MODEL_INPUT_LABELS,
  AgentProviderModelConfig
} from '@shared/index'
import { Checkbox } from '../../ui/checkbox'
import { MODEL_LABEL } from './modelSettingsStyles'

interface ModelInputTypesProps {
  model: AgentProviderModelConfig
  position: number
  disabled?: boolean
  onChange: (model: AgentProviderModelConfig) => void
}

export function ModelInputTypes({
  model,
  position,
  disabled,
  onChange
}: ModelInputTypesProps): JSX.Element {
  const selected = model.input ?? ['text']

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-label={`输入类型 ${position}`}>
      <legend className={MODEL_LABEL}>输入类型</legend>
      <div className="flex items-center gap-4">
        {AGENT_MODEL_INPUTS.map((input) => {
          const checked = selected.includes(input)
          return (
            <label
              key={input}
              className="flex cursor-pointer items-center gap-1.5 text-xs leading-[18px] text-foreground"
            >
              <Checkbox
                checked={checked}
                disabled={disabled || (selected.length === 1 && checked)}
                aria-label={AGENT_MODEL_INPUT_LABELS[input]}
                onCheckedChange={(next) => {
                  const inputs = AGENT_MODEL_INPUTS.filter((item) =>
                    item === input ? next : selected.includes(item)
                  )
                  onChange({ ...model, input: [...inputs] })
                }}
              />
              <span>{AGENT_MODEL_INPUT_LABELS[input]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
