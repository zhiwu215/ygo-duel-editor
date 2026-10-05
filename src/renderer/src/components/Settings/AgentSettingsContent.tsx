import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Pencil,
  MoreHorizontal,
  AlertCircle,
  Boxes,
  Image as ImageIcon
} from 'lucide-react'
import {
  AgentApiFormat,
  AgentModelConfig,
  AgentModelInfo,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset,
  AGENT_API_FORMAT_LABELS,
  AGENT_API_FORMAT_VALUES,
  DEFAULT_AGENT_API_FORMAT,
  cleanAgentApiKey,
  createProviderFromPreset,
  isProviderReady,
  normalizeAgentApiFormat
} from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '../../lib/utils'

export type AgentSettingsSection = 'model-settings' | 'chat'

interface AgentSettingsContentProps {
  section: AgentSettingsSection
}

type ProviderStatus = 'ready' | 'unavailable' | 'disabled'

function resolveProviderStatus(provider: AgentProviderConfig): ProviderStatus {
  if (!provider.enabled) return 'disabled'
  return isProviderReady(provider) ? 'ready' : 'unavailable'
}

const STATUS_DOT_CLASS: Record<ProviderStatus, string> = {
  ready: 'bg-emerald-500',
  unavailable: 'bg-amber-500',
  disabled: 'bg-neutral-300 dark:bg-neutral-600'
}

function StatusDot({
  status,
  className
}: {
  status: ProviderStatus
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT_CLASS[status], className)}
    />
  )
}

