import { BrowserWindow } from 'electron'
import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import {
  AgentModelConfig,
  AgentModelInfo,
  AgentProviderPreset,
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent,
  DuelPuzzleState,
  isLocalEndpoint,
  normalizeWebSearchConfig,
  resolveActiveRuntime
} from '@shared/index'
import { fetchModels as fetchModelList } from './agent/modelCatalog'
import {
  acquireSession,
  disposeSession,
  getCachedSession,
  type SessionConfig
} from './agent/piSessionFactory'
import { getProviderPresets } from './agent/providerPresets'
import { createGetCardInfoTool } from './agent/tools/getCardInfo'
import { createGetCurrentBoardTool } from './agent/tools/getCurrentBoard'
import { createReadTextSourceTool } from './agent/tools/readTextSource'
import { createSearchCardsTool } from './agent/tools/searchCards'
import { createWebFetchTool } from './agent/tools/webFetch'
import { createWebSearchTool } from './agent/tools/webSearch'
import type { AgentToolDeps, AgentTextSource } from './agent/tools/toolDeps'
import { configService } from './configService'
import { libraryService } from './libraryService'

const AGENT_WATCHDOG_TIMEOUT_MS = 600_000

interface PiAssistantMessage {
  role: 'assistant'
  stopReason: string
  errorMessage?: string
}

export class AgentService {
  private currentBoardState: DuelPuzzleState | null = null

  private currentTextSource: AgentTextSource | null = null

  private streamText = ''
  private streamThought = ''
  private currentQuestion: string | undefined

