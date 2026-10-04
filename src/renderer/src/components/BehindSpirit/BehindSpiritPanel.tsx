import React, { useState, useEffect, useRef, JSX } from 'react'
import {
  Settings2,
  Send,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Wrench,
  Check,
  Play,
  Sliders,
  Layers,
  Bot,
  PanelLeftClose,
  BookOpen
} from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { AgentStepProposal } from '@shared/index'
import { AiProposalCard } from './AiProposalCard'
import { Button } from '../ui/button'

const PRESET_ENDPOINTS = [
  {
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    reasoningModel: 'deepseek-reasoner'
  },
  {
    name: '通义千问 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    reasoningModel: 'qwen-max'
  },
  {
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    reasoningModel: 'deepseek-ai/DeepSeek-R1'
  },
  {
    name: 'Ollama 本地服务',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    reasoningModel: 'deepseek-r1:7b'
  }
]

export function BehindSpiritPanel(): JSX.Element {
  const {
    activeTab,
    isGenerating,
    config,
    messages,
    setActiveTab,
    updateConfig,
    loadConfig,
    saveConfig,
    clearMessages,
    sendMessage,
    abort,
    applyProposalsToDuel
  } = useAgentStore()

  const { state: currentBoardState, setActiveLeftTab, setLeftOpen } = useDuelStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({})

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

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

  const handleSaveConfig = async (): Promise<void> => {
    const success = await saveConfig()
    if (success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
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
      {/* 顶栏 Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-foreground">背后灵</h2>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 truncate max-w-[110px]">
                {config.model || '未配置'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeTab === 'chat' && messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              title="清空对话"
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <Button
            variant={activeTab === 'chat' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setActiveTab('chat')}
            className="h-6 text-[11px] px-2"
          >
            对话
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setActiveTab('settings')}
            className="h-6 text-[11px] px-2 gap-1"
          >
            <Settings2 className="w-3 h-3" />
            <span>设置</span>
          </Button>
          <button
            type="button"
            onClick={() => setActiveLeftTab('card')}
            title="切回卡片详情"
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLeftOpen(false)}
            title="收起左侧面板"
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 主体内容 */}
      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          {/* 消息历史滚动区 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground select-none">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-3 border border-amber-500/20 shadow-xs">
                  <Bot className="w-7 h-7" />
                </div>
                <h3 className="text-xs font-bold text-foreground">我是您的决斗创作者背后灵</h3>
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

                  {/* 消息正文气泡 */}
                  <div
                    className={`rounded-lg p-2.5 max-w-[95%] text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-neutral-950 font-medium'
                        : 'bg-card border border-border/80 text-foreground shadow-xs'
                    }`}
                  >
                    {/* 思考过程折叠区 */}
                    {msg.thought && (
                      <div className="mb-2 border-b border-border/40 pb-2">
                        <button
                          type="button"
                          onClick={() => toggleThought(msg.id)}
                          className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                          <span>
                            {expandedThoughts[msg.id] ? '收起思考过程' : '展开深度思考链'}
                          </span>
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

                    {/* 工具调用动态列表 */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {msg.toolCalls.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-200/50 dark:bg-neutral-800/60 font-mono text-[10px] text-neutral-600 dark:text-neutral-300"
                          >
                            <Wrench className="w-3 h-3 text-amber-500 shrink-0" />
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

                    {/* 内容文字 */}
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* 生成中的脉冲指示 */}
                    {isGenerating &&
                      msg.role === 'assistant' &&
                      msg === messages[messages.length - 1] && (
                        <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500 animate-pulse" />
                      )}

                    {/* 战术步骤提案卡片组 */}
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

          {/* 底部输入框 */}
          <div className="p-2.5 border-t border-border bg-card/80 flex flex-col gap-2 shrink-0">
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed"
            />

            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1.5">
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
      ) : (
        /* 设置 Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-background/50">
          <div className="space-y-2">
            <h3 className="font-bold text-foreground">快速预设服务商</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_ENDPOINTS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() =>
                    updateConfig({
                      baseUrl: item.baseUrl,
                      model: item.model
                    })
                  }
                  className="p-2 rounded border border-border bg-card hover:bg-muted text-left transition-colors text-[11px]"
                >
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.model}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                API Base URL
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                密钥仅保存在本地用户数据目录中，绝不上报云端。
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                模型名称 (Model)
              </label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                placeholder="deepseek-chat"
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-foreground text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(config.enableReasoning)}
                  onChange={(e) => updateConfig({ enableReasoning: e.target.checked })}
                  className="rounded border-border text-amber-500 focus:ring-amber-500"
                />
                <span>启用模型推理/思考链 (Reasoning / Thinking)</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                创作者补充背景设定 (System Instruction)
              </label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                placeholder="可填入决斗双方的角色性格（如海马的高傲狂妄、暗游戏的稳重热血）、作品同人世界观设定等..."
                rows={4}
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <Button
              size="sm"
              onClick={handleSaveConfig}
              className="gap-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已保存设置</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>保存模型配置</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
