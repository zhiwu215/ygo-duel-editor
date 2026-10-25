import { useEffect, useState, type JSX } from 'react'
import { Plus } from 'lucide-react'
import { AgentModelInfo, AgentProviderModelConfig, cleanAgentApiKey } from '@shared/index'
import { useAgentModelFetch } from '../../../hooks/useAgentModelFetch'
import {
  adoptFetchedModel,
  cloneProviderModels,
  providerModelsEqual
} from '../../../utils/agentModelFormat'
import { formatModelCapacity, parseModelCapacity } from '../../../utils/modelCapacity'
import { cn } from '../../../lib/utils'
import { FetchModelsDialog } from './FetchModelsDialog'
import { ProviderModelRow } from './ProviderModelRow'
import {
  MODEL_ERROR,
  MODEL_HINT,
  MODEL_LINK_BUTTON,
  MODEL_SMALL_ADD_BUTTON
} from './modelSettingsStyles'

type CapacityField = 'contextWindow' | 'maxTokens'

interface ProviderModelCatalogProps {
  models: AgentProviderModelConfig[]
  baseUrl: string
  apiKey: string
  presetModels?: AgentProviderModelConfig[]
  onChange: (models: AgentProviderModelConfig[]) => void
  onBusyChange?: (busy: boolean) => void
  onCapacityErrorChange?: (invalid: boolean) => void
}

function applyModelPatch(
  model: AgentProviderModelConfig,
  patch: Record<string, unknown>
): AgentProviderModelConfig {
  const next = { ...model } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') Reflect.deleteProperty(next, key)
    else next[key] = value
  }
  return next as unknown as AgentProviderModelConfig
}

function bufferKey(index: number, field: CapacityField): string {
  return `${index}:${field}`
}

function reindexMap<T>(source: ReadonlyMap<string, T>, removed: number): Map<string, T> {
  const next = new Map<string, T>()
  for (const [key, value] of source) {
    const at = Number(key.slice(0, key.indexOf(':')))
    if (at === removed) continue
    next.set(at > removed ? key.replace(/^\d+/, String(at - 1)) : key, value)
  }
  return next
}

function reindexSet(source: ReadonlySet<number>, removed: number): Set<number> {
  const next = new Set<number>()
  for (const at of source) {
    if (at === removed) continue
    next.add(at > removed ? at - 1 : at)
  }
  return next
}

