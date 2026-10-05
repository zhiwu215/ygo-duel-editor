import React, { useState, useEffect, useMemo } from 'react'
import {
  Plug,
  KeyRound,
  Cpu,
  Check,
  Loader2,
  RefreshCw,
  Plus,
  Unplug,
  Eye,
  EyeOff,
  FlaskConical
} from 'lucide-react'
import {
  AgentModelConfig,
  AgentProviderPreset,
  AgentProviderConnection,
  AgentModelInfo
} from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { Button } from '../ui/button'

/** 设置窗中 AI 顾问部分的三个分区（由 SettingsApp 左侧导航驱动） */
export type AgentSettingsSection = 'providers' | 'models' | 'chat'

interface AgentSettingsContentProps {
  section: AgentSettingsSection
  /** 连接成功后跳转到「模型」分区等导航请求 */
  onNavigate?: (section: AgentSettingsSection) => void
}

/** 混淆 API Key：仅显示前 4 与后 4 位 */
function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}

/** 通用凭据清洗：去除首尾空格、外层引号与不可见字符 */
function cleanApiKey(key: string): string {
  return key
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/** 将当前配置聚合为「已连接提供商」视图 */
function toConnection(
  cfg: AgentModelConfig,
  presets: AgentProviderPreset[]
): AgentProviderConnection {
  const preset = presets.find((p) => p.baseUrl === cfg.baseUrl)
  return {
    id: preset?.id || 'custom',
    name: preset?.name || cfg.provider || '自定义提供商',
    baseUrl: cfg.baseUrl,
    kind: preset ? 'preset' : 'custom',
    hasApiKey: Boolean(cfg.apiKey.trim()),
    model: cfg.model
  }
}

/**
 * AI 顾问设置内容（提供商 / 模型 / 对话三个分区）。
 *
 * 与旧版模态弹窗的差异：所有改动即时落盘 (VSCode/OpenCode 式即时生效)，
 * 文本类输入在失焦时提交，避免每个按键都写配置文件。
 */
export const AgentSettingsContent: React.FC<AgentSettingsContentProps> = ({
  section,
  onNavigate
}) => {
  const { config, updateConfig, saveConfig } = useAgentStore()

  const [draft, setDraft] = useState<AgentModelConfig>(() => ({ ...config }))
  const [presets, setPresets] = useState<AgentProviderPreset[]>([])
  const [connectingId, setConnectingId] = useState<string | null>(null)
  /** 连接校验进行中 / 校验失败的提示（显示在连接行内） */
  const [connectingBusy, setConnectingBusy] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [modelsList, setModelsList] = useState<AgentModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [manualModel, setManualModel] = useState('')
  /** 「测试连接」探针的进行中状态与结果 */
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  /** 已连接状态下的「修改密钥」内联状态 */
  const [isEditingKey, setIsEditingKey] = useState(false)
  const [editKeyInput, setEditKeyInput] = useState('')
  const [showEditKey, setShowEditKey] = useState(false)
  const [editKeyBusy, setEditKeyBusy] = useState(false)
  const [editKeyError, setEditKeyError] = useState('')

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        if (window.api?.agentGetProviderPresets)
          setPresets(await window.api.agentGetProviderPresets())
      } catch {
        setPresets([])
      }
    })()
  }, [])

  const connected = useMemo((): AgentProviderConnection | null => {
    if (!draft.baseUrl?.trim()) return null
    return toConnection(draft, presets)
  }, [draft, presets])

  /** 即时落盘：更新本地草稿 + store + 配置文件 */
  const apply = (next: AgentModelConfig): void => {
    setDraft(next)
    updateConfig(next)
    void saveConfig()
  }

  // 拉取模型列表（凭据用入参显式传入：连接后立即拉取时，本次渲染闭包里的 draft 可能还是旧值）
  const refreshModels = async (override?: { baseUrl?: string; apiKey?: string }): Promise<void> => {
    if (!window.api?.agentFetchModels) return
    const baseUrl = override?.baseUrl ?? draft.baseUrl
    const apiKey = override?.apiKey ?? draft.apiKey
    if (!baseUrl?.trim()) return
    setModelsLoading(true)
    setModelsError('')
    setModelsList([])
    const res = await window.api.agentFetchModels({
      baseUrl,
      apiKey: apiKey || ''
    })
    if (res.success && res.models) {
      setModelsList(res.models)
    } else {
      setModelsError(res.error || '拉取失败')
    }
    setModelsLoading(false)
  }

  // 进入「模型」分区时自动拉取厂商模型列表（延迟到定时器内触发，避免 effect 内同步 setState）
  useEffect(() => {
    if (section !== 'models') return
    const timer = setTimeout(() => {
      void refreshModels()
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  /** 断开当前提供商（清空 Key 并立即落盘，保留 baseUrl 以便重连） */
  const disconnect = (): void => {
    apply({ ...draft, apiKey: '', model: '' })
    setTestResult(null)
  }

  /** 从预设发起连接 */
  const connectPreset = (p: AgentProviderPreset): void => {
    setConnectingId(p.id)
    setKeyInput('')
    setConnectError('')
    setDraft((d) => ({ ...d, baseUrl: p.baseUrl, model: d.model || p.model }))
  }

  /**
   * 实测凭据是否被厂商接受：HTTP 401 说明 key 被明确拒绝，此时不允许保存，
   * 避免把无效密钥写进配置后 chat 与拉取全部连锁失败（厂商其余错误不拦，允许连接）
   */
  /**
   * 实测凭据是否被厂商接受：HTTP 401 说明 key 被明确拒绝，此时不允许保存，
   * 避免把无效密钥写进配置后 chat 与拉取全部连锁失败（厂商其余错误不拦，允许连接）
   */
  /**
   * 实测凭据是否被厂商接受：HTTP 401 说明 key 被明确拒绝，此时不允许保存，
   * 避免把无效密钥写进配置后 chat 与拉取全部连锁失败（厂商其余错误不拦，允许连接）
   */
  const validateCredential = async (
    baseUrl: string,
    apiKey: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!window.api?.agentFetchModels) return { ok: true }
    const cleaned = cleanApiKey(apiKey)
    const probe = await window.api.agentFetchModels({ baseUrl, apiKey: cleaned })
    if (probe.success) return { ok: true }
    const err = probe.error || '未知错误'
    if (err.includes('HTTP 401') || err.includes('身份验证失败')) {
      return { ok: false, error: err }
    }
    return { ok: true, error: err }
  }

  /** 保存修改后的密钥并重新验证 */
  const saveEditedKey = async (): Promise<void> => {
    const cleaned = cleanApiKey(editKeyInput)
    if (!cleaned) return
    setEditKeyBusy(true)
    setEditKeyError('')
    const check = await validateCredential(draft.baseUrl, cleaned)
    setEditKeyBusy(false)
    if (!check.ok) {
      setEditKeyError(check.error || '密钥校验失败')
      return
    }
    apply({
      ...draft,
      apiKey: cleaned
    })
    setIsEditingKey(false)
    setTestResult({ ok: true, message: '密钥更新成功并已验证通过' })
    void refreshModels({ baseUrl: draft.baseUrl, apiKey: cleaned })
  }

  /** 确认连接（预设）：实测通过后立即落盘，再带上刚输入的凭据拉取模型列表 */
  const confirmPresetKey = async (): Promise<void> => {
    const preset = presets.find((p) => p.id === connectingId)
    if (!preset) return
    const cleaned = cleanApiKey(keyInput)
    if (!cleaned) return
    setConnectingBusy(true)
    setConnectError('')
    const check = await validateCredential(preset.baseUrl, cleaned)
    setConnectingBusy(false)
    if (!check.ok) {
      setConnectError(check.error || '密钥校验失败')
      return
    }
    apply({
      ...draft,
      baseUrl: preset.baseUrl,
      apiKey: cleaned,
      model: draft.model || preset.model
    })
    setConnectingId(null)
    setKeyInput('')
    setTestResult(null)
    onNavigate?.('models')
    void refreshModels({ baseUrl: preset.baseUrl, apiKey: cleaned })
  }

  /** 连接自定义提供商：实测通过后立即落盘 */
  const connectCustom = async (): Promise<void> => {
    if (!customUrl.trim()) return
    const baseUrl = customUrl.trim()
    const cleaned = cleanApiKey(customKey)
    setConnectingBusy(true)
    setConnectError('')
    const check = await validateCredential(baseUrl, cleaned)
    setConnectingBusy(false)
    if (!check.ok) {
      setConnectError(check.error || '密钥校验失败')
      return
    }
    apply({
      ...draft,
      provider: 'custom-openai',
      baseUrl,
      apiKey: cleaned,
      model: customModel.trim() || draft.model
    })
    setCustomUrl('')
    setCustomKey('')
    setCustomModel('')
    setTestResult(null)
    onNavigate?.('models')
    void refreshModels({ baseUrl, apiKey: cleaned })
  }

  /** 实测当前已保存凭据的连通性（「连接不上」时的第一手诊断信息） */
  const testConnection = async (): Promise<void> => {
    if (!window.api?.agentFetchModels) return
    setTesting(true)
    setTestResult(null)
    const cleaned = cleanApiKey(draft.apiKey)
    const probe = await window.api.agentFetchModels({
      baseUrl: draft.baseUrl,
      apiKey: cleaned
    })
    setTesting(false)
    setTestResult(
      probe.success
        ? { ok: true, message: `连接成功，厂商返回 ${probe.models?.length ?? 0} 个可用模型` }
        : { ok: false, message: probe.error || '连接失败（请检查接口地址、密钥与网络）' }
    )
  }

  /** 选用模型（即时落盘） */
  const pickModel = (id: string): void => {
    apply({ ...draft, model: id })
    setManualModel('')
  }

  return (
    <div className="text-xs">
      {/* ============ 提供商 ============ */}
      {section === 'providers' && (
        <div className="space-y-4">
          {/* 已连接 */}
          <section>
            <h3 className="text-xs font-bold text-foreground mb-1.5">已连接</h3>
            {connected && connected.hasApiKey ? (
              <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="p-2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{connected.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {connected.kind === 'preset' ? '预设' : '自定义'}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {connected.baseUrl} · {maskApiKey(draft.apiKey)} · {draft.model || '未选模型'}
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setIsEditingKey((v) => !v)
                      setEditKeyInput(draft.apiKey)
                      setEditKeyError('')
                    }}
                    className="gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>修改密钥</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void testConnection()}
                    disabled={testing}
                    className="gap-1"
                  >
                    {testing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="w-3.5 h-3.5" />
                    )}
                    <span>测试连接</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={disconnect}
                    className="gap-1 text-muted-foreground hover:text-destructive"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>断开</span>
                  </Button>
                </div>
                {/* 密钥修改抽屉 */}
                {isEditingKey && (
                  <div className="px-3 pb-3 pt-2 border-t border-border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium">
                        <KeyRound className="w-3 h-3 text-amber-500" />
                        更新 {connected.name} 的 API Key
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        （仅保存在本地设备）
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type={showEditKey ? 'text' : 'password'}
                        value={editKeyInput}
                        onChange={(e) => {
                          setEditKeyInput(e.target.value)
                          setEditKeyError('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && void saveEditedKey()}
                        placeholder="输入 API Key"
                        autoFocus
                        className="flex-1 px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
                      />
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowEditKey((v) => !v)}
                        className="text-muted-foreground"
                      >
                        {showEditKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => void saveEditedKey()}
                        disabled={!editKeyInput.trim() || editKeyBusy}
                        className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
                      >
                        {editKeyBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          '保存并验证'
                        )}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setIsEditingKey(false)}
                        disabled={editKeyBusy}
                      >
                        取消
                      </Button>
                    </div>
                    {editKeyError && (
                      <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 break-all">
                        {editKeyError}
                      </div>
                    )}
                  </div>
                )}
                {testResult && (
                  <div
                    className={
                      testResult.ok
                        ? 'px-3 py-2 border-t border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-600 dark:text-emerald-400 break-all'
                        : 'px-3 py-2 border-t border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all'
                    }
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground text-center">
                尚未连接任何提供商，请在下方选择常用提供商或添加自定义提供商。
              </div>
            )}
          </section>

          {/* 常用提供商 */}
          <section>
            <h3 className="text-xs font-bold text-foreground mb-1.5">常用提供商</h3>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-card/60">
              {presets.map((p) => {
                const isConnected = connected?.id === p.id && connected.hasApiKey
                const isConnecting = connectingId === p.id
                return (
                  <div key={p.id}>
                    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="p-1.5 rounded bg-muted text-foreground/80">
                        <Plug className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                          {p.baseUrl}
                        </div>
                      </div>
                      {isConnected ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          已连接
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => connectPreset(p)}
                          className="gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>连接</span>
                        </Button>
                      )}
                    </div>
                    {/* Key 输入展开区 */}
                    {isConnecting && (
                      <div className="px-3 pb-3 pt-1 bg-muted/20 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <KeyRound className="w-3 h-3" />
                          输入 {p.name} 的 API Key（仅保存在本地）
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void confirmPresetKey()}
                            placeholder="sk-..."
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
                          />
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setShowKey((v) => !v)}
                            className="text-muted-foreground"
                          >
                            {showKey ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            size="xs"
                            onClick={() => void confirmPresetKey()}
                            disabled={!keyInput.trim() || connectingBusy}
                            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
                          >
                            {connectingBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              '确认连接'
                            )}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setConnectingId(null)
                              setConnectError('')
                            }}
                          >
                            取消
                          </Button>
                        </div>
                        {connectError && connectingId && (
                          <div className="px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all">
                            {connectError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 自定义提供商 */}
          <section>
            <h3 className="text-xs font-bold text-foreground mb-1.5">自定义提供商</h3>
            <div className="rounded-lg border border-border p-3 space-y-2 bg-card/60">
              <p className="text-[11px] text-muted-foreground">
                任何 OpenAI 兼容接口（含 LM Studio / vLLM / 中转网关）均可接入，Pi Agent
                会按接口地址自动适配协议差异。
              </p>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="API Base URL，如 https://your-gateway.example.com/v1"
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
              />
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="API Key（可选）"
                  className="flex-1 px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
                />
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="默认模型（可选）"
                  className="flex-1 px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
                />
                <Button
                  size="xs"
                  onClick={() => void connectCustom()}
                  disabled={!customUrl.trim() || connectingBusy}
                  className="gap-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold shrink-0"
                >
                  {connectingBusy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  <span>连接</span>
                </Button>
              </div>
              {connectError && !connectingId && (
                <div className="px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all">
                  {connectError}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ============ 模型 ============ */}
      {section === 'models' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold">从接口拉取模型列表</div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">
                {draft.baseUrl || '未设置接口地址'}
              </div>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => void refreshModels()}
              disabled={modelsLoading || !draft.baseUrl}
              className="gap-1 shrink-0"
            >
              {modelsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>刷新列表</span>
            </Button>
          </div>

          {modelsError && (
            <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-[11px] text-destructive">
              {modelsError}
            </div>
          )}
          {!draft.apiKey && !modelsError && (
            <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400">
              未配置 API Key，部分厂商可能拒绝拉取（401），也可继续手动填写模型名。
            </div>
          )}

          {modelsList.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto bg-card/60">
              {modelsList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickModel(m.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono truncate flex-1">{m.id}</span>
                  {draft.model === m.id && (
                    <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            !modelsLoading &&
            !modelsError && (
              <div className="p-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground text-center">
                尚未拉取到模型列表
              </div>
            )
          )}

          {/* 手动填写模型（列表拉取失败时的兜底） */}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && manualModel.trim() && pickModel(manualModel.trim())
              }
              placeholder="手动填写模型名称 (如 deepseek-chat)"
              className="flex-1 px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
            />
            <Button
              size="xs"
              variant="outline"
              disabled={!manualModel.trim()}
              onClick={() => pickModel(manualModel.trim())}
            >
              使用
            </Button>
          </div>
        </div>
      )}

      {/* ============ 对话 ============ */}
      {section === 'chat' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              创作者补充背景设定 (System Instruction)
            </label>
            <textarea
              value={draft.systemPrompt || ''}
              onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
              onBlur={() => apply({ ...draft })}
              placeholder="可填入决斗双方的角色性格（如海马的高傲狂妄、暗游戏的稳重热血）、作品同人世界观设定等..."
              rows={5}
              className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-xs resize-none leading-relaxed"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={Boolean(draft.enableReasoning)}
              onChange={(e) => apply({ ...draft, enableReasoning: e.target.checked })}
              className="rounded border-border text-amber-500 focus:ring-amber-500"
            />
            <span>启用模型推理 / 思考链 (Reasoning)</span>
          </label>
          <p className="text-[10px] text-muted-foreground -mt-2">
            仅对支持思考链的模型（如 deepseek-reasoner）生效。
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-semibold mb-1">上下文窗口 (tokens)</label>
              <input
                type="number"
                min={1024}
                step={1024}
                value={draft.contextWindow ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    contextWindow: e.target.value ? Number(e.target.value) : undefined
                  }))
                }
                onBlur={() => apply({ ...draft })}
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
                value={draft.maxTokens ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxTokens: e.target.value ? Number(e.target.value) : undefined
                  }))
                }
                onBlur={() => apply({ ...draft })}
                placeholder="8192"
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1.5">
            按所选模型实际能力填写（留空使用默认值），影响 token 估算与自动压缩。失焦后自动保存。
          </p>
        </div>
      )}
    </div>
  )
}
