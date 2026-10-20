import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'
import {
  AgentApiFormat,
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset,
  AGENT_API_FORMAT_LABELS,
  AGENT_API_FORMAT_VALUES,
  cleanAgentApiKey,
  isLocalEndpoint,
  normalizeAgentApiFormat
} from '@shared/index'
import { useAgentStore } from '../../../stores/useAgentStore'
import { useAgentModelFetch } from '../../../hooks/useAgentModelFetch'
import { formatContextWindow, mergeFetchedModels } from '../../../utils/agentModelFormat'
import { Button } from '../../ui/button'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ProviderLogo } from './ProviderLogo'
import { ModelEditorModal } from './ModelEditorModal'
import { StatusDot } from './ProviderNavItem'
import { resolveProviderStatus } from '../../../utils/agentModelFormat'
import { cn } from '../../../lib/utils'

interface ProviderDetailPanelProps {
  provider: AgentProviderConfig
  preset: AgentProviderPreset | null
  activeProviderId?: string
  activeModelId: string
  onUpsert: (provider: AgentProviderConfig) => void
  onRemove: () => void
  onSelectModel: (providerId: string, modelId: string) => void
}

export function ProviderDetailPanel({
  provider,
  preset,
  activeProviderId,
  activeModelId,
  onUpsert,
  onRemove,
  onSelectModel
}: ProviderDetailPanelProps): React.JSX.Element {
  const { upsertProviderModel, removeProviderModel, setProviderModelEnabled } = useAgentStore()
  const { supported, fetchModels } = useAgentModelFetch()

  const [urlDraft, setUrlDraft] = useState(provider.baseUrl)
  const [keyDraft, setKeyDraft] = useState(provider.apiKey)
  const [nameDraft, setNameDraft] = useState(provider.name)
  const [showKey, setShowKey] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [modelModal, setModelModal] = useState<{
    mode: 'add' | 'edit'
    initial: AgentProviderModelConfig | null
  } | null>(null)
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

  const canActivate = provider.apiKey.trim().length > 0 || isLocalEndpoint(provider.baseUrl)

  const commit = (patch: Partial<AgentProviderConfig>, selectModelId?: string): void => {
    const next: AgentProviderConfig = { ...provider, ...patch }
    onUpsert(next)
    if (selectModelId) onSelectModel(next.id, selectModelId)
  }

  const validateKey = async (
    baseUrl: string,
    apiKey: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!supported || !baseUrl.trim()) return { ok: true }
    const probe = await fetchModels({ baseUrl, apiKey: cleanAgentApiKey(apiKey) })
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

  const submitModel = (model: AgentProviderModelConfig): void => {
    upsertProviderModel(provider.id, model)
    setModelModal(null)
  }

  const pullModels = async (source?: { baseUrl: string; apiKey: string }): Promise<void> => {
    if (!supported) return
    const baseUrl = (source?.baseUrl ?? urlDraft).trim()
    const apiKey = cleanAgentApiKey(source?.apiKey ?? keyDraft)
    setModelsBusy(true)
    setModelsError('')
    const res = await fetchModels({ baseUrl, apiKey })
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
    if (!supported) return
    setTesting(true)
    setTestResult(null)
    const probe = await fetchModels({
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
          <ProviderLogo presetId={provider.presetId} className="w-5 h-5 shrink-0" />
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
            <div className="flex min-w-0 items-center gap-1.5">
              <StatusDot status={resolveProviderStatus(provider)} />
              <div className="text-xs font-semibold truncate">{provider.name}</div>
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
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setRenaming(true)}
              className="text-muted-foreground"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
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
                {isCustom && (
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
                )}
                <button
                  type="button"
                  onClick={onRemove}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isCustom ? '删除' : '移除该供应商'}</span>
                </button>
              </div>
            )}
          </div>
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
          <SelectTrigger
            size="sm"
            className="w-full text-[11px] border-border bg-background dark:bg-background dark:hover:bg-background"
          >
            <SelectValue>
              {(value) => AGENT_API_FORMAT_LABELS[normalizeAgentApiFormat(value as string)]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-auto min-w-44 p-1">
            {AGENT_API_FORMAT_VALUES.map((format) => (
              <SelectItem key={format} value={format} className="text-[11px] py-1.5 pr-7 pl-2">
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
          <div className="relative flex-1 min-w-0">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => void commitKey()}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="输入 API Key"
              spellCheck={false}
              className="w-full px-2.5 py-1.5 pr-8 rounded-lg border border-border bg-background text-[11px] font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute top-1/2 right-1 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
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
              className="gap-1"
            >
              <RefreshCw className={cn('w-3 h-3', modelsBusy && 'animate-spin')} />
              <span>拉取模型</span>
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setModelModal({ mode: 'add', initial: null })}
              className="gap-1"
            >
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
                    onClick={() => setModelModal({ mode: 'edit', initial: model })}
                    className="shrink-0 text-muted-foreground"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => removeProviderModel(provider.id, model.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <Switch
                    checked={model.enabled}
                    onCheckedChange={(v) => setProviderModelEnabled(provider.id, model.id, v)}
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
      </div>

      {modelModal && (
        <ModelEditorModal
          mode={modelModal.mode}
          provider={provider}
          initial={modelModal.initial}
          existingIds={provider.models
            .filter((m) => m.id !== modelModal.initial?.id)
            .map((m) => m.id)}
          onClose={() => setModelModal(null)}
          onSubmit={submitModel}
        />
      )}
    </div>
  )
}
