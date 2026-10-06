import { app, BrowserWindow } from 'electron'
import path from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import type { AgentSession, ModelRuntime, ToolDefinition } from '@earendil-works/pi-coding-agent'

type PiAgentModule = typeof import('@earendil-works/pi-coding-agent')
let piAgentPromise: Promise<PiAgentModule> | null = null

function getPiAgent(): Promise<PiAgentModule> {
  if (!piAgentPromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<PiAgentModule>
    piAgentPromise = dynamicImport('@earendil-works/pi-coding-agent')
  }
  return piAgentPromise
}

const AGENT_WATCHDOG_TIMEOUT_MS = 600_000

const PROVIDER_TIMEOUT_MS = 60_000

const MODEL_LIST_TIMEOUT_MS = 15_000

const DEFAULT_CONTEXT_WINDOW = 131_072

const LOCAL_ENDPOINT_PLACEHOLDER_KEY = 'local-no-key'

const PROVIDER_PRESETS: AgentProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    category: 'cn'
  },
  {
    id: 'dashscope',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    category: 'cn'
  },
  {
    id: 'moonshot',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    category: 'cn'
  },
  {
    id: 'bigmodel',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    category: 'cn'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiFormat: 'openai-chat-completions',
    category: 'cn'
  },
  {
    id: 'xiaomi-mimo',
    name: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    category: 'cn'
  },

  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai-responses',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    category: 'global'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    apiFormat: 'anthropic-messages',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    category: 'global'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiFormat: 'openai-responses',
    apiKeyUrl: 'https://console.x.ai',
    category: 'global'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://openrouter.ai/keys',
    category: 'global'
  },

  {
    id: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai-chat-completions',
    category: 'local'
  }
]

function buildSystemPrompt(cfg: AgentModelConfig): string {
  return `你是一个专业的《游戏王》卡牌决斗剧情创作者，你能调用工具查真实卡片数据、读取当前盘面、把场面布局与推演步骤交给创作者。

规则：
- 直接给结论，不要先写「我先查一下」「让我看看」这类过程说明。
- 需要查多张卡时，把卡密一次性传给 get_card_info；同一个工具不要重复调用同一个目标。
- 查不到或工具报错时，基于已有信息作答并说明不确定处，不要因此中止或只给免责声明。
- 不要使用 emoji、表情符号和颜文字。
- 用户口述了一个具体局面（生命值、场上怪兽与表示形式、手牌）并要求「摆到决斗场 / 复盘这个场面」时，调用 propose_board_setup 提交布局：
  - 复盘全新局面必须 clearExisting: true，否则会叠加在原有卡片上。
  - 动态攻防必须填 customAtk / customDef。卡库里这类卡的攻防是 ?，不填就显示不出真实数值。
  - 手牌必须填 duelistName，否则多人模式下会挂到错的决斗者名下；名字先用 get_current_board 查。
  - sequence 是该方自己视角的左边起数（seq0 = 该方最左格）。对方场地左右镜像，但序号不变。
  - 用户只说「有一张盖卡」而没说是哪张时，code 传 0 并填 isUnknown: true，不要瞎猜卡名。
- 战术推演完成后，调用 propose_duel_steps 把步骤交给创作者。${
    cfg.systemPrompt ? `\n\n【创作者补充设定】\n${cfg.systemPrompt}` : ''
  }`
}

interface PiAssistantMessage {
  role: 'assistant'
  stopReason: string
  errorMessage?: string
}

interface JsonSchema {
  type?: string

  description?: string

  properties?: Record<string, JsonSchema>

  required?: string[]

  items?: JsonSchema

  isOptional?: boolean

  [key: string]: unknown
}

function cleanSchema(schema: JsonSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'isOptional') continue
    if (k === 'properties' && v && typeof v === 'object') {
      const cleanedProperties: Record<string, unknown> = {}
      for (const [propName, propVal] of Object.entries(v as Record<string, JsonSchema>)) {
        cleanedProperties[propName] = cleanSchema(propVal)
      }
      result.properties = cleanedProperties
    } else if (k === 'items' && v && typeof v === 'object') {
      result.items = cleanSchema(v as JsonSchema)
    } else {
      result[k] = v
    }
  }
  return result
}

