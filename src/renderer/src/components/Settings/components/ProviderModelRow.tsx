import type { JSX } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import {
  AgentProviderModelConfig,
  DEFAULT_AGENT_CONTEXT_WINDOW,
  DEFAULT_AGENT_MAX_OUTPUT_TOKENS
} from '@shared/index'
import { Checkbox } from '../../ui/checkbox'
import { cn } from '../../../lib/utils'
import { formatModelCapacity } from '../../../utils/modelCapacity'
import { ModelInputTypes } from './ModelInputTypes'
import { ModelReasoningEfforts } from './ModelReasoningEfforts'
import {
  MODEL_DANGER_ICON_BUTTON,
  MODEL_ERROR,
  MODEL_HINT,
  MODEL_ICON_BUTTON,
  MODEL_INPUT,
  MODEL_LABEL
} from './modelSettingsStyles'

function withFlag(
  model: AgentProviderModelConfig,
  key: 'supportsStructuredOutput' | 'supportsMidConversationSystem',
  checked: boolean
): AgentProviderModelConfig {
  const next = { ...model }
  if (checked) next[key] = true
  else Reflect.deleteProperty(next, key)
  return next
}

interface ProviderModelRowProps {
  model: AgentProviderModelConfig
  position: number
  expanded: boolean
  contextWindowText: string
  maxTokensText: string
  capacityError?: string
  onToggle: () => void
  onRemove: () => void
  onFieldChange: (field: 'id' | 'name', value: string | undefined) => void
  onCapacityChange: (field: 'contextWindow' | 'maxTokens', value: string) => void
  onChange: (model: AgentProviderModelConfig) => void
}

export function ProviderModelRow({
  model,
  position,
  expanded,
  contextWindowText,
  maxTokensText,
  capacityError,
  onToggle,
  onRemove,
  onFieldChange,
  onCapacityChange,
  onChange
}: ProviderModelRowProps): JSX.Element {
  return (
    <div className="rounded-[16px] border-[0.5px] border-foreground/20">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-1.5 p-1.5">
        <input
          value={model.id}
          onChange={(event) => onFieldChange('id', event.target.value)}
          placeholder="模型 ID"
          aria-label={`模型 ID ${position}`}
          spellCheck={false}
          autoFocus={model.id.length === 0}
          className={MODEL_INPUT}
        />
        <input
          value={model.name ?? ''}
          onChange={(event) => onFieldChange('name', event.target.value || undefined)}
          placeholder="显示名称"
          aria-label={`显示名称 ${position}`}
          className={MODEL_INPUT}
        />
        <button
          type="button"
          aria-label={`模型选项 ${position}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className={MODEL_ICON_BUTTON}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label={`删除模型 ${position}`}
          onClick={onRemove}
          className={MODEL_DANGER_ICON_BUTTON}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t-[0.5px] border-foreground/10 p-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className={MODEL_LABEL}>上下文窗口</span>
              <input
                type="text"
                inputMode="numeric"
                value={contextWindowText}
                placeholder={formatModelCapacity(DEFAULT_AGENT_CONTEXT_WINDOW)}
                aria-label={`上下文窗口 ${position}`}
                aria-invalid={capacityError !== undefined}
                onChange={(event) => onCapacityChange('contextWindow', event.target.value)}
                className={cn(MODEL_INPUT, 'h-7 px-2 text-xs')}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={MODEL_LABEL}>最大输出 token 数</span>
              <input
                type="text"
                inputMode="numeric"
                value={maxTokensText}
                placeholder={formatModelCapacity(DEFAULT_AGENT_MAX_OUTPUT_TOKENS)}
                aria-label={`最大输出 token 数 ${position}`}
                aria-invalid={capacityError !== undefined}
                onChange={(event) => onCapacityChange('maxTokens', event.target.value)}
                className={cn(MODEL_INPUT, 'h-7 px-2 text-xs')}
              />
            </label>
          </div>
          {capacityError ? <p className={MODEL_ERROR}>{capacityError}</p> : null}

          <ModelInputTypes model={model} position={position} onChange={onChange} />
          <ModelReasoningEfforts model={model} position={position} onChange={onChange} />

          <fieldset className="flex min-w-0 flex-col gap-1.5" aria-label={`兼容性 ${position}`}>
            <legend className={MODEL_LABEL}>兼容性</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs leading-[18px] text-foreground">
                <Checkbox
                  checked={Boolean(model.supportsStructuredOutput)}
                  aria-label="结构化输出"
                  onCheckedChange={(checked) =>
                    onChange(withFlag(model, 'supportsStructuredOutput', checked))
                  }
                />
                <span>结构化输出</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs leading-[18px] text-foreground">
                <Checkbox
                  checked={Boolean(model.supportsMidConversationSystem)}
                  aria-label="对话中系统消息"
                  onCheckedChange={(checked) =>
                    onChange(withFlag(model, 'supportsMidConversationSystem', checked))
                  }
                />
                <span>对话中系统消息</span>
              </label>
            </div>
            <p className={MODEL_HINT}>仅在提供商支持对应能力时开启。</p>
          </fieldset>
        </div>
      )}
    </div>
  )
}