function formatContextWindow(tokens?: number): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`
  return String(tokens)
}

function mergeFetchedModels(
  existing: AgentProviderModelConfig[],
  fetched: AgentModelInfo[]
): AgentProviderModelConfig[] {
  const known = new Set(existing.map((m) => m.id))
  const added = fetched
    .filter((m) => !known.has(m.id))
    .map<AgentProviderModelConfig>((m) => ({
      id: m.id,
      name: m.name,
      supportsReasoning: m.supportsReasoning,
      supportsVision: m.supportsVision,
      contextWindow: m.contextWindow,
      enabled: true,
      custom: true
    }))
  return [...existing, ...added]
}

interface ResolvedSelection {
  provider: AgentProviderConfig
  preset: AgentProviderPreset | null
  configured: boolean
}

export const AgentSettingsContent: React.FC<AgentSettingsContentProps> = ({ section }) => {
  const { config, presets, loadPresets, upsertProvider, removeProvider, selectModel } =
    useAgentStore()

  const [selection, setSelection] = useState<string | null>(null)
  const [navSearch, setNavSearch] = useState('')

  useEffect(() => {
    if (presets.length === 0) void loadPresets()
  }, [presets.length, loadPresets])

  const providers = useMemo(() => config.providers ?? [], [config.providers])

  const presetProviders = useMemo(
    () =>
      presets.map((preset) => ({
        preset,
        configured: providers.find((p) => p.presetId === preset.id || p.id === preset.id) ?? null
      })),
    [presets, providers]
  )

  const customProviders = useMemo(() => providers.filter((p) => !p.presetId), [providers])

  const q = navSearch.trim().toLowerCase()
  const matchesQuery = (name: string, baseUrl: string, models: { id: string }[]): boolean => {
    if (!q) return true
    return (
      name.toLowerCase().includes(q) ||
      baseUrl.toLowerCase().includes(q) ||
      models.some((m) => m.id.toLowerCase().includes(q))
    )
  }

  const effectiveSelection = useMemo((): string | null => {
    const isValid = Boolean(
      selection &&
      (selection.startsWith('provider:')
        ? providers.some((p) => p.id === selection.slice('provider:'.length))
        : presetProviders.some(
            (x) => x.preset.id === selection.slice('preset:'.length) && !x.configured
          ))
    )
    if (isValid) return selection
    if (config.provider && providers.some((p) => p.id === config.provider)) {
      return `provider:${config.provider}`
    }
    if (presetProviders.length > 0) return `preset:${presetProviders[0].preset.id}`
    if (customProviders.length > 0) return `provider:${customProviders[0].id}`
    return null
  }, [selection, providers, presetProviders, customProviders, config.provider])

  const resolved = useMemo((): ResolvedSelection | null => {
    if (!effectiveSelection) return null
    if (effectiveSelection.startsWith('provider:')) {
      const provider = providers.find((p) => p.id === effectiveSelection.slice('provider:'.length))
      if (!provider) return null
      const preset = provider.presetId
        ? (presets.find((p) => p.id === provider.presetId) ?? null)
        : null
      return { provider, preset, configured: true }
    }
    const preset = presets.find((p) => p.id === effectiveSelection.slice('preset:'.length))
    if (!preset) return null
    return { provider: createProviderFromPreset(preset), preset, configured: false }
  }, [effectiveSelection, providers, presets])

  const activeModelInfo = useMemo((): AgentProviderModelConfig | null => {
    const provider = providers.find((p) => p.id === config.provider)
    return provider?.models.find((m) => m.id === config.model) ?? null
  }, [providers, config.provider, config.model])

  const openAddProvider = (): void => {
    const id = `custom-${Date.now().toString(36)}`
    upsertProvider({
      id,
      name: '新供应商',
      baseUrl: '',
      apiFormat: DEFAULT_AGENT_API_FORMAT,
      apiKey: '',
      enabled: true,
      models: []
    })
    setSelection(`provider:${id}`)
  }

  const deleteProvider = (providerId: string): void => {
    const remainingCustom = customProviders.filter((p) => p.id !== providerId)
    removeProvider(providerId)
    const nextSelection = remainingCustom[0]
      ? `provider:${remainingCustom[0].id}`
      : presetProviders[0]
        ? `preset:${presetProviders[0].preset.id}`
        : null
    setSelection(nextSelection)
  }

  return (
    <div className="text-xs">
      {section === 'model-settings' && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] leading-5 text-muted-foreground pt-1">
              管理自定义模型供应商，配置后可在聊天时选择使用。
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={openAddProvider}
              className="gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加供应商</span>
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card flex h-[520px]">
            <div className="w-44 shrink-0 border-r border-border flex flex-col">
              <div className="p-2 border-b border-border/60">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background">
                  <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                  <input
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    placeholder="搜索供应商..."
                    className="flex-1 min-w-0 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-3">
                <div>
                  <div className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/80">
                    常用提供商
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {presetProviders.map(({ preset, configured }) => {
                      if (!matchesQuery(preset.name, preset.baseUrl, configured?.models ?? [])) {
                        return null
                      }
                      const key = configured ? `provider:${configured.id}` : `preset:${preset.id}`
                      return (
                        <NavItem
                          key={key}
                          active={effectiveSelection === key}
                          label={preset.name}
                          status={configured ? resolveProviderStatus(configured) : 'unavailable'}
                          onClick={() => setSelection(key)}
                        />
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/80">
                    自定义供应商
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {customProviders.map((provider) =>
                      matchesQuery(provider.name, provider.baseUrl, provider.models) ? (
                        <NavItem
                          key={provider.id}
                          active={effectiveSelection === `provider:${provider.id}`}
                          label={provider.name}
                          status={resolveProviderStatus(provider)}
                          onClick={() => setSelection(`provider:${provider.id}`)}
                        />
                      ) : null
                    )}
                    <button
                      type="button"
                      onClick={openAddProvider}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <Plus className="w-3 h-3 shrink-0" />
                      <span className="text-[11px] font-medium">新供应商</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              {resolved ? (
                <ProviderDetailPanel
                  key={`${resolved.provider.id}:${resolved.configured ? 'on' : 'off'}`}
                  provider={resolved.provider}
                  preset={resolved.preset}
                  configured={resolved.configured}
                  activeProviderId={config.provider}
                  activeModelId={config.model}
                  onUpsert={upsertProvider}
                  onRemove={() => deleteProvider(resolved.provider.id)}
                  onSelectModel={selectModel}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
                  从左侧选择一个供应商开始配置
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'chat' && <ChatSection config={config} activeModelInfo={activeModelInfo} />}
    </div>
  )
}

interface NavItemProps {
  active: boolean
  label: string
  status: ProviderStatus
  onClick: () => void
}

function NavItem({ active, label, status, onClick }: NavItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
        active
          ? 'bg-accent/70 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
      )}
    >
      <StatusDot status={status} />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{label}</span>
    </button>
  )
}

interface ProviderDetailPanelProps {
  provider: AgentProviderConfig
  preset: AgentProviderPreset | null
  configured: boolean
  activeProviderId?: string
  activeModelId: string
  onUpsert: (provider: AgentProviderConfig) => void
  onRemove: () => void
  onSelectModel: (providerId: string, modelId: string) => void
}

function ProviderDetailPanel({
  provider,
  preset,
  configured,
  activeProviderId,
  activeModelId,
  onUpsert,
  onRemove,
  onSelectModel
}: ProviderDetailPanelProps): React.JSX.Element {
  const [urlDraft, setUrlDraft] = useState(provider.baseUrl)
  const [keyDraft, setKeyDraft] = useState(provider.apiKey)
  const [nameDraft, setNameDraft] = useState(provider.name)
  const [showKey, setShowKey] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [addModelDraft, setAddModelDraft] = useState('')
  const [modelsBusy, setModelsBusy] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const isCustom = !provider.presetId
  const status = resolveProviderStatus(configured ? provider : { ...provider, enabled: true })
  const canActivate = configured && provider.apiKey.trim().length > 0

  const commit = (patch: Partial<AgentProviderConfig>, selectModelId?: string): void => {
    const next: AgentProviderConfig = { ...provider, ...patch }
    onUpsert(next)
    if (selectModelId) onSelectModel(next.id, selectModelId)
  }

  const validateKey = async (
    baseUrl: string,
    apiKey: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!window.api?.agentFetchModels || !baseUrl.trim()) return { ok: true }
    const probe = await window.api.agentFetchModels({ baseUrl, apiKey: cleanAgentApiKey(apiKey) })
    if (probe.success) return { ok: true }
    const err = probe.error || '未知错误'
    if (err.includes('HTTP 401') || err.includes('身份验证失败')) return { ok: false, error: err }
    return { ok: true, error: err }
  }

  const commitKey = async (): Promise<void> => {
    const cleaned = cleanAgentApiKey(keyDraft)
    if (cleaned === provider.apiKey) return
    if (!cleaned) {
      setKeyError('')
      commit({ apiKey: '' })
      return
    }
    setKeyBusy(true)
    setKeyError('')
    const check = await validateKey(urlDraft, cleaned)
    setKeyBusy(false)
    if (!check.ok) {
      setKeyError(check.error || '密钥校验失败')
      return
    }
    const modelId = provider.models.find((m) => m.enabled)?.id
    commit({ apiKey: cleaned }, modelId)
    await pullModels({ baseUrl: urlDraft, apiKey: cleaned })
  }

  const commitUrl = (): void => {
    const next = urlDraft.trim()
    if (next === provider.baseUrl) return
    commit({ baseUrl: next })
  }

  const commitRename = (): void => {
    const next = nameDraft.trim()
    setRenaming(false)
    if (!next || next === provider.name) {
      setNameDraft(provider.name)
      return
    }
    commit({ name: next })
  }

  const setModelEnabled = (modelId: string, enabled: boolean): void => {
    const models = provider.models.map((m) => (m.id === modelId ? { ...m, enabled } : m))
    const wasActive = activeProviderId === provider.id && activeModelId === modelId
    commit({ models }, !enabled && wasActive ? models.find((m) => m.enabled)?.id : undefined)
  }

  const addModel = (): void => {
    const id = addModelDraft.trim()
    if (!id) return
    setAddModelDraft('')
    if (provider.models.some((m) => m.id === id)) return
    commit({ models: [...provider.models, { id, enabled: true, custom: true }] }, id)
  }

  const removeModel = (modelId: string): void => {
    const wasActive = activeProviderId === provider.id && activeModelId === modelId
    const models = provider.models.filter((m) => m.id !== modelId)
    commit({ models }, wasActive ? models.find((m) => m.enabled)?.id : undefined)
  }

  const pullModels = async (source?: { baseUrl: string; apiKey: string }): Promise<void> => {
    if (!window.api?.agentFetchModels) return
    const baseUrl = (source?.baseUrl ?? urlDraft).trim()
    const apiKey = cleanAgentApiKey(source?.apiKey ?? keyDraft)
    setModelsBusy(true)
    setModelsError('')
    const res = await window.api.agentFetchModels({ baseUrl, apiKey })
    setModelsBusy(false)
    if (!res.success || !res.models) {
      setModelsError(res.error || '拉取失败')
      return
    }
    if (res.models.length === 0) {
      setModelsError('接口未返回任何模型')
      return
    }
    const models = mergeFetchedModels(provider.models, res.models)
    const keepActive = models.some((m) => m.enabled && m.id === activeModelId)
    const adopt = !keepActive && (activeProviderId === provider.id || !activeModelId)
    const patch: Partial<AgentProviderConfig> = { models }
    if (source) patch.apiKey = apiKey
    commit(patch, adopt ? models.find((m) => m.enabled)?.id : undefined)
  }

  const testConnection = async (): Promise<void> => {
    if (!window.api?.agentFetchModels) return
    setTesting(true)
    setTestResult(null)
    const probe = await window.api.agentFetchModels({
      baseUrl: urlDraft.trim(),
      apiKey: cleanAgentApiKey(keyDraft)
    })
    setTesting(false)
    setTestResult(
      probe.success
        ? { ok: true, message: `连接成功，厂商返回 ${probe.models?.length ?? 0} 个可用模型` }
        : { ok: false, message: probe.error || '连接失败（请检查接口地址、密钥与网络）' }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
              status === 'ready'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            )}
          >
            {preset?.badge ?? <Boxes className="w-3.5 h-3.5" />}
          </div>
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setNameDraft(provider.name)
                  setRenaming(false)
                }
              }}
              className="min-w-0 w-40 px-2 py-1 rounded border border-border bg-background text-xs font-semibold"
            />
          ) : (
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{provider.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {preset?.description ?? (isCustom ? '自定义端点' : 'OpenAI 兼容接口')}
                {!configured && ' · 未连接'}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            checked={provider.enabled !== false}
            onCheckedChange={(enabled) => commit({ enabled })}
            aria-label={provider.enabled !== false ? '禁用供应商' : '启用供应商'}
          />
          {isCustom && (
            <div className="relative" ref={menuRef}>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setMenuOpen((v) => !v)}
                className="text-muted-foreground"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(true)
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left hover:bg-muted/60"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>重命名</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>删除</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">Base URL</label>
        <input
          type="text"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="https://api.example.com/v1"
          spellCheck={false}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-[11px] font-mono"
        />
      </div>

      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">API 格式</label>
        <Select
          value={normalizeAgentApiFormat(provider.apiFormat)}
          onValueChange={(val) => commit({ apiFormat: val as AgentApiFormat })}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_API_FORMAT_VALUES.map((format) => (
              <SelectItem key={format} value={format}>
                {AGENT_API_FORMAT_LABELS[format]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-[11px] text-muted-foreground">API Key</label>
          {preset?.apiKeyUrl && (
            <button
              type="button"
              onClick={() => void window.api.openExternal(preset.apiKeyUrl as string)}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              获取 API Key
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={() => void commitKey()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="输入 API Key（仅保存在本地设备）"
            spellCheck={false}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[11px] font-mono"
          />
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setShowKey((v) => !v)}
            title={showKey ? '隐藏密钥' : '显示密钥'}
            className="shrink-0"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void testConnection()}
            disabled={testing || keyBusy || !urlDraft.trim()}
            className="shrink-0"
          >
            {testing || keyBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '测试连接'}
          </Button>
        </div>
        {keyError && (
          <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{keyError}</span>
          </div>
        )}
        {testResult && (
          <div
            className={cn(
              'mt-1.5 px-2 py-1.5 rounded text-[11px] break-all',
              testResult.ok
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border border-destructive/40 bg-destructive/10 text-destructive'
            )}
          >
            {testResult.message}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] text-muted-foreground">模型列表</span>
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => void pullModels()}
              disabled={modelsBusy || !urlDraft.trim()}
              title="从厂商接口拉取当前可用模型"
              className="gap-1"
            >
              <RefreshCw className={cn('w-3 h-3', modelsBusy && 'animate-spin')} />
              <span>拉取模型</span>
            </Button>
            <Button size="xs" variant="secondary" onClick={addModel} className="gap-1">
              <Plus className="w-3 h-3" />
              <span>添加模型</span>
            </Button>
          </div>
        </div>

        {modelsError && (
          <div className="mb-1.5 px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all">
            {modelsError}
          </div>
        )}

        {provider.models.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-background/60">
            {provider.models.map((model) => {
              const isActive = activeProviderId === provider.id && activeModelId === model.id
              const ctx = formatContextWindow(model.contextWindow)
              return (
                <div
                  key={model.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectModel(provider.id, model.id)}
                    disabled={!canActivate || !model.enabled}
                    title={canActivate ? '设为当前使用模型' : '配置 API Key 后可选用'}
                    className="min-w-0 flex-1 flex items-center gap-1.5 text-left disabled:cursor-not-allowed"
                  >
                    <span className="min-w-0 truncate text-[11px] font-medium">
                      {model.name ?? model.id}
                    </span>
                    {model.name && model.name !== model.id && (
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        {model.id}
                      </span>
                    )}
                    {ctx && (
                      <span className="text-[9px] px-1 py-0.5 rounded border border-border bg-muted text-muted-foreground shrink-0">
                        {ctx}
                      </span>
                    )}
                    {model.supportsVision && (
                      <span className="text-[9px] px-1 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 inline-flex items-center gap-0.5">
                        <ImageIcon className="w-2.5 h-2.5" />
                        视觉
                      </span>
                    )}
                    {model.supportsReasoning && (
                      <span className="text-[9px] px-1 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        推理
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 shrink-0 inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        使用中
                      </span>
                    )}
                  </button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => removeModel(model.id)}
                    title="删除模型"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <Switch
                    checked={model.enabled}
                    onCheckedChange={(v) => setModelEnabled(model.id, v)}
                    aria-label={model.enabled ? '停用模型' : '启用模型'}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 h-12 px-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>暂无模型。填好 API Key 后点「拉取模型」从厂商接口获取，也可手动添加。</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2">
          <input
            type="text"
            value={addModelDraft}
            onChange={(e) => setAddModelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) addModel()
            }}
            placeholder="输入模型 ID 后回车，如 deepseek-chat"
            spellCheck={false}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[11px] font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!addModelDraft.trim()}
            onClick={addModel}
            className="shrink-0"
          >
            添加
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ChatSectionProps {
  config: AgentModelConfig
  activeModelInfo: AgentProviderModelConfig | null
}

function ChatSection({ config, activeModelInfo }: ChatSectionProps): React.JSX.Element {
  const { updateConfig, saveConfig } = useAgentStore()
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
  const [contextDraft, setContextDraft] = useState<string | null>(null)
  const [maxTokensDraft, setMaxTokensDraft] = useState<string | null>(null)

  const apply = (patch: Partial<AgentModelConfig>): void => {
    updateConfig(patch)
    void saveConfig()
  }

  const promptValue = promptDraft ?? config.systemPrompt ?? ''
  const contextValue = contextDraft ?? config.contextWindow ?? ''
  const maxTokensValue = maxTokensDraft ?? config.maxTokens ?? ''
  const reasoningSupported = Boolean(activeModelInfo?.supportsReasoning)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5">
          创作者补充背景设定 (System Instruction)
        </label>
        <textarea
          value={promptValue}
          onChange={(e) => setPromptDraft(e.target.value)}
          onBlur={() => {
            apply({ systemPrompt: promptValue })
            setPromptDraft(null)
          }}
          placeholder="可填入决斗双方的角色性格（如海马的高傲狂妄、暗游戏的稳重热血）、作品同人世界观设定等..."
          rows={5}
          className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs resize-none leading-relaxed"
        />
      </div>

      {reasoningSupported ? (
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
          <input
            type="checkbox"
            checked={Boolean(config.enableReasoning)}
            onChange={(e) => apply({ enableReasoning: e.target.checked })}
            className="rounded border-border text-amber-500 focus:ring-amber-500"
          />
          <span>启用模型推理 / 思考链 (Reasoning)</span>
        </label>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          当前模型不支持思考链；在「模型设置」中切换到支持推理的模型（如 DeepSeek
          Reasoner）后此处可启用。
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div>
          <label className="block text-[11px] font-semibold mb-1">上下文窗口 (tokens)</label>
          <input
            type="number"
            min={1024}
            step={1024}
            value={contextValue}
            onChange={(e) => setContextDraft(e.target.value)}
            onBlur={() => {
              if (contextDraft === null) return
              apply({ contextWindow: contextDraft ? Number(contextDraft) : undefined })
              setContextDraft(null)
            }}
            placeholder="131072"
            className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1">单次回复上限 (tokens)</label>
          <input
            type="number"
            min={256}
            step={256}
            value={maxTokensValue}
            onChange={(e) => setMaxTokensDraft(e.target.value)}
            onBlur={() => {
              if (maxTokensDraft === null) return
              apply({ maxTokens: maxTokensDraft ? Number(maxTokensDraft) : undefined })
              setMaxTokensDraft(null)
            }}
            placeholder="8192"
            className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1.5">
        按所选模型实际能力填写（留空使用默认值），影响 token 估算与自动压缩。失焦后自动保存。
      </p>
    </div>
  )
}