export function ProviderModelCatalog({
  models,
  baseUrl,
  apiKey,
  presetModels,
  onChange,
  onBusyChange,
  onCapacityErrorChange
}: ProviderModelCatalogProps): JSX.Element {
  const { supported, fetchModels } = useAgentModelFetch()
  const [pulling, setPulling] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [candidates, setCandidates] = useState<AgentModelInfo[] | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  const [buffers, setBuffers] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [capacityErrors, setCapacityErrors] = useState<ReadonlyMap<string, string>>(() => new Map())

  useEffect(() => {
    onBusyChange?.(pulling)
  }, [pulling, onBusyChange])

  useEffect(() => {
    onCapacityErrorChange?.(capacityErrors.size > 0)
  }, [capacityErrors, onCapacityErrorChange])

  const inherited = presetModels !== undefined && providerModelsEqual(models, presetModels)
  const showReset = presetModels !== undefined && !inherited

  const patch = (index: number, value: Record<string, unknown>): void => {
    onChange(models.map((model, at) => (at === index ? applyModelPatch(model, value) : model)))
  }

  const capacityText = (index: number, field: CapacityField): string => {
    const buffered = buffers.get(bufferKey(index, field))
    if (buffered !== undefined) return buffered
    const value = models[index]?.[field]
    return value === undefined ? '' : formatModelCapacity(value)
  }

  const changeCapacity = (index: number, field: CapacityField, text: string): void => {
    const key = bufferKey(index, field)
    const nextBuffers = new Map(buffers)
    nextBuffers.set(key, text)
    setBuffers(nextBuffers)

    const parsed = parseModelCapacity(text)
    const invalid =
      text.trim().length > 0 && (parsed === undefined || !Number.isInteger(parsed) || parsed <= 0)
    const nextErrors = new Map(capacityErrors)
    if (invalid) nextErrors.set(key, '容量需为数字，可加 K 或 M 后缀。')
    else nextErrors.delete(key)
    setCapacityErrors(nextErrors)
    patch(index, { [field]: invalid ? undefined : parsed })
  }

  const capacityErrorOf = (index: number): string | undefined => {
    for (const field of ['contextWindow', 'maxTokens'] as const) {
      const message = capacityErrors.get(bufferKey(index, field))
      if (message) return message
    }
    return undefined
  }

  const remove = (index: number): void => {
    setExpanded((current) => reindexSet(current, index))
    setBuffers((current) => reindexMap(current, index))
    setCapacityErrors((current) => reindexMap(current, index))
    onChange(models.filter((_model, at) => at !== index))
  }

  const toggle = (index: number): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(index)) next.add(index)
      return next
    })
  }

  const reset = (): void => {
    if (!presetModels) return
    setExpanded(new Set())
    setBuffers(new Map())
    setCapacityErrors(new Map())
    onChange(cloneProviderModels(presetModels))
  }

  const fetchModelsFromProvider = async (): Promise<void> => {
    if (!supported || !baseUrl.trim()) return
    setPulling(true)
    setFetchError('')
    const result = await fetchModels({
      baseUrl: baseUrl.trim(),
      apiKey: cleanAgentApiKey(apiKey)
    })
    setPulling(false)
    if (!result.success || !result.models) {
      setFetchError(result.error || '获取失败')
      return
    }
    if (result.models.length === 0) {
      setFetchError('该提供商没有列出任何模型，请手动添加。')
      return
    }
    setCandidates(result.models)
  }

  const adopt = (picked: AgentModelInfo[]): void => {
    const byId = new Map(models.map((model) => [model.id, model]))
    for (const info of picked) {
      if (!byId.has(info.id)) byId.set(info.id, adoptFetchedModel(info))
    }
    onChange([...byId.values()])
    setCandidates(null)
  }

  return (
    <section className="flex flex-col gap-2" aria-label="模型目录">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-xs font-medium leading-[18px] text-foreground">模型目录</span>
        <span className="min-w-0 truncate text-xs leading-[18px] text-[#81858c] dark:text-[#979da6]">
          {inherited ? '正在使用适配器默认模型' : '已自定义模型目录'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {showReset && (
            <button type="button" onClick={reset} className={MODEL_LINK_BUTTON}>
              恢复默认模型
            </button>
          )}
          <button
            type="button"
            onClick={() => void fetchModelsFromProvider()}
            disabled={pulling || !supported || !baseUrl.trim()}
            className={MODEL_LINK_BUTTON}
          >
            {pulling ? '正在询问提供商…' : '获取可用模型'}
          </button>
        </div>
      </div>

      {fetchError && <p className={MODEL_ERROR}>{fetchError}</p>}
      {models.length === 0 && (
        <p className={MODEL_HINT}>模型选择器中将不显示任何模型；请获取或手动添加模型。</p>
      )}

      <div className="flex flex-col gap-2">
        {models.map((model, index) => (
          <ProviderModelRow
            key={index}
            model={model}
            position={index + 1}
            expanded={expanded.has(index)}
            contextWindowText={capacityText(index, 'contextWindow')}
            maxTokensText={capacityText(index, 'maxTokens')}
            capacityError={capacityErrorOf(index)}
            onToggle={() => toggle(index)}
            onRemove={() => remove(index)}
            onFieldChange={(field, value) => patch(index, { [field]: value })}
            onCapacityChange={(field, value) => changeCapacity(index, field, value)}
            onChange={(next) => onChange(models.map((item, at) => (at === index ? next : item)))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...models, { id: '' }])}
        className={cn(MODEL_SMALL_ADD_BUTTON, 'mt-0.5')}
      >
        <Plus className="h-3 w-3" />
        <span>添加模型</span>
      </button>

      {candidates && (
        <FetchModelsDialog
          models={candidates}
          initialSelected={candidates
            .filter((model) => !models.some((existing) => existing.id === model.id))
            .map((model) => model.id)}
          onAdopt={adopt}
          onClose={() => setCandidates(null)}
        />
      )}
    </section>
  )
}
