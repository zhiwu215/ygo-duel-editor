import { useId, useMemo, useState, type JSX } from 'react'
import { AgentProviderConfig, AgentProviderPreset, createProviderFromPreset } from '@shared/index'
import { cn } from '../../../lib/utils'
import { CustomProviderForm } from './CustomProviderForm'
import { ProviderEditor } from './ProviderEditor'
import { MODEL_HINT, MODEL_LABEL, MODEL_SELECT } from './modelSettingsStyles'

type AddMode = 'catalog' | 'custom'

interface ProviderAddCardProps {
  presets: AgentProviderPreset[]
  providers: AgentProviderConfig[]
  onAdd: (provider: AgentProviderConfig) => void
  onCancel: () => void
}

export function ProviderAddCard({
  presets,
  providers,
  onAdd,
  onCancel
}: ProviderAddCardProps): JSX.Element {
  const available = useMemo(
    () =>
      presets.filter(
        (preset) =>
          !providers.some(
            (provider) => provider.id === preset.id || provider.presetId === preset.id
          )
      ),
    [presets, providers]
  )
  const takenIds = useMemo(
    () => [
      ...new Set([
        ...providers.map((provider) => provider.id),
        ...presets.map((preset) => preset.id)
      ])
    ],
    [presets, providers]
  )
  const [mode, setMode] = useState<AddMode>(available.length > 0 ? 'catalog' : 'custom')
  const [visited, setVisited] = useState<ReadonlySet<AddMode>>(
    () => new Set<AddMode>([available.length > 0 ? 'catalog' : 'custom'])
  )
  const [catalogId, setCatalogId] = useState(available[0]?.id ?? '')
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [customBusy, setCustomBusy] = useState(false)
  const id = useId()

  const catalogOffered = available.length > 0
  const bothOffered = catalogOffered
  const switchLocked = catalogBusy || customBusy
  const preset = available.find((item) => item.id === catalogId) ?? available[0]
  const catalogDraft = useMemo(() => (preset ? createProviderFromPreset(preset) : null), [preset])

  const show = (next: AddMode): void => {
    setMode(next)
    setVisited((current) => new Set([...current, next]))
  }

  const tabClass = (active: boolean): string =>
    cn(
      'h-7 rounded-[8px] px-3 text-xs leading-[18px] transition-colors',
      active
        ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-[#232324]'
        : 'text-[#61666b] hover:text-foreground dark:text-[#cfd3d6]'
    )

  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-[#f5f6f7] px-4 py-3.5 dark:bg-[#353638]">
      {bothOffered ? (
        <div
          role="tablist"
          aria-label="添加方式"
          className="inline-flex w-fit items-center gap-0.5 rounded-[10px] bg-foreground/5 p-0.5"
        >
          <button
            type="button"
            role="tab"
            id={`${id}-catalog`}
            aria-selected={mode === 'catalog'}
            aria-controls={`${id}-catalog-panel`}
            disabled={switchLocked}
            onClick={() => show('catalog')}
            className={tabClass(mode === 'catalog')}
          >
            第三方模型提供商
          </button>
          <button
            type="button"
            role="tab"
            id={`${id}-custom`}
            aria-selected={mode === 'custom'}
            aria-controls={`${id}-custom-panel`}
            disabled={switchLocked}
            onClick={() => show('custom')}
            className={tabClass(mode === 'custom')}
          >
            自定义模型 API
          </button>
        </div>
      ) : (
        <div className="text-sm font-medium leading-[22px]">
          {mode === 'catalog' ? '第三方模型提供商' : '自定义模型 API'}
        </div>
      )}

      <p className="text-xs leading-[18px] text-[#81858c] dark:text-[#979da6]">
        {mode === 'catalog'
          ? '从内置目录中选择 OpenAI、Anthropic、Kimi 等提供商，填入其 API 密钥即可使用。'
          : '连接中转站、自部署服务或其他兼容 OpenAI / Anthropic 协议的接口，需填写 API 地址、协议和模型。'}
      </p>

      {visited.has('catalog') && catalogDraft && preset && (
        <div
          id={`${id}-catalog-panel`}
          role={bothOffered ? 'tabpanel' : undefined}
          aria-labelledby={bothOffered ? `${id}-catalog` : undefined}
          className={mode === 'catalog' ? 'flex flex-col gap-3' : 'hidden'}
        >
          <label className="flex flex-col gap-1.5">
            <span className={MODEL_LABEL}>提供商</span>
            <select
              value={preset.id}
              aria-label="提供商"
              disabled={catalogBusy}
              onChange={(event) => setCatalogId(event.target.value)}
              className={MODEL_SELECT}
            >
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </label>
          {preset.note ? <p className={MODEL_HINT}>{preset.note}</p> : null}
          <ProviderEditor
            key={preset.id}
            provider={catalogDraft}
            preset={preset}
            mode="create"
            onSave={onAdd}
            onCancel={onCancel}
            onBusyChange={setCatalogBusy}
          />
        </div>
      )}

      {visited.has('custom') && (
        <div
          id={`${id}-custom-panel`}
          role={bothOffered ? 'tabpanel' : undefined}
          aria-labelledby={bothOffered ? `${id}-custom` : undefined}
          className={mode === 'custom' ? 'flex flex-col gap-3' : 'hidden'}
        >
          <CustomProviderForm
            existingIds={takenIds}
            onSave={onAdd}
            onCancel={onCancel}
            onBusyChange={setCustomBusy}
          />
        </div>
      )}
    </div>
  )
}
