import React, { useState, useEffect, useRef, useMemo, JSX } from 'react'
import {
  Send,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Sliders,
  Check,
  Cog,
  Layers,
  Bot,
  Loader2
} from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { AgentProviderModelConfig, AgentStepProposal, isProviderReady } from '@shared/index'
import { AiProposalCard } from './AiProposalCard'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const MANAGE_KEY = 'action:manage'

interface MenuProvider {
  id: string
  name: string
  ready: boolean
  models: AgentProviderModelConfig[]
}

export function BehindSpiritPanel(): JSX.Element {
  const {
    isGenerating,
    config,
    messages,
    loadConfig,
    selectModel,
    resetSession,
    sendMessage,
    abort,
    applyProposalsToDuel
  } = useAgentStore()

  const { state: currentBoardState } = useDuelStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({})

  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [openProviderKey, setOpenProviderKey] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelMenuOpen])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  const providers = useMemo(() => config.providers ?? [], [config.providers])
  const activeProvider = useMemo(
    () => providers.find((p) => p.id === config.provider) ?? null,
    [providers, config.provider]
  )
  const activeModel = useMemo(
    () => activeProvider?.models.find((m) => m.id === config.model) ?? null,
    [activeProvider, config.model]
  )

  const chipLabel = activeProvider
    ? `${activeProvider.name}/${activeModel?.name ?? config.model}`
    : config.model || '未配置模型'

  const menuProviders = useMemo(
    (): MenuProvider[] =>
      providers
        .filter((p) => p.enabled !== false && p.models.some((m) => m.enabled))
        .map((p) => ({
          id: p.id,
          name: p.name,
          ready: isProviderReady(p),
          models: p.models.filter((m) => m.enabled)
        })),
    [providers]
  )

  const activeMenuKey = useMemo(() => {
    const provider = menuProviders.find((p) => p.id === config.provider)
    return provider ? provider.id : (menuProviders[0]?.id ?? MANAGE_KEY)
  }, [menuProviders, config.provider])

  const openProviderModels = useMemo(
    () => menuProviders.find((p) => p.id === openProviderKey)?.models ?? [],
    [menuProviders, openProviderKey]
  )

  const openMenu = (): void => {
    setOpenProviderKey(activeMenuKey)
    setModelMenuOpen(true)
  }

  const closeMenu = (): void => {
    setModelMenuOpen(false)
    setOpenProviderKey(null)
  }

  const pickModel = (providerId: string, modelId: string): void => {
    selectModel(providerId, modelId)
    closeMenu()
  }

  const openManage = (): void => {
    closeMenu()
    void window.api.openSettingsWindow()
  }

  const handleSend = (): void => {
    if (!inputPrompt.trim() || isGenerating) return
    sendMessage(inputPrompt, currentBoardState)
    setInputPrompt('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApplySteps = (proposals: AgentStepProposal[], messageId: string): void => {
    applyProposalsToDuel(proposals)
    setAppliedMessageId(messageId)
    setTimeout(() => setAppliedMessageId(null), 3000)
  }

  const toggleThought = (msgId: string): void => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }))
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-card/40">
      <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="text-xs font-bold text-foreground">背后灵</h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void resetSession()}
              title="清空对话并重置 AI 会话"
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-background/50">
        <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground select-none">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-3 border border-amber-500/20 shadow-xs">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-xs font-bold text-foreground">我是您的决斗创作者背后灵</h3>
              {!config.apiKey && (
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  尚未连接模型提供商：点击窗口左下角的「设置」补全 Key，
                  或在下方工具栏直接切换已配好的提供商与模型。
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 select-none">
                  {msg.role === 'user' ? (
                    <span>创作者</span>
                  ) : (
                    <span className="font-bold text-amber-600 dark:text-amber-400">背后灵</span>
                  )}
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>

                <div
                  className={`rounded-lg p-2.5 max-w-[95%] text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-neutral-950 font-medium'
                      : 'bg-card border border-border/80 text-foreground shadow-xs'
                  }`}
                >
                  {msg.thought && (
                    <div className="mb-2 border-b border-border/40 pb-2">
                      <button
                        type="button"
                        onClick={() => toggleThought(msg.id)}
                        className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>{expandedThoughts[msg.id] ? '收起思考过程' : '展开深度思考链'}</span>
                        {expandedThoughts[msg.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      {expandedThoughts[msg.id] && (
                        <div className="mt-1.5 p-2 rounded bg-neutral-100 dark:bg-neutral-900/80 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/30">
                          {msg.thought}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.toolCalls.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-200/50 dark:bg-neutral-800/60 font-mono text-[10px] text-neutral-600 dark:text-neutral-300"
                        >
                          <Sliders className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="font-bold">{t.toolName}</span>
                          {t.resultSummary && (
                            <span className="text-muted-foreground truncate">
                              ➔ {t.resultSummary}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.status && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span>{msg.status}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {isGenerating &&
                    msg.role === 'assistant' &&
                    msg === messages[messages.length - 1] && (
                      <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500 animate-pulse" />
                    )}

                  {msg.proposals && msg.proposals.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>生成战术步骤提案 ({msg.proposals.length})</span>
                        </span>

                        <Button
                          size="xs"
                          onClick={() => handleApplySteps(msg.proposals!, msg.id)}
                          className="h-6 text-[10px] gap-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
                        >
                          {appliedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>已同步步骤编排</span>
                            </>
                          ) : (
                            <>
                              <Layers className="w-3 h-3" />
                              <span>一键应用到决斗</span>
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        {msg.proposals.map((step, idx) => (
                          <AiProposalCard key={idx} proposal={step} index={idx} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-2.5 border-t border-border bg-card/80 flex flex-col gap-2 shrink-0">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed"
          />

          <div className="flex items-center justify-between gap-1.5" ref={toolbarRef}>
            <div className="flex items-center gap-1 min-w-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => (modelMenuOpen ? closeMenu() : openMenu())}
                  className={cn(
                    'h-6 px-1.5 rounded flex items-center gap-1 text-[11px] transition-colors max-w-[200px]',
                    modelMenuOpen
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      activeProvider && isProviderReady(activeProvider)
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    )}
                  />
                  <span className="font-medium truncate">{chipLabel}</span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                </button>

                {modelMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-1 flex items-start z-50">
                    <div className="w-52 bg-popover border border-border rounded-md overflow-hidden shadow-lg py-1">
                      {menuProviders.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground leading-4">
                          尚未配置可用模型，去「管理模型」连接供应商并拉取
                        </div>
                      ) : (
                        menuProviders.map((provider) => {
                          const isCurrent = provider.id === config.provider
                          const open = openProviderKey === provider.id
                          return (
                            <button
                              key={provider.id}
                              type="button"
                              onMouseEnter={() => setOpenProviderKey(provider.id)}
                              onClick={() => setOpenProviderKey(provider.id)}
                              className={cn(
                                'w-full px-2.5 py-1.5 flex items-center gap-2 text-left transition-colors',
                                open && 'bg-muted/60'
                              )}
                            >
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  provider.ready ? 'bg-emerald-500' : 'bg-amber-500'
                                )}
                              />
                              <span className="flex-1 min-w-0 truncate text-[11px] font-medium">
                                {provider.name}
                              </span>
                              {isCurrent && <Check className="w-3 h-3 text-amber-500 shrink-0" />}
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            </button>
                          )
                        })
                      )}

                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        onMouseEnter={() => setOpenProviderKey(MANAGE_KEY)}
                        onClick={openManage}
                        className={cn(
                          'w-full px-2.5 py-1.5 flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors',
                          openProviderKey === MANAGE_KEY && 'bg-muted/60'
                        )}
                      >
                        <Cog className="w-3 h-3 shrink-0" />
                        <span className="flex-1 text-left">管理模型</span>
                      </button>
                    </div>

                    {openProviderKey && openProviderKey !== MANAGE_KEY && (
                      <div className="ml-0.5 w-52 max-h-72 overflow-y-auto bg-popover border border-border rounded-md shadow-lg py-1">
                        {openProviderModels.length === 0 ? (
                          <div className="px-3 py-2 text-[11px] text-muted-foreground leading-4">
                            该供应商暂无可用模型，去「管理模型」拉取后即可选用
                          </div>
                        ) : (
                          openProviderModels.map((model) => {
                            const isCurrent =
                              openProviderKey === config.provider && config.model === model.id
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => pickModel(openProviderKey, model.id)}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-muted/60 transition-colors"
                              >
                                <span className="flex-1 min-w-0">
                                  <span className="block text-[11px] font-medium truncate">
                                    {model.name ?? model.id}
                                  </span>
                                  <span className="block font-mono text-[10px] text-muted-foreground truncate">
                                    {model.id}
                                  </span>
                                </span>
                                {model.supportsReasoning && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 shrink-0">
                                    推理
                                  </span>
                                )}
                                {isCurrent && <Check className="w-3 h-3 text-amber-500 shrink-0" />}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isGenerating ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={abort}
                className="h-7 px-3 text-xs gap-1 font-semibold"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>中断</span>
              </Button>
            ) : (
              <Button
                size="xs"
                onClick={handleSend}
                disabled={!inputPrompt.trim()}
                className="h-7 px-3 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold shadow-xs"
              >
                <Send className="w-3 h-3" />
                <span>发送</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
