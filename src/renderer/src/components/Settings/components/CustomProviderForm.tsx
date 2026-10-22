import { useState, type JSX } from 'react'
import {
  AGENT_API_FORMAT_LABELS,
  AGENT_CUSTOM_API_FORMAT_VALUES,
  AgentApiFormat,
  AgentProviderConfig,
  AgentProviderModelConfig,
  cleanAgentApiKey,
  isLocalEndpoint
} from '@shared/index'
import {
  buildAgentProvider,
  validateBaseUrl,
  validateProviderId,
  validateProviderModels
} from '../../../utils/agentProviderForm'
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

interface CustomProviderFormProps {
  existingIds: string[]
  onSave: (provider: AgentProviderConfig) => void
  onCancel: () => void
  onBusyChange?: (busy: boolean) => void
}

export function CustomProviderForm({
  existingIds,
  onSave,
  onCancel,
  onBusyChange
}: CustomProviderFormProps): JSX.Element {
  const [providerId, setProviderId] = useState('')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiFormat, setApiFormat] = useState<AgentApiFormat>('openai-chat-completions')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<AgentProviderModelConfig[]>([])
  const [capacityInvalid, setCapacityInvalid] = useState(false)
  const [error, setError] = useState('')

  const idError = validateProviderId(providerId, existingIds)
  const baseUrlError = validateBaseUrl(baseUrl)
  const modelError = validateProviderModels(models)
  const keyMissing = !apiKey.trim() && !isLocalEndpoint(baseUrl)
  const canSubmit =
    idError === undefined &&
    baseUrlError === undefined &&
    modelError === undefined &&
    models.length > 0 &&
    !capacityInvalid

  const save = (): void => {
    const result = buildAgentProvider({
      id: providerId.trim(),
      name: name.trim() || providerId.trim(),
      baseUrl,
      apiFormat,
      apiKey: cleanAgentApiKey(apiKey),
      models
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSave(result.provider)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={MODEL_LABEL}>Provider ID</span>
        <input
          autoFocus
          type="text"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          placeholder="acme-gateway"
          aria-label="Provider ID"
          aria-invalid={providerId.length > 0 && idError !== undefined}
          spellCheck={false}
          className={MODEL_INPUT}
        />
        {providerId.length > 0 && idError ? (
          <p className={MODEL_ERROR}>{idError}</p>
        ) : (
          <p className={MODEL_HINT}>
            以小写字母开头的标识，在请求中唯一标识该提供商，并用于派生凭据名。
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={MODEL_LABEL}>显示名称</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={providerId.trim() || '显示名称'}
          aria-label="显示名称"
          className={MODEL_INPUT}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={MODEL_LABEL}>API 地址</span>
        <input
          type="text"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={
            apiFormat === 'anthropic-messages'
              ? 'https://gateway.example'
              : 'https://gateway.example/v1'
          }
          aria-label="API 地址"
          aria-invalid={baseUrl.length > 0 && baseUrlError !== undefined}
          spellCheck={false}
          className={MODEL_INPUT}
        />
        {baseUrl.length > 0 && baseUrlError ? <p className={MODEL_ERROR}>{baseUrlError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={MODEL_LABEL}>API 协议</span>
        <select
          value={apiFormat}
          aria-label="API 协议"
          onChange={(event) => setApiFormat(event.target.value as AgentApiFormat)}
          className={MODEL_SELECT}
        >
          {AGENT_CUSTOM_API_FORMAT_VALUES.map((format) => (
            <option key={format} value={format}>
              {AGENT_API_FORMAT_LABELS[format]}
            </option>
          ))}
        </select>
      </div>

      <ApiKeyField
        value={apiKey}
        stored={false}
        onChange={setApiKey}
        message={keyMissing ? '未检测到 API 密钥。请填写 API 密钥后使用该供应商。' : undefined}
        messageTone="notice"
      />

      <div className="border-t-[0.5px] border-foreground/10 pt-3">
        <ProviderModelCatalog
          models={models}
          baseUrl={baseUrl}
          apiKey={cleanAgentApiKey(apiKey)}
          onChange={setModels}
          onBusyChange={onBusyChange}
          onCapacityErrorChange={setCapacityInvalid}
        />
      </div>

      {error && <p className={MODEL_ERROR}>{error}</p>}
      {modelError && (
        <p className={MODEL_ERROR}>
          模型 {modelError.index + 1}：{modelError.message}
        </p>
      )}
      {models.length === 0 && <p className={MODEL_HINT}>自定义模型 API 至少需要一个模型。</p>}

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
          创建提供商
        </Button>
      </div>
    </div>
  )
}