const Type = {
  Object: (props: Record<string, JsonSchema>): Record<string, unknown> => {
    const required = Object.keys(props).filter((k) => !props[k]?.isOptional)
    const base: JsonSchema = {
      type: 'object',
      properties: props,
      ...(required.length > 0 ? { required } : {})
    }
    return cleanSchema(base)
  },
  String: (opts?: { description?: string }): JsonSchema => ({
    type: 'string',
    ...opts
  }),
  Number: (opts?: { description?: string }): JsonSchema => ({
    type: 'number',
    ...opts
  }),
  Boolean: (opts?: { description?: string }): JsonSchema => ({
    type: 'boolean',
    ...opts
  }),
  Array: (items: JsonSchema, opts?: { description?: string }): JsonSchema => ({
    type: 'array',
    items,
    ...opts
  }),
  Optional: (item: JsonSchema): JsonSchema => ({
    ...item,
    isOptional: true
  })
}
import {
  AgentBoardCardPlacement,
  AgentBoardLpTarget,
  AgentBoardSetupProposal,
  AgentModelConfig,
  AgentModelInfo,
  AgentProviderPreset,
  AgentRuntimeConfig,
  AgentHandoffRequest,
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent,
  AgentStepProposal,
  DuelPuzzleState,
  CardLocation,
  CdbCard,
  cleanAgentApiKey,
  isLocalEndpoint,
  normalizeAgentBoardPlacement,
  normalizeAgentStepProposal,
  resolveActiveRuntime,
  toPiApiType
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { libraryService } from './libraryService'
import { ocgcoreService } from './ocgcoreService'

type SessionConfig = AgentModelConfig &
  Pick<
    AgentRuntimeConfig,
    'supportsVision' | 'supportsStructuredOutput' | 'supportsMidConversationSystem'
  >

export class AgentService {
  private currentBoardState: DuelPuzzleState | null = null

  private collectedProposals: AgentStepProposal[] = []

  private collectedBoardSetup: AgentBoardSetupProposal | null = null

  private currentNovelSource: {
    novelId?: string
    chapterId?: string
    title: string
    content: string
    chapters?: { title: string; content: string }[]
  } | null = null

  private streamText = ''
  private streamThought = ''

  private cachedSession: { session: AgentSession; signature: string } | null = null

  private static readonly NOVEL_CHUNK_SIZE = 8000

  private emitEvent(event: AgentStreamEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:event', event)
      }
    }
  }

  /**
   * 跨窗口提交：小说素材库窗口把选中的章节交给主窗口的对话。
   * 只广播请求，真正的取正文与发消息仍在主窗口的 store 里完成，
   * 避免两个窗口各持一份 Zustand 实例导致状态不共享。
   */
  public handoff(request: AgentHandoffRequest): { success: boolean; error?: string } {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 0) return { success: false, error: '主窗口未就绪' }
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:handoff-request', request)
      }
    }
    return { success: true }
  }

  public async abort(): Promise<boolean> {
    const session = this.cachedSession?.session
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
    if (!this.cachedSession) return false
    this.cachedSession.session.dispose()
    this.cachedSession = null
    this.emitEvent({ type: 'status', message: '已开启新的 AI 会话' })
    return true
  }

  public getProviderPresets(): AgentProviderPreset[] {
    return PROVIDER_PRESETS
  }

  public async fetchModels(
    baseUrl: string,
    apiKey: string
  ): Promise<{ success: boolean; models?: AgentModelInfo[]; error?: string }> {
    const trimmed = baseUrl.trim().replace(/\/+$/, '')
    if (!trimmed) {
      return { success: false, error: '接口地址不能为空' }
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return { success: false, error: '接口地址必须以 http:// 或 https:// 开头' }
    }
    try {
      const cleanKey = apiKey
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS)
      const res = await fetch(`${trimmed}/models`, {
        headers: cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {},
        signal: controller.signal
      })
      clearTimeout(timer)

      if (!res.ok) {
        let errorDetail = ''
        try {
          const json = (await res.json()) as { error?: { message?: string } }
          if (json?.error?.message) {
            errorDetail = json.error.message
          }
        } catch {
          // ignore json parse error
        }
        if (!errorDetail) {
          errorDetail = (await res.text()).slice(0, 300) || res.statusText
        }

        const msg =
          res.status === 401
            ? `身份验证失败 (HTTP 401): ${errorDetail}（请检查 API Key 是否有效）`
            : `HTTP ${res.status}: ${errorDetail}`
        return { success: false, error: msg }
      }
      const json = (await res.json()) as {
        data?: { id?: unknown; owned_by?: unknown }[]
        models?: { name?: unknown }[]
      }
      // OpenAI 兼容: { data: [...] }；Ollama: { models: [...] }
      const rawList = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.models)
          ? json.models
          : []
      const models = rawList
        .map((m) => ({
          id:
            typeof m.id === 'string'
              ? m.id
              : typeof (m as { name?: unknown }).name === 'string'
                ? String((m as { name?: unknown }).name)
                : ''
        }))
        .filter((m) => m.id)
        .sort((a, b) => a.id.localeCompare(b.id))
      return { success: true, models }
    } catch (err) {
      const message = err instanceof Error ? err.message.replace(/^Error:\s*/, '') : String(err)
      return { success: false, error: `连接失败: ${message}（请检查接口地址与网络）` }
    }
  }

  /**
   * 获取（或复用）AgentSession
   *
   * 为什么按配置签名缓存：Pi 的模型/系统提示词/工具在会话创建时绑定，
   * 重复创建会丢失多轮记忆；配置一旦变化则必须重建才能生效。
   */
  private async acquireSession(cfg: SessionConfig, tools: ToolDefinition[]): Promise<AgentSession> {
    const signature = JSON.stringify([
      cfg.provider,
      cfg.baseUrl,
      cfg.apiKey,
      cfg.model,
      cfg.apiFormat,
      cfg.enableReasoning,
      cfg.contextWindow,
      cfg.maxTokens,
      // 能力开关同样会写进 models.json，改动后必须重建会话
      cfg.supportsVision,
      cfg.supportsStructuredOutput,
      cfg.supportsMidConversationSystem,
      cfg.systemPrompt
    ])
    if (this.cachedSession && this.cachedSession.signature === signature) {
      return this.cachedSession.session
    }
    if (this.cachedSession) {
      this.cachedSession.session.dispose()
      this.cachedSession = null
    }

    // 1. 为 Pi Agent 动态生成 models.json
    const agentDir = path.join(app.getPath('userData'), 'pi-agent')
    mkdirSync(agentDir, { recursive: true })
    const modelsPath = path.join(agentDir, 'models.json')

    const cleanApiKey = cleanAgentApiKey(cfg.apiKey)

    // 只在显式开启时才写 compat：省略等于沿用 Pi 的默认值，
    // 无条件写 false 会把 Pi 原本默认具备的能力关掉。
    const compat: Record<string, boolean> = {}
    if (cfg.supportsStructuredOutput) compat.supportsStrictMode = true
    if (cfg.supportsMidConversationSystem) compat.supportsMidConvoSystemMessages = true

    const modelsConfig = {
      providers: {
        [cfg.provider || 'custom-openai']: {
          baseUrl: cfg.baseUrl,
          api: toPiApiType(cfg.apiFormat),
          // Pi 的 models.json schema 要求 apiKey **存在且至少 1 个字符**：
          // 省略字段或写成空串都会让整份配置校验失败，结果是**一个模型都加载不出来**。
          // 能走到这里而 Key 为空的只可能是本地端点（远端缺 Key 已在上面拦掉），
          // 所以补一个占位值 —— Ollama / LM Studio 都会忽略 Authorization 头。
          apiKey: cleanApiKey || LOCAL_ENDPOINT_PLACEHOLDER_KEY,
          models: [
            {
              id: cfg.model,
              name: cfg.model,
              reasoning: Boolean(cfg.enableReasoning),
              // 声明上下文上限，让 Pi 的 token 估算与自动压缩正常工作
              contextWindow: cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
              // 输出上限：读不到模型真实上限时**整个省略 maxTokens 字段**，
              // 让厂商按自己的默认值走，而不是猜一个数把回答截在半途。
              // 参考 ZCode 的处理：值不可知就不写进 models.json（它用 JSON Merge Patch
              // 达成同样效果，值为 undefined 的 key 不会出现在请求体里）。
              ...(cfg.maxTokens ? { maxTokens: cfg.maxTokens } : {}),
              // Pi 只认 text / image 两种模态，未开启图片输入时整个省略
              ...(cfg.supportsVision ? { input: ['text', 'image'] } : {}),
              ...(Object.keys(compat).length > 0 ? { compat } : {})
            }
          ]
        }
      }
    }
    writeFileSync(modelsPath, JSON.stringify(modelsConfig, null, 2), 'utf-8')

    // 2. 初始化 ModelRuntime 并解析目标模型
    const {
      createAgentSession,
      ModelRuntime,
      SessionManager,
      SettingsManager,
      DefaultResourceLoader
    } = await getPiAgent()
    const modelRuntime: ModelRuntime = await ModelRuntime.create({ modelsPath })

    const availableModels = await modelRuntime.getAvailable()
    const targetModel = availableModels.find((m) => m.id === cfg.model) || availableModels[0]
    if (!targetModel) {
      throw new Error(`未找到可用模型: ${cfg.model}`)
    }

    // 3. 用真正的 system 消息承载角色设定（原先拼在 user prompt 里，挤占回复预算）
    const loader = new DefaultResourceLoader({
      cwd: agentDir,
      agentDir,
      systemPromptOverride: () => buildSystemPrompt(cfg),
      // 屏蔽用户磁盘上的 APPEND_SYSTEM.md / 项目 AGENTS.md，避免无关内容注入决斗顾问
      appendSystemPromptOverride: () => []
    })
    await loader.reload()

    // 4. 创建会话
    const { session } = await createAgentSession({
      cwd: agentDir,
      agentDir,
      model: targetModel,
      modelRuntime,
      resourceLoader: loader,
      // 会话持久化到用户数据目录，便于事后追溯
      sessionManager: SessionManager.create(agentDir, path.join(agentDir, 'sessions')),
      // 关闭 Pi 的静默自动重试并收紧空闲超时（默认 5 分钟），让真实报错秒级暴露
      settingsManager: SettingsManager.inMemory({
        retry: { enabled: false, provider: { timeoutMs: PROVIDER_TIMEOUT_MS } },
        cacheWarming: 'off'
      }),
      // 只开放业务工具：Pi 默认会启用 read/bash/edit/write，等于把磁盘暴露给模型
      tools: tools.map((t) => t.name),
      customTools: tools
    })

    // 5. 订阅事件流（会话被复用，因此只订阅一次）
    session.subscribe((event) => {
      if (event.type === 'message_update') {
        const assistantEvent = event.assistantMessageEvent
        if (assistantEvent.type === 'text_delta') {
          this.streamText += assistantEvent.delta
          this.emitEvent({ type: 'text_delta', delta: assistantEvent.delta })
        } else if (assistantEvent.type === 'thinking_delta') {
          this.streamThought += assistantEvent.delta
          this.emitEvent({ type: 'thinking_delta', delta: assistantEvent.delta })
        }
      } else if (event.type === 'auto_retry_start') {
        this.emitEvent({
          type: 'status',
          message: `模型请求失败，第 ${event.attempt}/${event.maxAttempts} 次重试：${event.errorMessage}`
        })
      }
    })

    this.cachedSession = { session, signature }
    return session
  }

  /**
   * 发送消息并调用 Pi Agent 编排决斗
   */
  public async sendMessage(params: AgentSendMessageParams): Promise<AgentSendMessageResult> {
    // 1. 中断上一次可能未完成的任务
    await this.abort()
    // 2. 准备盘面快照并重置本轮提案收集
    this.currentBoardState = params.boardState || null
    this.collectedProposals = []
    this.collectedBoardSetup = null
    // 装载本轮附加的素材：直接文本（拖入的临时文件）优先，
    // 其次按 id 从资料库读正文。正文留在主进程，模型经 read_novel_source
    // 分段读取；读取失败如实广播，不静默吞掉。
    this.currentNovelSource = null
    const novelRef = params.novelSource
    const directText = novelRef?.content?.trim()
    if (directText) {
      this.currentNovelSource = {
        novelId: novelRef?.novelId ?? '',
        chapterId: novelRef?.chapterId ?? '',
        title: novelRef?.title?.trim() || '附加文本',
        content: directText
      }
    } else if (novelRef?.novelId && (novelRef.chapterIds?.length || novelRef.chapterId)) {
      const chapterIds = novelRef.chapterIds?.length ? novelRef.chapterIds : [novelRef.chapterId!]
      const contents = libraryService.getNovelChapters(novelRef.novelId)
      const picked = contents
        .filter((c) => chapterIds.includes(c.id))
        .sort((a, b) => chapterIds.indexOf(a.id) - chapterIds.indexOf(b.id))
      if (picked.length === 0) {
        this.emitEvent({
          type: 'status',
          message: `小说素材《${novelRef.title}》读取失败（可能已被删除或重新拆分），本次按无素材处理`
        })
      } else {
        this.currentNovelSource = {
          novelId: novelRef.novelId,
          chapterId: picked[0].id,
          title: novelRef.title.trim() || novelRef.novelId,
          content: picked.map((c) => c.content || '').join('\n\n'),
          chapters: picked.map((c) => ({ title: c.title, content: c.content || '' }))
        }
      }
    }

    // 3. 读取大模型配置
    const appConfig = configService.get()
    const merged = {
      ...(appConfig.agentConfig ?? { baseUrl: '', apiKey: '', model: '' }),
      ...(params.configOverride ?? {})
    } as AgentModelConfig
    const runtime = resolveActiveRuntime(merged)
    const cfg: SessionConfig = {
      providers: merged.providers,
      provider: runtime.providerId,
      baseUrl: runtime.baseUrl || 'https://api.deepseek.com/v1',
      apiKey: runtime.apiKey,
      model: runtime.model || 'deepseek-chat',
      apiFormat: runtime.apiFormat,
      systemPrompt: merged.systemPrompt || '',
      enableReasoning: runtime.enableReasoning,
      contextWindow: runtime.contextWindow,
      maxTokens: runtime.maxTokens,
      supportsVision: runtime.supportsVision,
      supportsStructuredOutput: runtime.supportsStructuredOutput,
      supportsMidConversationSystem: runtime.supportsMidConversationSystem
    }

    if (!cfg.apiKey && !isLocalEndpoint(cfg.baseUrl)) {
      const errMsg = '请先在「设置 → 背后灵 → 模型设置」中配置 API Key'
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    const { defineTool } = await getPiAgent()

    const searchCardsTool = defineTool({
      name: 'search_cards',
      label: '搜索游戏王卡片',
      description:
        '从本地卡库数据库检索卡片，返回卡名、卡密、类型、攻防与效果摘要。只在不知道卡名或卡密时使用；一旦拿到卡密就改用 get_card_info（支持一次传多个卡密）。同一个关键词不要重复调用，多张卡请分别用各自的关键词查或合并成一次 get_card_info',
      parameters: Type.Object({
        keyword: Type.String({ description: '卡名关键词、效果描述关键词或8位卡密' }),
        limit: Type.Optional(Type.Number({ description: '返回结果数量上限，默认 15 条' }))
      }),
      execute: async (_toolCallId, p: { keyword: string; limit?: number }) => {
        const keyword = p.keyword
        const limit = p.limit || 15
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'search_cards',
          params: { keyword, limit }
        })

        const res = cdbService.search({ keyword, limit })
        const summary = res.cards
          .map((c) => {
            return `【${c.name}】(卡密: ${c.id}) | 种类: 0x${c.type.toString(16)} | 攻/守: ${c.atk}/${c.def} | 描述: ${c.desc.slice(0, 120)}...`
          })
          .join('\n')

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'search_cards',
          resultSummary: `找到 ${res.total} 张匹配卡片`
        })

        const details: Record<string, unknown> = { total: res.total }
        return {
          content: [{ type: 'text', text: summary || '未检索到符合条件的卡片' }],
          details
        }
      }
    })

    const getCardInfoTool = defineTool({
      name: 'get_card_info',
      label: '获取卡片详细规则信息',
      description:
        '根据 8 位卡密精确查询卡片的完整效果文本与卡牌属性。codes 支持一次传多个卡密批量查询——盘面上出现多张卡时务必一次性传入，不要逐张调用',
      parameters: Type.Object({
        codes: Type.Array(Type.Number(), {
          description:
            '8 位卡密的数组 (例如 [89631139, 13955608])。已从 search_cards 结果中拿到卡密时优先直接用本工具，不要再重复 search_cards'
        })
      }),
      execute: async (_toolCallId, p: { codes: number[] }) => {
        const codes = p.codes ?? []
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'get_card_info',
          params: { codes }
        })

        if (codes.length === 0) {
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'get_card_info',
            resultSummary: '未提供卡密'
          })
          return {
            content: [{ type: 'text', text: '未提供任何卡密，无法查询。' }],
            details: { found: 0 }
          }
        }

        const dict = cdbService.getCardsByIds(codes)
        const found = codes.map((code) => dict[code]).filter((c): c is CdbCard => Boolean(c))
        const missing = codes.filter((code) => !dict[code])

        if (found.length === 0) {
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'get_card_info',
            resultSummary: `未在数据库中找到卡密 ${missing.join(', ')}`
          })
          const details: Record<string, unknown> = { found: 0, missing }
          return {
            content: [{ type: 'text', text: `数据库中未找到卡密 ${missing.join(', ')}` }],
            details
          }
        }

        const fullText = found
          .map(
            (card) =>
              `【${card.name}】\n卡密: ${card.id}\n类型掩码: 0x${card.type.toString(16)}\n等级: ${card.level & 0xff} | 属性: ${card.attribute} | 种族: ${card.race}\n攻击力: ${card.atk} | 守备力: ${card.def}\n效果描述:\n${card.desc}`
          )
          .join('\n\n---\n\n')
        const suffix = missing.length > 0 ? `\n\n（未找到卡密：${missing.join(', ')}）` : ''

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_card_info',
          resultSummary:
            found.length === 1
              ? `已获取【${found[0].name}】的详细效果`
              : `已获取${found.length} 张卡片的详细效果`
        })

        const details: Record<string, unknown> = {
          found: found.length,
          names: found.map((c) => c.name),
          missing
        }
        return {
          content: [{ type: 'text', text: fullText + suffix }],
          details
        }
      }
    })

    const getCurrentBoardTool = defineTool({
      name: 'get_current_board',
      label: '读取当前决斗盘面与手牌',
      description: '获取创作者当前在编辑器中排布的双方怪兽、魔陷、手牌、墓地与生命值状态',
      parameters: Type.Object({}),
      execute: async (_toolCallId) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'get_current_board',
          params: {}
        })

        const state = this.currentBoardState
        if (!state) {
          const text = '当前决斗盘未加载任何局面数据。'
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'get_current_board',
            resultSummary: '盘面为空'
          })
          const details: Record<string, unknown> = { cardCount: 0 }
          return { content: [{ type: 'text', text }], details }
        }

        const p0 = state.players[0] || { lp: 8000 }
        const p1 = state.players[1] || { lp: 8000 }

        const lines: string[] = []
        lines.push(`决斗规则: 大师规则 MR${state.masterRule}`)
        lines.push(`双方生命值: 我方(P0) LP ${p0.lp} vs 对方(P1) LP ${p1.lp}`)
        lines.push(`先攻回合方: ${state.turnPlayer === 0 ? '我方(P0)' : '对方(P1)'}`)

        const duelists = state.duelists || []
        if (duelists.length > 0) {
          lines.push(
            `决斗者名单: ${duelists
              .map((d) => `${d.name}(${d.team === 0 ? '我方' : '对方'} LP ${d.lp})`)
              .join('、')}`
          )
        }

        const cards = state.cards || []
        lines.push(`场上及手牌卡片总计: ${cards.length} 张`)

        for (const c of cards) {
          const owner = c.controller === 0 ? '我方' : '对方'
          let locName = '未知区域'
          if (c.location === CardLocation.HAND) locName = '手牌'
          else if (c.location === CardLocation.MZONE) locName = `怪兽区[${c.sequence}]`
          else if (c.location === CardLocation.SZONE) locName = `魔陷区[${c.sequence}]`
          else if (c.location === CardLocation.GRAVE) locName = '墓地'
          else if (c.location === CardLocation.REMOVED) locName = '除外区'
          else if (c.location === CardLocation.EXTRA) locName = '额外卡组'
          else if (c.location === CardLocation.DECK) locName = '主卡组'

          const name = c.card?.name || (c.code > 0 ? `卡密:${c.code}` : '未知盖卡')
          lines.push(`- [${owner}] ${name} 位于 ${locName}`)
        }

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_current_board',
          resultSummary: `已读取双方场面，共 ${cards.length} 张卡`
        })

        const details: Record<string, unknown> = { cardCount: cards.length }
        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details
        }
      }
    })

    const readNovelSourceTool = defineTool({
      name: 'read_novel_source',
      label: '分段读取小说素材',
      description:
        '分段读取创作者随消息附加的小说/文本素材。消息里标注了【小说素材】时必须先用它通读全文（从 offset 缺省开始，按返回指引传 offset 续读直到读完），再开始整理对局；未附加素材时不要调用',
      parameters: Type.Object({
        chapter: Type.Optional(
          Type.String({
            description:
              '要读取的章节标题（先用不带本参数的调用拿到目录后再传）。缺省时先返回章节目录'
          })
        ),
        offset: Type.Optional(
          Type.Number({
            description: '起始字符偏移，首次调用省略；续读时传上一次返回的 nextOffset'
          })
        )
      }),
      execute: async (_toolCallId, p: { chapter?: string; offset?: number }) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'read_novel_source',
          params: { chapter: p.chapter ?? null, offset: p.offset ?? 0 }
        })

        const source = this.currentNovelSource
        if (!source) {
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'read_novel_source',
            resultSummary: '本轮未附加小说素材'
          })
          return {
            content: [
              {
                type: 'text',
                text: '本轮消息没有附加小说素材。若创作者的诉求需要原文，请直接请对方通过「附加小说素材」按钮选择章节后再发送，不要凭空猜测剧情。'
              }
            ],
            details: { attached: false }
          }
        }

        if (!p.chapter && source.chapters && p.offset === undefined) {
          const toc = source.chapters
            .map((c, i) => `${i + 1}. ${c.title}（${c.content.length} 字）`)
            .join('\n')
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'read_novel_source',
            resultSummary: `《${source.title}》共 ${source.chapters.length} 章，返回目录`
          })
          const text = [
            `【小说素材】《${source.title}》`,
            `共 ${source.chapters.length} 章。请先看目录定位需要改写成决斗的段落，再用 chapter 参数读取对应章节（可多次调用）。`,
            '',
            toc
          ].join('\n')
          return {
            content: [{ type: 'text', text }],
            details: { title: source.title, chapters: source.chapters.length }
          }
        }

        const text = p.chapter
          ? (source.chapters?.find((c) => c.title === p.chapter)?.content ?? '')
          : source.content
        if (p.chapter && !text) {
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'read_novel_source',
            resultSummary: `章节「${p.chapter}」不存在`
          })
          return {
            content: [
              {
                type: 'text',
                text: `素材里没有名为「${p.chapter}」的章节，请按目录里的准确标题重试。`
              }
            ],
            details: { chapter: p.chapter, found: false }
          }
        }

        const total = text.length
        const offset = Math.min(Math.max(0, Math.trunc(p.offset ?? 0)), total)
        const chunk = text.slice(offset, offset + AgentService.NOVEL_CHUNK_SIZE)
        const end = offset + chunk.length
        const remaining = total - end

        const scope = p.chapter ? `第「${p.chapter}」章` : `《${source.title}》`

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'read_novel_source',
          resultSummary: `读取${scope}第 ${offset}-${end} 字，共 ${total} 字`
        })

        const header = [
          `【小说素材】${scope}`,
          `共 ${total} 字；本次输出第 ${offset}-${end} 字。`,
          remaining > 0
            ? `本章尚未读完（剩余 ${remaining} 字），请继续调用本工具并传 offset: ${end}。`
            : '本章已全部读完。'
        ].join('\n')

        const details: Record<string, unknown> = {
          title: source.title,
          chapter: p.chapter,
          total,
          offset,
          end,
          remaining
        }
        return { content: [{ type: 'text', text: `${header}\n\n${chunk}` }], details }
      }
    })

    const proposeStepsTool = defineTool({
      name: 'propose_duel_steps',
      label: '提交决斗推演步骤与角色台词',
      description:
        '当战术构思完毕时，必须调用此工具提交结构化的决斗步骤序列，以便用户一键导入决斗盘面与剧本',
      parameters: Type.Object({
        summary: Type.String({ description: '战术意图与局面总结' }),
        steps: Type.Array(
          Type.Object({
            turn: Type.Number({ description: '回合数，如 1, 2' }),
            phase: Type.String({ description: '阶段标识: DP, SP, M1, BP, M2, EP' }),
            actionPlayer: Type.Number({ description: '0代表我方/主角，1代表对方' }),
            actionType: Type.String({
              description:
                '动作类型: NORMAL_SUMMON, SPECIAL_SUMMON, ACTIVATE, ATTACK, TO_GRAVE, SET_MONSTER, SET_SPELL_TRAP, DAMAGE, DIALOGUE'
            }),
            cardCode: Type.Optional(Type.Number({ description: '卡片8位密码' })),
            cardName: Type.Optional(Type.String({ description: '卡片名称' })),
            speaker: Type.Optional(Type.String({ description: '台词发言者姓名' })),
            dialogue: Type.Optional(Type.String({ description: '角色热血对白台词' })),
            innerThoughts: Type.Optional(Type.String({ description: '角色内心独白/博弈思考' })),
            description: Type.Optional(Type.String({ description: '战术动作操作说明' })),
            chainIndex: Type.Optional(Type.Number({ description: '连锁序号' })),
            fromLocation: Type.Optional(
              Type.String({
                description:
                  '涉及卡片在动作前的区域: MZONE / SZONE / HAND / GRAVE / DECK / EXTRA / REMOVED。同一卡密有多张时用于消歧'
              })
            ),
            toLocation: Type.Optional(
              Type.String({
                description:
                  '动作后卡片移动到的区域（同上枚举）。缺省时编辑器按动作类型推断：召唤→怪兽区、盖放→魔陷区、破坏/送墓→墓地、除外→除外区'
              })
            ),
            toSequence: Type.Optional(
              Type.Number({
                description: '目标格子序号 0~4，仅在移动到怪兽区/魔陷区等离散格时填写'
              })
            ),
            sourceQuote: Type.Optional(
              Type.String({
                description:
                  '该步对应的原文短句（40 字内），供创作者核对转写顺序；凭空推演的步骤不要编造原文'
              })
            ),
            lpChange: Type.Optional(
              Type.Object({
                player: Type.Number({ description: '受到LP变动的玩家: 0我方, 1对方' }),
                oldLp: Type.Number(),
                newLp: Type.Number()
              })
            )
          })
        )
      }),
      execute: async (
        _toolCallId,
        p: {
          summary: string
          steps: unknown[]
        }
      ) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'propose_duel_steps',
          params: { stepCount: p.steps.length, summary: p.summary }
        })

        const notes: string[] = []
        const rejected: string[] = []
        const mappedSteps: AgentStepProposal[] = []
        p.steps.forEach((s, idx) => {
          const res = normalizeAgentStepProposal(s)
          if (res.ok) {
            if (res.note) notes.push(`第 ${idx + 1} 步：${res.note}`)
            mappedSteps.push(res.step)
          } else {
            rejected.push(`第 ${idx + 1} 步：${res.error}`)
          }
        })

        this.collectedProposals.push(...mappedSteps)

        this.emitEvent({
          type: 'proposals_ready',
          proposals: [...this.collectedProposals]
        })

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'propose_duel_steps',
          resultSummary: `累计接收 ${this.collectedProposals.length} 步（本批 +${mappedSteps.length}）${
            rejected.length > 0 ? `，剔除 ${rejected.length} 步` : ''
          }`
        })

        const lines: string[] = []
        if (mappedSteps.length === 0) {
          lines.push(
            '本批没有可用的步骤提案，全部被剔除。请按下列原因修正字段后重新提交整批，不要缩小范围重试。'
          )
        } else {
          lines.push(
            `已接收 ${mappedSteps.length} 个步骤提案（本轮累计 ${this.collectedProposals.length} 个）。转写未完成时继续按回合分批提交；已全部完成则不必再调用。`
          )
        }
        if (notes.length > 0) lines.push('已自动修正：', ...notes.map((n) => `- ${n}`))
        if (rejected.length > 0) {
          lines.push('被剔除的步骤（下一批提交前请先修正）：', ...rejected.map((r) => `- ${r}`))
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            accepted: mappedSteps.length,
            rejected: rejected.length,
            total: this.collectedProposals.length
          }
        }
      }
    })

    const proposeBoardSetupTool = defineTool({
      name: 'propose_board_setup',
      label: '复盘场面布局',
      description:
        '当用户口述了一个完整局面并要求把它摆到决斗场上时调用，提交一份待确认的布局（双方 LP + 每张牌的区域/格子/表示形式）。只提交提案，不会直接改动盘面，创作者确认后才会生效。复盘全新局面时 clearExisting 必须为 true。',
      parameters: Type.Object({
        summary: Type.String({ description: '这个局面的摘要，说明是什么场合、双方各剩什么' }),
        clearExisting: Type.Boolean({
          description:
            '是否先清空现有盘面再摆。复盘一个全新局面必须为 true，否则会在原有卡片上叠加摆放'
        }),
        lp: Type.Array(
          Type.Object({
            side: Type.Number({ description: '阵营：0 = 我方，1 = 对方' }),
            lp: Type.Number({ description: '目标生命值' }),
            duelistName: Type.Optional({
              description: '多人模式下指定决斗者名（如「韩诺」）；手牌与 LP 都属于具体决斗者'
            })
          }),
          { description: '生命值设定；不需要改动的一方可以不传' }
        ),
        cards: Type.Array(
          Type.Object({
            code: Type.Number({ description: '8 位卡密' }),
            cardName: Type.Optional({ description: '卡名，仅用于人工核对' }),
            side: Type.Number({ description: '阵营：0 = 我方，1 = 对方' }),
            location: Type.String({
              description:
                '区域: MZONE 怪兽区 / SZONE 魔陷区 / HAND 手牌 / GRAVE 墓地 / DECK 主卡组 / EXTRA 额外卡组 / REMOVED 除外区'
            }),
            sequence: Type.Number({
              description:
                '格子序号 0~4，恒定按**该方自己视角的左边起数**：seq0 = 该方最左格。对方的格子在屏幕上左右镜像（对方的 seq0 显示在屏幕最右边），但序号本身不变。手牌等堆叠区统一传 0，按顺序追加'
            }),
            position: Type.Optional({
              description:
                '表示形式: FACEUP_ATTACK 表侧攻击 / FACEUP_DEFENSE 表侧守备 / FACEDOWN 里侧盖放 / FACEUP 表侧表示。缺省时怪兽区按表攻、魔陷区与手牌按盖放'
            }),
            duelistName: Type.Optional({
              description:
                '目标决斗者名（如「韩诺」）；手牌必填，否则多人模式下会挂错人。可先用 get_current_board 查当前决斗者名单'
            }),
            isUnknown: Type.Optional({
              description:
                '仅当用户描述了一张「不知道是什么的盖卡」时为 true（如「魔陷区有一张盖卡」）。此时 code 传 0，格子会显示为无卡名的卡背。不要给已知卡设 true'
            }),
            customAtk: Type.Optional({
              description:
                '覆盖显示攻击力。动态攻防必须填（如「特拉戈迪亚攻击力上升手牌数量 X600，手牌 6 张 → 3600」），因为卡库里该卡atk 是 ?，不填显示不出真实数值'
            }),
            customDef: Type.Optional({ description: '覆盖显示守备力' })
          }),
          { description: '卡片落位列表' }
        )
      }),
      execute: async (
        _toolCallId,
        p: {
          summary: string
          clearExisting: boolean
          lp?: Array<{ side: number; lp: number; duelistName?: string }>
          cards?: Array<{
            code: number
            cardName?: string
            side: number
            location: string
            sequence: number
            position?: string
            duelistName?: string
            isUnknown?: boolean
            customAtk?: number
            customDef?: number
          }>
        }
      ) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'propose_board_setup',
          params: { cardCount: p.cards?.length ?? 0, clearExisting: p.clearExisting }
        })

        const warnings: string[] = []
        const rawCards = p.cards ?? []
        const codes = rawCards
          .filter((c) => !c.isUnknown)
          .map((c) => c.code)
          .filter((c) => Number.isFinite(c) && c > 0)
        const dict = codes.length > 0 ? cdbService.getCardsByIds(codes) : {}

        const placements: AgentBoardCardPlacement[] = []
        rawCards.forEach((c, idx) => {
          if (c.isUnknown) {
            const norm = normalizeAgentBoardPlacement({
              location: c.location,
              sequence: c.sequence,
              position: c.position
            })
            if (!norm.ok || !norm.zone) {
              warnings.push(`第 ${idx + 1} 张未知盖卡：${norm.reason ?? '落位参数无效'}，已跳过`)
              return
            }
            placements.push({
              code: 0,
              cardName: c.cardName?.trim() || '未知盖卡',
              side: c.side === 1 ? 1 : 0,
              location: norm.zone,
              sequence: norm.sequence ?? 0,
              position: norm.facing ?? 'FACEDOWN',
              isUnknown: true,
              duelistName: c.duelistName?.trim() || undefined,
              customAtk: Number.isFinite(c.customAtk as number) ? c.customAtk : undefined,
              customDef: Number.isFinite(c.customDef as number) ? c.customDef : undefined
            })
            return
          }

          const label = c.cardName || dict[c.code]?.name || `卡密 ${c.code}`
          if (!Number.isFinite(c.code) || c.code <= 0 || !dict[c.code]) {
            warnings.push(`第 ${idx + 1} 张【${label}】的卡密 ${c.code} 在卡库中不存在，已跳过`)
            return
          }
          const norm = normalizeAgentBoardPlacement({
            location: c.location,
            sequence: c.sequence,
            position: c.position
          })
          if (!norm.ok || !norm.zone) {
            warnings.push(`第 ${idx + 1} 张【${label}】：${norm.reason ?? '落位参数无效'}，已跳过`)
            return
          }
          placements.push({
            code: c.code,
            cardName: dict[c.code].name,
            side: c.side === 1 ? 1 : 0,
            location: norm.zone,
            sequence: norm.sequence ?? 0,
            position: norm.facing,
            duelistName: c.duelistName?.trim() || undefined,
            customAtk: Number.isFinite(c.customAtk as number) ? c.customAtk : undefined,
            customDef: Number.isFinite(c.customDef as number) ? c.customDef : undefined
          })
        })

        const lpTargets: AgentBoardLpTarget[] = (p.lp ?? [])
          .filter((t) => Number.isFinite(t.lp))
          .map((t) => ({
            side: t.side === 1 ? 1 : 0,
            lp: Math.max(0, Math.trunc(t.lp)),
            duelistName: t.duelistName?.trim() || undefined
          }))

        const setup: AgentBoardSetupProposal = {
          summary: p.summary || '（未提供局面摘要）',
          clearExisting: Boolean(p.clearExisting),
          lp: lpTargets,
          cards: placements,
          warnings
        }

        this.collectedBoardSetup = setup
        this.emitEvent({ type: 'board_setup_ready', setup })
        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'propose_board_setup',
          resultSummary: `待确认布局：${lpTargets.length} 项 LP、${placements.length} 张卡${
            warnings.length > 0 ? `，${warnings.length} 条警告` : ''
          }`
        })

        const lines: string[] = [
          `布局提案已提交，等待创作者在预览卡中确认：${placements.length} 张卡、${lpTargets.length} 项生命值。`,
          '此时盘面尚未改动。请在正文中用一两句话说明这个布局要怎么用，不要重复罗列每张卡。'
        ]
        if (warnings.length > 0) {
          lines.push(`已自动剔除 ${warnings.length} 处无效落位：`)
          lines.push(...warnings.map((w) => `- ${w}`))
        }
        const details: Record<string, unknown> = {
          cards: placements.length,
          lp: lpTargets.length,
          warnings: warnings.length
        }
        return { content: [{ type: 'text', text: lines.join('\n') }], details }
      }
    })

    const validateWithOcgcoreTool = defineTool({
      name: 'validate_with_ocgcore',
      label: '调用无头规则引擎校验战术',
      description:
        '可选。检测官方 ocgcore 引擎是否就绪。注意：当前引擎未接入局面输入，只能确认引擎可用性、**无法真正校验战术合法性**。因此不要把它当作合法性结论的依据，仍需基于已查证的卡片数据自行推演；引擎不可用时更不要因此回避作答',
      parameters: Type.Object({
        summary: Type.String({ description: '战术动作说明（当前仅用于日志，不会进入引擎）' })
      }),
      execute: async (_toolCallId, p: { summary: string }) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'validate_with_ocgcore',
          params: { summary: p.summary }
        })

        try {
          const core = await ocgcoreService.getCore()
          const [maj, min] = core.getVersion()
          const resultMsg = `ocgcore 规则引擎 (v${maj}.${min}) 已就绪，但引擎当前未接入局面输入，**本次没有对任何战术做合法性校验**。请不要把这当作「战术合规」的证据，仍需基于已查证的卡片数据自行推演时点与连锁合法性。`

          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'validate_with_ocgcore',
            resultSummary: `引擎就绪 (v${maj}.${min})，未做战术校验`
          })

          const details: Record<string, unknown> = {
            success: true,
            engineAvailable: true,
            validated: false,
            version: `${maj}.${min}`
          }
          return {
            content: [{ type: 'text', text: resultMsg }],
            details
          }
        } catch (err: unknown) {
          const errDetail = err instanceof Error ? err.message : String(err)
          const errText = `ocgcore 规则引擎尚未就绪，本次已跳过自动合法性校验（原因：${errDetail}）。这不代表战术不合法，请直接基于已查证的卡片数据给出结论，不要因为缺少引擎校验而回避作答或输出免责声明。`
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'validate_with_ocgcore',
            resultSummary: '引擎未就绪，已跳过'
          })
          const details: Record<string, unknown> = {
            success: false,
            skipped: true,
            reason: 'engine_unavailable',
            error: errDetail
          }
          return {
            content: [{ type: 'text', text: errText }],
            details
          }
        }
      }
    })

    try {
      const session = await this.acquireSession(cfg, [
        searchCardsTool,
        getCardInfoTool,
        getCurrentBoardTool,
        readNovelSourceTool,
        proposeStepsTool,
        proposeBoardSetupTool,
        validateWithOcgcoreTool
      ])

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
          ? '回答因超出单次回复长度上限被截断，内容不完整。可在「设置 → 模型设置 → 对话」中调高「单次回复上限」后重试。'
          : '模型回复超出单次回复长度上限即被截断，未输出任何内容。请在「设置 → 模型设置 → 对话」中调高「单次回复上限」后重试。'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }
      if (
        !lastAssistant ||
        (!this.streamText && this.collectedProposals.length === 0 && !this.collectedBoardSetup)
      ) {
        const errMsg = '模型未返回任何内容（请检查模型名称是否正确、账户是否有余额）'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      if (
        this.streamText.trim().length < 40 &&
        this.collectedProposals.length === 0 &&
        !this.collectedBoardSetup
      ) {
        const errMsg = '模型只输出了过程性内容、没有给出结论。请重试，或把问题拆细后分次提问。'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      this.emitEvent({
        type: 'done',
        fullText: this.streamText,
        proposals: this.collectedProposals,
        boardSetup: this.collectedBoardSetup ?? undefined
      })

      return {
        success: true,
        content: this.streamText,
        thought: this.streamThought,
        proposals: this.collectedProposals,
        boardSetup: this.collectedBoardSetup ?? undefined
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
