import React, { useState, useEffect, useRef, useMemo, JSX } from 'react'
import { createPortal } from 'react-dom'
import {
  Send,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Bot,
  Check,
  Loader2,
  X,
  Paperclip,
  BookOpen
} from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import {
  AgentProviderModelConfig,
  AgentNovelSourceRef,
  countWords,
  isProviderReady,
  CdbCard,
  CardUtils
} from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { DuelProposalSummaryCard } from './DuelProposalSummaryCard'
import { MarkdownContent } from './MarkdownContent'
import { NovelSourcePicker } from './NovelSourcePicker'
import { ToolCallList } from './ToolCallList'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const MANAGE_KEY = 'action:manage'

const MAX_DRAGGED_TEXT_CHARS = 800_000

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
    applyDuelProposal
  } = useAgentStore()

  const { state: currentBoardState } = useDuelStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({})

  const [applyingProposalMsgId, setApplyingProposalMsgId] = useState<string | null>(null)
  const [proposalError, setProposalError] = useState<{ msgId: string; text: string } | null>(null)

  const [attachedCards, setAttachedCards] = useState<CdbCard[]>([])
  const [isCardDragOver, setIsCardDragOver] = useState(false)

  const [attachedNovel, setAttachedNovel] = useState<AgentNovelSourceRef | null>(null)
  const [novelPickerOpen, setNovelPickerOpen] = useState(false)
  const [novelPickerPos, setNovelPickerPos] = useState<{ right: number; bottom: number } | null>(
    null
  )
  const novelPickerAnchorRef = useRef<HTMLDivElement>(null)

  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [openProviderKey, setOpenProviderKey] = useState<string | null>(null)

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  const [modelMenuPos, setModelMenuPos] = useState<{ right: number; bottom: number } | null>(null)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node

      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(target) &&
        !modelMenuRef.current?.contains(target)
      ) {
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelMenuOpen])

  useEffect(() => {
    const chat = chatScrollRef.current
    if (!chat || !shouldAutoScrollRef.current) return

    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: isGenerating ? 'auto' : 'smooth'
    })
  }, [messages, isGenerating])

  const handleChatScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const chat = event.currentTarget
    shouldAutoScrollRef.current = chat.scrollHeight - chat.scrollTop - chat.clientHeight <= 64
  }

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

  const openProviderModels = useMemo(
    () => menuProviders.find((p) => p.id === openProviderKey)?.models ?? [],
    [menuProviders, openProviderKey]
  )

  const openMenu = (): void => {
    const anchor = toolbarRef.current
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      setModelMenuPos({
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.top
      })
    }
    setOpenProviderKey(null)
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
    void window.api.openSettingsWindow('model-settings')
  }

  const handleSend = (): void => {
    if ((!inputPrompt.trim() && attachedCards.length === 0 && !attachedNovel) || isGenerating)
      return
    shouldAutoScrollRef.current = true

    sendMessage(
      inputPrompt.trim() || (attachedNovel ? '请把附加的对局原文整理成可演示的对局流程' : ''),
      currentBoardState,
      buildInjectedPrompt(inputPrompt.trim(), attachedCards, attachedNovel),
      attachedCards.map((c) => ({ id: c.id, name: c.name })),
      attachedNovel ?? undefined
    )
    setInputPrompt('')
    setAttachedCards([])
    setAttachedNovel(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const buildCardsBlock = (cards: CdbCard[]): string => {
    const blocks = cards.map((c) => {
      const typeLabel = CardUtils.getCardTypeLabel(c.type)
      const isSpellOrTrap = CardUtils.isSpell(c.type) || CardUtils.isTrap(c.type)
      const stats = isSpellOrTrap
        ? ''
        : ` 攻${c.atk} / 防${c.def}${CardUtils.isLink(c.type) ? '' : ` / ${CardUtils.getStarLevel(c.level, c.type)}星`}`
      return [
        `【${c.name}】(${typeLabel}${stats})`,
        `卡密: ${c.id}`,
        c.desc ? `效果: ${c.desc}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    })
    return `【我参考的卡片】\n${blocks.join('\n\n')}`
  }

  const buildInjectedPrompt = (
    prompt: string,
    cards: CdbCard[],
    novel: AgentNovelSourceRef | null
  ): string => {
    const blocks: string[] = []
    if (cards.length > 0) blocks.push(buildCardsBlock(cards))
    if (novel) {
      const size = novel.wordCount ? `约 ${novel.wordCount} 字` : ''
      blocks.push(
        `【小说素材】已附加《${novel.title}》${size ? `（${size}）` : ''}。正文不随消息直接发送，请先用 read_novel_source 分段通读全文。`
      )
    }
    if (blocks.length === 0) return prompt
    return `${blocks.join('\n\n')}\n\n【我的问题】\n${prompt}`
  }

  const handleCardDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsCardDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(txt|md|markdown)$/i.test(f.name)
    )
    if (files.length > 0) {
      void handleFileDrop(files)
      return
    }

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as CdbCard
      if (typeof parsed?.id !== 'number' || !parsed.name) return
      setAttachedCards((prev) => (prev.some((c) => c.id === parsed.id) ? prev : [...prev, parsed]))
    } catch {
      void 0
    }
  }

  const handleFileDrop = async (files: File[]): Promise<void> => {
    const file = files[0]
    if (files.length > 1) {
      window.alert('一次只能附加一个文本文件，已取第一个')
    }
    try {
      const content = await file.text()
      if (!content.trim()) {
        window.alert('这个文件是空的')
        return
      }
      if (content.length > MAX_DRAGGED_TEXT_CHARS) {
        window.alert(
          `文件过大（${content.length} 字，上限 ${MAX_DRAGGED_TEXT_CHARS}）。请拆分后拖入，或先在资料库按章节导入`
        )
        return
      }

      setAttachedNovel({
        title: file.name,
        wordCount: countWords(content),
        content
      })
    } catch (err) {
      console.error('[BehindSpiritPanel] 读取拖入文件失败:', err)
      window.alert('读取文件失败，请确认文件未被占用')
    }
  }

  const removeAttachedCard = (cardId: number): void => {
    setAttachedCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const openNovelPicker = (): void => {
    if (novelPickerOpen) {
      setNovelPickerOpen(false)
      return
    }
    const anchor = novelPickerAnchorRef.current
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      setNovelPickerPos({
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.top
      })
    }
    setNovelPickerOpen(true)
  }

  const handleApplyProposal = async (messageId: string): Promise<void> => {
    const msg = useAgentStore.getState().messages.find((m) => m.id === messageId)
    if (!msg) return
    const fieldCards = useDuelStore.getState().state.cards
    if (fieldCards.length > 0) {
      const confirmed = window.confirm(
        `当前决斗盘上已有 ${fieldCards.length} 张卡。\n应用会把盘面清空并按提案重建，已排的步骤也会被替换。继续吗？`
      )
      if (!confirmed) return
    }
    setApplyingProposalMsgId(messageId)
    setProposalError(null)
    const res = await applyDuelProposal(msg.boardSetup ?? null, msg.proposals ?? [])
    setApplyingProposalMsgId(null)
    if (res.ok) {
      setAppliedMessageId(messageId)
      setTimeout(() => setAppliedMessageId(null), 3000)
    } else {
      setProposalError({ msgId: messageId, text: res.error ?? '应用失败' })
    }
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

      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setIsCardDragOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsCardDragOver(false)
        }}
        onDrop={handleCardDrop}
        className={cn(
          'flex-1 flex flex-col min-h-0 bg-background/50 relative transition-colors',
          isCardDragOver && 'bg-primary/5'
        )}
      >
        {isCardDragOver && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className="px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground text-[11px] font-semibold shadow-lg">
              松手附加到下一条提问
            </div>
          </div>
        )}

        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-3 space-y-3 select-text"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground select-none">
              <div className="p-3 rounded-2xl bg-muted text-muted-foreground mb-3 border border-border shadow-xs">
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
                    <span className="font-bold text-foreground">背后灵</span>
                  )}
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>

                <div
                  className={`rounded-lg p-2.5 max-w-[95%] min-w-0 text-xs leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'bg-muted text-foreground font-medium'
                      : 'bg-card border border-border/80 text-foreground shadow-xs'
                  }`}
                >
                  {msg.thought && (
                    <div className="mb-2 border-b border-border/40 pb-2">
                      <button
                        type="button"
                        onClick={() => toggleThought(msg.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold hover:text-foreground hover:underline"
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
                    <ToolCallList calls={msg.toolCalls} isStreaming={isGenerating} />
                  )}

                  {msg.status && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span>{msg.status}</span>
                    </div>
                  )}

                  {msg.role === 'user' && msg.novelSource && (
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        title="已附加的小说素材，正文经 read_novel_source 工具读取"
                        className="flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground min-w-0"
                      >
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-64">{msg.novelSource.title}</span>
                        {msg.novelSource.wordCount ? (
                          <span className="shrink-0 font-mono">
                            约 {msg.novelSource.wordCount} 字
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  {msg.attachedCards && msg.attachedCards.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                      {msg.attachedCards.map((c) => (
                        <span
                          key={c.id}
                          title={`卡密 ${c.id}`}
                          className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {msg.content}
                    </div>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  {isGenerating &&
                    msg.role === 'assistant' &&
                    msg === messages[messages.length - 1] && (
                      <span className="inline-block w-1.5 h-3 ml-1 bg-foreground animate-pulse" />
                    )}

                  {(msg.boardSetup || (msg.proposals && msg.proposals.length > 0)) && (
                    <DuelProposalSummaryCard
                      setup={msg.boardSetup}
                      proposals={msg.proposals ?? []}
                      applied={appliedMessageId === msg.id}
                      applying={applyingProposalMsgId === msg.id}
                      error={proposalError?.msgId === msg.id ? proposalError.text : null}
                      onApply={() => void handleApplyProposal(msg.id)}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 border-t border-border bg-card/80 flex flex-col gap-2 shrink-0">
          <div className="flex flex-col gap-2 rounded-md">
            {attachedCards.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachedCards.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-1.5 rounded border border-border bg-muted/60 pl-1.5 pr-1 py-1 max-w-full"
                  >
                    <img
                      src={getCardImageUrl(c.id, true)}
                      alt={c.name}
                      className="w-6 h-8 object-cover rounded-sm shrink-0 border border-border/60"
                      onError={(e) => {
                        const el = e.currentTarget
                        if (el.src !== CARD_BACK_IMAGE) el.src = CARD_BACK_IMAGE
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-tight truncate max-w-32">
                        {c.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono leading-tight">
                        {CardUtils.getCardTypeLabel(c.type)} · {c.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachedCard(c.id)}
                      title="移除这张卡片"
                      className="p-0.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachedNovel && (
              <div className="flex flex-wrap gap-1.5">
                <div className="group flex items-center gap-1.5 rounded border border-border bg-muted/60 pl-2 pr-1 py-1 max-w-full">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium leading-tight truncate max-w-52">
                      {attachedNovel.title}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-mono leading-tight">
                      {attachedNovel.wordCount ? `约 ${attachedNovel.wordCount} 字` : '文本素材'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedNovel(null)}
                    title="移除这本小说素材"
                    className="p-0.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedNovel
                  ? '已附加素材，说明要怎么整理这段对局即可...'
                  : attachedCards.length > 0
                    ? '已引用卡片，直接提问即可...'
                    : '输入消息...（enter发送，shift+enter换行）'
              }
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5" ref={toolbarRef}>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div ref={novelPickerAnchorRef} className="shrink-0">
                <button
                  type="button"
                  onClick={openNovelPicker}
                  title="附加素材：从资料库选章节；也可以把 txt / md 文件拖到面板任意位置"
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center transition-colors',
                    novelPickerOpen
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => (modelMenuOpen ? closeMenu() : openMenu())}
                  className={cn(
                    'h-6 w-full min-w-0 px-1.5 rounded flex items-center gap-1 text-[11px] transition-colors',
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
                        : 'bg-muted-foreground'
                    )}
                  />
                  <span className="font-medium truncate min-w-0">{chipLabel}</span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                </button>
              </div>
            </div>

            {isGenerating ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={abort}
                className="h-7 shrink-0 px-3 text-xs gap-1 font-semibold"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>中断</span>
              </Button>
            ) : (
              <Button
                size="xs"
                onClick={handleSend}
                disabled={!inputPrompt.trim() && attachedCards.length === 0}
                className="h-7 shrink-0 px-3 text-xs gap-1 font-semibold shadow-xs"
              >
                <Send className="w-3 h-3" />
                <span>发送</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {modelMenuOpen &&
        modelMenuPos &&
        createPortal(
          <div
            ref={modelMenuRef}
            style={{ right: modelMenuPos.right, bottom: modelMenuPos.bottom }}
            className="fixed z-[70] mb-1 w-52 max-w-[calc(100vw-1.5rem)]"
          >
            <div className="bg-popover border border-border rounded-md overflow-hidden shadow-lg py-1">
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
                          provider.ready ? 'bg-emerald-500' : 'bg-muted-foreground'
                        )}
                      />
                      <span className="flex-1 min-w-0 truncate text-[11px] font-medium">
                        {provider.name}
                      </span>
                      {isCurrent && <Check className="w-3 h-3 text-foreground shrink-0" />}
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
                <span className="flex-1 text-left">管理模型</span>
              </button>
            </div>

            {openProviderKey && openProviderKey !== MANAGE_KEY && (
              <div className="absolute bottom-0 left-full ml-0.5 w-52 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto bg-popover border border-border rounded-md shadow-lg py-1">
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
                          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                            推理
                          </span>
                        )}
                        {isCurrent && <Check className="w-3 h-3 text-foreground shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>,
          document.body
        )}

      {novelPickerOpen &&
        createPortal(
          <NovelSourcePicker
            pos={novelPickerPos}
            anchorRef={novelPickerAnchorRef}
            onClose={() => setNovelPickerOpen(false)}
            onAttach={(selection) => {
              setAttachedNovel(selection)
              setNovelPickerOpen(false)
            }}
          />,
          document.body
        )}
    </div>
  )
}
