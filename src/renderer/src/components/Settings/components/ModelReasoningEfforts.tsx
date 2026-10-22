import { useState, type JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  AGENT_REASONING_EFFORTS,
  AgentProviderModelConfig,
  AgentReasoningEffort,
  AgentReasoningEfforts,
  agentReasoningLevels
} from '@shared/index'
import { Switch } from '../../ui/switch'
import { cn } from '../../../lib/utils'
import {
  MODEL_DANGER_ICON_BUTTON,
  MODEL_ERROR,
  MODEL_HINT,
  MODEL_INPUT,
  MODEL_LABEL,
  MODEL_SELECT,
  MODEL_SMALL_ADD_BUTTON
} from './modelSettingsStyles'

const INITIAL_LEVELS: AgentReasoningEffort[] = ['off', 'low', 'medium', 'high']

const REASONING_HELP =
  'API 参数值会写入请求的推理强度字段，默认与档位名相同；如有不同，以模型提供商的 API 文档为准。Off 表示关闭思考，不需要填写参数值。'

type Entry = readonly [AgentReasoningEffort, string | null]

function defaultValue(level: AgentReasoningEffort): string | null {
  return level === 'off' ? null : level
}

function acceptedValue(level: AgentReasoningEffort, wire: string | null | undefined): boolean {
  if (level === 'off') return true
  return typeof wire === 'string' && wire.trim().length > 0
}

function readEntries(efforts: AgentReasoningEfforts | undefined): Entry[] {
  return agentReasoningLevels(efforts).map((level) => [level, efforts?.[level] ?? null] as const)
}

function effortsOf(entries: Entry[]): AgentReasoningEfforts {
  return Object.fromEntries(entries) as AgentReasoningEfforts
}

function replaceAt(entries: Entry[], index: number, entry: Entry): Entry[] {
  return entries.map((existing, at) => (at === index ? entry : existing))
}

function withEfforts(
  model: AgentProviderModelConfig,
  efforts: AgentReasoningEfforts | undefined
): AgentProviderModelConfig {
  const next = { ...model }
  if (efforts === undefined) {
    Reflect.deleteProperty(next, 'reasoningEfforts')
  } else {
    next.reasoningEfforts = efforts
  }
  return next
}

interface ModelReasoningEffortsProps {
  model: AgentProviderModelConfig
  position: number
  disabled?: boolean
  onChange: (model: AgentProviderModelConfig) => void
}

export function ModelReasoningEfforts({
  model,
  position,
  disabled,
  onChange
}: ModelReasoningEffortsProps): JSX.Element {
  const efforts = model.reasoningEfforts
  const entries = readEntries(efforts)
  const levels = entries.map(([level]) => level)
  const [typing, setTyping] = useState<{ level: AgentReasoningEffort; text: string }>()
  const label = `推理等级 ${position}`

  const write = (next: Entry[] | undefined): void => {
    onChange(withEfforts(model, next === undefined ? undefined : effortsOf(next)))
  }

  const changeLevel = (
    index: number,
    from: AgentReasoningEffort,
    wire: string | null,
    to: AgentReasoningEffort
  ): void => {
    const carried =
      typeof wire === 'string' && wire.length > 0 && wire !== from && from !== 'off' && to !== 'off'
    write(replaceAt(entries, index, [to, carried ? wire : defaultValue(to)]))
  }

  const addLevel = (): void => {
    const highest = Math.max(-1, ...levels.map((level) => AGENT_REASONING_EFFORTS.indexOf(level)))
    const level =
      AGENT_REASONING_EFFORTS.find(
        (candidate, index) => index > highest && !levels.includes(candidate)
      ) ?? AGENT_REASONING_EFFORTS.find((candidate) => !levels.includes(candidate))
    if (level === undefined) return
    write([...entries, [level, defaultValue(level)]])
  }

  const editValue = (index: number, level: AgentReasoningEffort, text: string): void => {
    setTyping({ level, text })
    const trimmed = text.trim()
    write(replaceAt(entries, index, [level, trimmed.length === 0 ? defaultValue(level) : trimmed]))
  }

  const leaveValue = (index: number, level: AgentReasoningEffort, wire: string | null): void => {
    setTyping(undefined)
    if (!acceptedValue(level, wire)) write(replaceAt(entries, index, [level, defaultValue(level)]))
  }

  const choicesFor = (level: AgentReasoningEffort): AgentReasoningEffort[] =>
    AGENT_REASONING_EFFORTS.filter((choice) => choice === level || !levels.includes(choice))

  const refused = entries.some(([level, wire]) => !acceptedValue(level, wire))
  const missingLevel = !levels.some((level) => level !== 'off')

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <span className={MODEL_LABEL}>推理等级</span>
          <button
            type="button"
            title={REASONING_HELP}
            aria-label="推理等级说明"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border-[0.5px] border-foreground/20 text-[9px] leading-none text-[#81858c] transition-colors hover:text-foreground dark:text-[#979da6]"
          >
            ?
          </button>
        </span>
        <Switch
          checked={efforts !== undefined}
          aria-label={label}
          onCheckedChange={(checked) => {
            if (!checked) {
              write(undefined)
              return
            }
            write(INITIAL_LEVELS.map((level) => [level, defaultValue(level)] as const))
          }}
        />
      </div>

      {efforts !== undefined && (
        <div className="flex flex-col gap-1.5">
          {entries.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-1.5">
              <span className="text-[11px] leading-4 text-[#81858c] dark:text-[#979da6]">档位</span>
              <span className="text-[11px] leading-4 text-[#81858c] dark:text-[#979da6]">
                API 参数值
              </span>
            </div>
          )}
          {entries.map(([level, wire], index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-1.5"
            >
              <select
                value={level}
                aria-label={`档位 ${index + 1}`}
                disabled={disabled}
                onChange={(event) =>
                  changeLevel(index, level, wire, event.target.value as AgentReasoningEffort)
                }
                className={cn(MODEL_SELECT, 'h-7 px-1.5 text-xs')}
              >
                {choicesFor(level).map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={typing?.level === level ? typing.text : typeof wire === 'string' ? wire : ''}
                placeholder={level === 'off' ? '关闭思考' : level}
                aria-label={`${level} API 参数值`}
                aria-invalid={!acceptedValue(level, wire)}
                disabled={disabled || level === 'off'}
                onChange={(event) => editValue(index, level, event.target.value)}
                onBlur={() => leaveValue(index, level, wire)}
                className={cn(MODEL_INPUT, 'h-7 px-2 text-xs')}
              />
              <button
                type="button"
                aria-label={`删除档位 ${level}`}
                title="删除档位"
                disabled={disabled}
                onClick={() => write(entries.filter((_entry, at) => at !== index))}
                className={MODEL_DANGER_ICON_BUTTON}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {refused ? (
            <p className={MODEL_ERROR}>
              Off 以外的档位都需要填写 API 参数值，且参数值不能为空字符串。
            </p>
          ) : missingLevel ? (
            <p className={MODEL_ERROR}>至少添加一个 Off 以外的档位；不需要思考请关闭推理等级。</p>
          ) : (
            <p className={MODEL_HINT}>模型选择器会按升级顺序列出这些档位。</p>
          )}
          <button
            type="button"
            disabled={disabled || AGENT_REASONING_EFFORTS.every((level) => levels.includes(level))}
            onClick={addLevel}
            className={MODEL_SMALL_ADD_BUTTON}
          >
            <Plus className="h-3 w-3" />
            <span>添加档位</span>
          </button>
        </div>
      )}
    </div>
  )
}
