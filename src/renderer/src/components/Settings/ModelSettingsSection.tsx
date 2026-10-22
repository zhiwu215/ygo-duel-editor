import { useEffect, useMemo, useState, type JSX } from 'react'
import { AgentProviderConfig, AgentProviderPreset } from '@shared/index'
import { Plus } from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { providerLabel } from '../../utils/agentModelFormat'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ProviderAddCard } from './components/ProviderAddCard'
import { ProviderRow } from './components/ProviderRow'

export function ModelSettingsSection(): JSX.Element {
  const { config, presets, loadPresets, upsertProvider, removeProvider } = useAgentStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AgentProviderConfig | null>(null)
  const [savedLabel, setSavedLabel] = useState('')

  useEffect(() => {
    if (presets.length === 0) void loadPresets()
  }, [presets.length, loadPresets])

  const providers = useMemo(() => config.providers ?? [], [config.providers])
  const presetById = useMemo(
    () => new Map<string, AgentProviderPreset>(presets.map((preset) => [preset.id, preset])),
    [presets]
  )

  const saveProvider = (provider: AgentProviderConfig): void => {
    upsertProvider(provider)
    setSavedLabel(providerLabel(provider))
    setEditingId(null)
    setAdding(false)
  }

  const confirmDelete = (): void => {
    if (!pendingDelete) return
    if (editingId === pendingDelete.id) setEditingId(null)
    removeProvider(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {savedLabel && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs leading-[18px] text-[#15803d] dark:text-[#4ade80]"
        >
          已保存 {savedLabel}。
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            preset={presetById.get(provider.presetId ?? provider.id)}
            editing={editingId === provider.id}
            onEdit={() => {
              setSavedLabel('')
              setAdding(false)
              setEditingId((current) => (current === provider.id ? null : provider.id))
            }}
            onRemove={() => {
              setSavedLabel('')
              setPendingDelete(provider)
            }}
            onSave={saveProvider}
            onCancel={() => setEditingId(null)}
          />
        ))}
      </ul>

      {adding ? (
        <ProviderAddCard
          presets={presets}
          providers={providers}
          onAdd={saveProvider}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSavedLabel('')
            setEditingId(null)
            setAdding(true)
          }}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[16px] border-[0.5px] border-dashed border-foreground/15 text-sm leading-[22px] text-foreground transition-colors hover:bg-foreground/5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>添加模型提供商</span>
        </button>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`删除 ${pendingDelete ? providerLabel(pendingDelete) : ''}？`}
        description="删除该提供商会移除其配置和存储的 API 密钥，此操作不可撤销。"
        confirmText="删除"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