  private emitEvent(event: AgentStreamEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:event', event)
      }
    }
  }

  public async abort(): Promise<boolean> {
    const session = getCachedSession()
    const wasActive = session ? !session.isIdle : false
    if (wasActive) {
      try {
        await session?.abort()
      } catch {
        void 0
      }
    }
    return wasActive
  }

  public resetSession(): boolean {
    if (!disposeSession()) return false
    this.emitEvent({ type: 'status', message: '已开启新的 AI 会话' })
    return true
  }

  public getProviderPresets(): AgentProviderPreset[] {
    return getProviderPresets()
  }

  public async fetchModels(
    baseUrl: string,
    apiKey: string
  ): Promise<{ success: boolean; models?: AgentModelInfo[]; error?: string }> {
    return fetchModelList(baseUrl, apiKey)
  }
  public async sendMessage(params: AgentSendMessageParams): Promise<AgentSendMessageResult> {
    await this.abort()
    this.currentQuestion = params.question ?? params.prompt
    this.currentBoardState = params.boardState || null
    this.currentTextSource = null
    const textRef = params.textSource
    const directText = textRef?.content?.trim()
    if (directText) {
      this.currentTextSource = {
        textId: textRef?.textId ?? '',
        chapterId: textRef?.chapterId ?? '',
        title: textRef?.title?.trim() || '附加文本',
        content: directText
      }
    } else if (textRef?.textId && (textRef.chapterIds?.length || textRef.chapterId)) {
      const chapterIds = textRef.chapterIds?.length ? textRef.chapterIds : [textRef.chapterId!]
      const contents = libraryService.getTextChapters(textRef.textId)
      const picked = contents
        .filter((c) => chapterIds.includes(c.id))
        .sort((a, b) => chapterIds.indexOf(a.id) - chapterIds.indexOf(b.id))
      if (picked.length === 0) {
        this.emitEvent({
          type: 'status',
          message: `文本素材《${textRef.title}》读取失败（可能已被删除或重新拆分），本次按无素材处理`
        })
      } else {
        this.currentTextSource = {
          textId: textRef.textId,
          chapterId: picked[0].id,
          title: textRef.title.trim() || textRef.textId,
          content: picked.map((c) => c.content || '').join('\n\n'),
          chapters: picked.map((c) => ({ title: c.title, content: c.content || '' }))
        }
      }
    }
    const appConfig = configService.get()
    const merged = {
      ...(appConfig.agentConfig ?? { baseUrl: '', apiKey: '', model: '' }),
      ...(params.configOverride ?? {})
    } as AgentModelConfig
    const runtime = resolveActiveRuntime(merged)
    const webConfig = normalizeWebSearchConfig(appConfig.webSearch)
    const webEnabled = webConfig.enabled
    const cfg: SessionConfig = {
      providers: merged.providers,
      provider: runtime.providerId,
      baseUrl: runtime.baseUrl || 'https://api.deepseek.com/v1',
      apiKey: runtime.apiKey,
      model: runtime.model || 'deepseek-chat',
      apiFormat: runtime.apiFormat,
      systemPrompt: merged.systemPrompt || '',
      webEnabled,
      reasoningEfforts: runtime.reasoningEfforts,
      reasoningEffort: runtime.reasoningEffort,
      contextWindow: runtime.contextWindow,
      maxTokens: runtime.maxTokens,
      input: runtime.input,
      supportsStructuredOutput: runtime.supportsStructuredOutput,
      supportsMidConversationSystem: runtime.supportsMidConversationSystem
    }

    if (!cfg.apiKey && !isLocalEndpoint(cfg.baseUrl)) {
      const errMsg = '请先在「设置 → 模型」中配置 API Key'
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    const deps: AgentToolDeps = {
      emitEvent: (event) => this.emitEvent(event),
      getBoardState: () => this.currentBoardState,
      getTextSource: () => this.currentTextSource,
      getCurrentQuestion: () => this.currentQuestion
    }
    const tools: ToolDefinition[] = [
      createSearchCardsTool(deps),
      createGetCardInfoTool(deps),
      createGetCurrentBoardTool(deps),
      createReadTextSourceTool(deps)
    ]
    if (webEnabled) {
      tools.push(createWebSearchTool(deps), createWebFetchTool(deps))
    }

    try {
      const session = await acquireSession(cfg, tools, {
        emitEvent: (event) => this.emitEvent(event),
        onTextDelta: (delta) => {
          this.streamText += delta
        },
        onThinkingDelta: (delta) => {
          this.streamThought += delta
        }
      })

      this.streamText = ''
      this.streamThought = ''

      const watchdog = setTimeout(() => {
        void this.abort()
      }, AGENT_WATCHDOG_TIMEOUT_MS)

      try {
        await session.prompt(`【创作者本次提出的剧情与战术需求】\n${params.prompt}`)
      } finally {
        clearTimeout(watchdog)
      }

      const lastAssistantMsg = [...session.messages]
        .reverse()
        .find((m) => (m as PiAssistantMessage).role === 'assistant')
      const lastAssistant = lastAssistantMsg as PiAssistantMessage | undefined

      if (lastAssistant?.stopReason === 'error') {
        const errMsg = lastAssistant.errorMessage || '模型请求失败（未返回具体错误信息）'
        console.error('[AgentService] Model request failed:', errMsg)
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }
      if (lastAssistant?.stopReason === 'aborted') {
        const errMsg = '生成已中断'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      if (lastAssistant?.stopReason === 'length') {
        const errMsg = this.streamText
          ? '回答达到模型的最大输出上限被截断，内容不完整。请在「设置 → 模型设置」中调高该模型的「最大输出 token 数」后重试。'
          : '模型把最大输出配额用在了思考上，没有给出回答。请在「设置 → 模型设置」中调高该模型的「最大输出 token 数」，或降低推理等级后重试。'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }
      if (!lastAssistant || !this.streamText) {
        const errMsg = '模型未返回任何内容（请检查模型名称是否正确、账户是否有余额）'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      if (this.streamText.trim().length < 40) {
        const errMsg = '模型只输出了过程性内容、没有给出结论。请重试，或把问题拆细后分次提问。'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      this.emitEvent({
        type: 'done',
        fullText: this.streamText
      })

      return {
        success: true,
        content: this.streamText,
        thought: this.streamThought
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[AgentService] Session error:', err)
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }
  }
}

export const agentService = new AgentService()
