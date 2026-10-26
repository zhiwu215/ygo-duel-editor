import { useState, type JSX } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  AGENT_API_FORMAT_LABELS,
  AGENT_CUSTOM_API_FORMAT_VALUES,
  AgentApiFormat,
  AgentProviderConfig,
  AgentProviderPreset,
  cleanAgentApiKey,
  isLocalEndpoint,
  normalizeAgentApiFormat
} from '@shared/index'
import {
  buildAgentProvider,
  validateBaseUrl,
  validateProviderModels
} from '../../../utils/agentProviderForm'
import { cloneProviderModels } from '../../../utils/agentModelFormat'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import { ApiKeyField } from './ApiKeyField'
import { ProviderModelCatalog } from './ProviderModelCatalog'
import {
  MODEL_ERROR,
  MODEL_HINT,
  MODEL_INPUT,
  MODEL_LABEL,
  MODEL_SELECT
} from './modelSettingsStyles'

interface ProviderEditorProps {
  provider: AgentProviderConfig
  preset?: AgentProviderPreset
  mode: 'edit' | 'create'
  onSave: (provider: AgentProviderConfig) => void
  onCancel: () => void
  onBusyChange?: (busy: boolean) => void
}

export function ProviderEditor({
  provider,
  preset,
  mode,
  onSave,
  onCancel,
  onBusyChange
}: ProviderEditorProps): JSX.Element {
  const [draft, setDraft] = useState<AgentProviderConfig>(() => ({
    ...provider,
    models: cloneProviderModels(provider.models)
  }))
  const [keyDraft, setKeyDraft] = useState('')
  const [customOpen, setCustomOpen] = useState(
    () => mode === 'create' && validateBaseUrl(provider.baseUrl) !== undefined
  )
  const [capacityInvalid, setCapacityInvalid] = useState(false)
  const [error, setError] = useState('')

  const patch = (value: Partial<AgentProviderConfig>): void => {
    setDraft((current) => ({ ...current, ...value }))
  }

  const custom = !draft.presetId
  const effectiveKey = keyDraft.trim() ? cleanAgentApiKey(keyDraft) : draft.apiKey
  const resolvedBaseUrl = draft.baseUrl.trim()
  const baseUrlError = validateBaseUrl(resolvedBaseUrl)
  const modelError = validateProviderModels(draft.models)
  const keyMissing = !effectiveKey && !isLocalEndpoint(resolvedBaseUrl)
  const keyMessage =
    draft.apiKey && keyDraft.trim().length === 0
      ? '已保存 API 密钥，留空则保持不变。'
      : keyMissing
        ? '未检测到 API 密钥。请填写 API 密钥后使用该供应商。'
        : !effectiveKey
          ? '本地接口可以留空；如果接口启用了鉴权（例如反向代理配置了 API Key），请填写它的 API Key。'
          : undefined
  const canSubmit =
    !baseUrlError && !modelError && !capacityInvalid && (mode === 'edit' || draft.models.length > 0)

  const save = (): void => {
    const result = buildAgentProvider({ ...draft, apiKey: effectiveKey })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSave(result.provider)
  }

  const toggleCustom = (): void => {
    if (customOpen) {
      setCapacityInvalid(false)
      onBusyChange?.(false)
    }
    setCustomOpen((value) => !value)
  }

  return (
    <div className="flex flex-col gap-3.5">
      {mode === 'edit' && (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium leading-[22px] text-foreground">
            {draft.name}
          </span>
          <span className="min-w-0 truncate text-xs leading-[18px] text-[#81858c] dark:text-[#979da6]">
            {draft.id}
          </span>
        </div>
      )}

      <ApiKeyField
        value={keyDraft}
        stored={draft.apiKey.length > 0}
        onChange={setKeyDraft}
        message={keyMessage}
        messageTone={keyMissing ? 'notice' : 'hint'}
      />

      <div className="border-t-[0.5px] border-foreground/10 pt-2.5">
        <button
          type="button"
          onClick={toggleCustom}
          aria-expanded={customOpen}
          className="flex items-center gap-1.5 text-xs font-medium leading-[18px] text-[#61666b] transition-colors hover:text-foreground dark:text-[#cfd3d6]"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', !customOpen && '-rotate-90')}
          />
          <span>自定义设置</span>
        </button>

        {customOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {custom && (
              <div className="flex flex-col gap-1.5">
                <span className={MODEL_LABEL}>显示名称</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  placeholder={draft.id}
                  aria-label="显示名称"
                  className={MODEL_INPUT}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className={MODEL_LABEL}>API 地址</span>
              <input
                type="text"
                value={draft.baseUrl}
                onChange={(event) => patch({ baseUrl: event.target.value })}
                placeholder="https://api.example.com/v1"
                aria-label="API 地址"
                aria-invalid={baseUrlError !== undefined}
                spellCheck={false}
                className={MODEL_INPUT}
              />
              <p className={baseUrlError ? MODEL_ERROR : MODEL_HINT}>
                {baseUrlError ?? '请填写兼容所选 API 格式的接口地址。'}
              </p>
            </div>

            {custom && (
              <div className="flex flex-col gap-1.5">
                <span className={MODEL_LABEL}>API 协议</span>
                <select
                  value={normalizeAgentApiFormat(draft.apiFormat)}
                  aria-label="API 协议"
                  onChange={(event) => patch({ apiFormat: event.target.value as AgentApiFormat })}
                  className={MODEL_SELECT}
                >
                  {AGENT_CUSTOM_API_FORMAT_VALUES.map((format) => (
                    <option key={format} value={format}>
                      {AGENT_API_FORMAT_LABELS[format]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="border-t-[0.5px] border-foreground/10 pt-3">
              <ProviderModelCatalog
                models={draft.models}
                baseUrl={draft.baseUrl}
                apiKey={effectiveKey}
                presetModels={preset?.models}
                onChange={(models) => patch({ models })}
                onBusyChange={onBusyChange}
                onCapacityErrorChange={setCapacityInvalid}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className={MODEL_ERROR}>{error}</p>}
      {modelError && (
        <p className={MODEL_ERROR}>
          模型 {modelError.index + 1}：{modelError.message}
        </p>
      )}
      {mode === 'create' && draft.models.length === 0 && (
        <p className={MODEL_HINT}>至少添加一个模型后才能保存。</p>
      )}

      <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-foreground/10 pt-3">
        <Button
          size="default"
          variant="outline"
          onClick={onCancel}
          className="h-9 rounded-[12px] border-[0.5px] border-foreground/15 px-3.5 text-sm"
        >
          取消
        </Button>
        <Button
          size="default"
          onClick={save}
          disabled={!canSubmit}
          className="h-9 rounded-[12px] bg-foreground px-3.5 text-sm text-background hover:bg-foreground/90"
        >
          保存
        </Button>
      </div>
    </div>
  )
}
