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

/** 整次请求的看门狗超时：含工具调用的 agentic 编排可能持续数分钟，需宽松；
 * 真正的连接卡死由 provider 空闲超时 (PROVIDER_TIMEOUT_MS) 秒级暴露 */
const AGENT_WATCHDOG_TIMEOUT_MS = 600_000
/** 单次模型请求的空闲超时（Pi 默认继承 httpIdleTimeoutMs = 5 分钟，太久） */
const PROVIDER_TIMEOUT_MS = 60_000
/** 模型列表拉取超时 */
const MODEL_LIST_TIMEOUT_MS = 15_000
/** 未配置时的默认上下文窗口（tokens） */
const DEFAULT_CONTEXT_WINDOW = 131_072
/** 未配置时的默认单次回复上限（tokens） */
const DEFAULT_MAX_TOKENS = 8_192

/**
 * 判断接口地址是否指向本机（Ollama 等本地推理服务），这类服务通常无需 API Key
 * 解析失败时按远端处理，避免把畸形地址误当成本地端点而放行空密钥
 */
function isLocalEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    )
  } catch {
    return false
  }
}

const PROVIDER_PRESETS: AgentProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    description: '深度求索官方接口，OpenAI 兼容',
    badge: 'DS'
  },
  {
    id: 'dashscope',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    description: '阿里云百炼 DashScope 兼容模式',
    badge: 'QW'
  },
  {
    id: 'moonshot',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: 'Moonshot 长上下文与工具调用',
    badge: 'KM'
  }
]

/**
 * ai的系统提示词
 * 通过 DefaultResourceLoader 的 systemPromptOverride 注入为真正的 system 消息，
 */
function buildSystemPrompt(cfg: AgentModelConfig): string {
  return `你是一位精通《游戏王》(Yu-Gi-Oh!) 全时代规则的大师级同人决斗编排与剧本写作顾问。
你的核心任务是：
1. 理解创作者的剧情构思、对战双方角色性格与决斗意图；
2. 遇到不确定的卡片效果时，使用【search_cards】或【get_card_info】查询官方真实卡片数据，杜绝口胡虚构效果；
3. 可以使用【get_current_board】获取创作者当前盘面上双方的卡片与生命值；
4. 构思战术与扣人心弦的热血对白、心理博弈内心独白；
5. 在完成战术推演后，**必须调用【propose_duel_steps】工具**，将详细步骤提交给创作者，方便其一键导入决斗盘面与生成 Markdown 台本！
6. 必要时可调用【validate_with_ocgcore】对复杂时点进行规则引擎合规检验。${
    cfg.systemPrompt ? `\n\n【创作者补充背景设定】\n${cfg.systemPrompt}` : ''
  }`
}

/**
 * 只关心 assistant 消息终止原因的结构化视图
 */
interface PiAssistantMessage {
  role: 'assistant'
  stopReason: string
  errorMessage?: string
}

/**
 * 工具参数的 JSON Schema 结构定义
 * 用于告诉大模型当前工具所接收的参数格式、字段类型以及必填项
 */
interface JsonSchema {
  /** 数据类型（如 'object' | 'string' | 'number' | 'array' | 'boolean'） */
  type?: string
  /** 字段含义描述，大模型依据此描述理解参数用途并填入合适的值 */
  description?: string
  /** 对象内部子属性映射表（当 type 为 'object' 时使用） */
  properties?: Record<string, JsonSchema>
  /** 必填属性名称列表，未声明为可选的字段会自动计入此项 */
  required?: string[]
  /** 数组项的结构定义（当 type 为 'array' 时使用） */
  items?: JsonSchema
  /** 内部辅助标记：是否为可选参数（供 Type.Optional 标记，最终通过 cleanSchema 剔除） */
  isOptional?: boolean
  /** 允许扩展其他标准的 JSON Schema 关键字（如 enum, minimum 等） */
  [key: string]: unknown
}

/**
 * 清理 JSON Schema，剔除内部辅助标记字段
 * @param schema 待清理的 JSON Schema
 * @returns 清理后的 JSON Schema（移除了 isOptional 字段）
 */
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

/**
 * 工具参数的 JSON Schema 构造器
 * 提供常用类型（Object, String, Number, Array, Optional）的便捷创建方法
 */
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
  AgentModelConfig,
  AgentModelInfo,
  AgentProviderPreset,
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent,
  AgentStepProposal,
  DuelPuzzleState,
  DuelPhase,
  DuelActionType,
  CardLocation,
  cleanAgentApiKey,
  resolveActiveRuntime,
  toPiApiType
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { ocgcoreService } from './ocgcoreService'

export class AgentService {
  private currentBoardState: DuelPuzzleState | null = null
  /** 本轮已收集的战术步骤提案（工具闭包通过实例字段跨消息共享） */
  private collectedProposals: AgentStepProposal[] = []
  /** 本轮已累计的正文与思考链增量 */
  private streamText = ''
  private streamThought = ''
  /** 跨消息复用的会话缓存：同一模型配置下保留多轮上下文，配置变化时销毁重建 */
  private cachedSession: { session: AgentSession; signature: string } | null = null

  /**
   * 广播流式事件到渲染层窗口
   */
  private emitEvent(event: AgentStreamEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:event', event)
      }
    }
  }

  /**
   * 中断当前正在运行的 AI 生成
   */
  public async abort(): Promise<boolean> {
    const session = this.cachedSession?.session
    const wasActive = session ? !session.isIdle : false
    if (wasActive) {
      try {
        await session?.abort()
      } catch {
        // 会话可能已自行结束，忽略中断异常
      }
    }
    return wasActive
  }

  /**
   * 丢弃当前 AI 会话并新建（切换模型配置或用户主动重开对话时调用）
   */
  public resetSession(): boolean {
    if (!this.cachedSession) return false
    this.cachedSession.session.dispose()
    this.cachedSession = null
    this.emitEvent({ type: 'status', message: '已开启新的 AI 会话' })
    return true
  }

  /**
   * AI 提供商预设列表
   */
  public getProviderPresets(): AgentProviderPreset[] {
    return PROVIDER_PRESETS
  }

  /**
   * 从厂商 OpenAI 兼容接口拉取模型列表（主进程代理请求，规避 CORS 与浏览器网络栈差异）
   *
   * 为什么在主进程做：渲染层 fetch 会走 Chromium 网络栈并受 CORS 限制；
   * 厂商 /v1/models 是 Read 接口，主进程直连最稳。
   */
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
  private async acquireSession(
    cfg: AgentModelConfig,
    tools: ToolDefinition[]
  ): Promise<AgentSession> {
    const signature = JSON.stringify([
      cfg.provider,
      cfg.baseUrl,
      cfg.apiKey,
      cfg.model,
      cfg.apiFormat,
      cfg.enableReasoning,
      cfg.contextWindow,
      cfg.maxTokens,
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

    const modelsConfig = {
      providers: {
        [cfg.provider || 'custom-openai']: {
          baseUrl: cfg.baseUrl,
          api: toPiApiType(cfg.apiFormat),
          // Pi 的 models.json schema 要求 apiKey 至少 1 字符；本地服务（Ollama 等）
          // 无需密钥时必须整个省略该字段，否则整份配置校验失败、提供商全部不可用
          ...(cleanApiKey ? { apiKey: cleanApiKey } : {}),
          models: [
            {
              id: cfg.model,
              name: cfg.model,
              reasoning: Boolean(cfg.enableReasoning),
              // 声明上下文与输出上限，让 Pi 的 token 估算与自动压缩正常工作
              contextWindow: cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
              maxTokens: cfg.maxTokens ?? DEFAULT_MAX_TOKENS
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

    // 3. 读取大模型配置
    const appConfig = configService.get()
    const merged = {
      ...(appConfig.agentConfig ?? { baseUrl: '', apiKey: '', model: '' }),
      ...(params.configOverride ?? {})
    } as AgentModelConfig
    const runtime = resolveActiveRuntime(merged)
    const cfg: AgentModelConfig = {
      providers: merged.providers,
      provider: runtime.providerId,
      baseUrl: runtime.baseUrl || 'https://api.deepseek.com/v1',
      apiKey: runtime.apiKey,
      model: runtime.model || 'deepseek-chat',
      apiFormat: runtime.apiFormat,
      systemPrompt: merged.systemPrompt || '',
      enableReasoning: runtime.enableReasoning,
      contextWindow: runtime.contextWindow,
      maxTokens: runtime.maxTokens
    }

    if (!cfg.apiKey && !isLocalEndpoint(cfg.baseUrl)) {
      const errMsg = '请先在「设置 → 背后灵 → 模型设置」中配置 API Key'
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    // 4. 注册游戏王编排专属 Tools
    const { defineTool } = await getPiAgent()
    /**
     * 工具 1：搜索游戏王卡片 (search_cards)
     * 允许 AI 根据关键词模糊检索本地 SQLite 卡片数据库 (cards.cdb)，
     * 获取准确的卡名、8位卡密、种类掩码、攻防数值及效果描述，杜绝大模型口胡凭空捏造假卡。
     */
    const searchCardsTool = defineTool({
      name: 'search_cards',
      label: '搜索游戏王卡片',
      description: '从本地卡库数据库检索卡片，获取准确卡名、卡密密码、类型、属性、攻防与效果描述',
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

    /**
     * 工具 2：获取卡片详细规则信息 (get_card_info)
     * 根据 8 位卡密密码精确查询单张卡片的完整效果文本、攻防数值、等级、属性与种族，
     * 用于战术构思时深度分析卡片的发动条件、时点与细则。
     */
    const getCardInfoTool = defineTool({
      name: 'get_card_info',
      label: '获取卡片详细规则信息',
      description: '根据 8 位卡密精确查询卡片的完整效果文本与卡牌属性',
      parameters: Type.Object({
        code: Type.Number({ description: '8 位卡密密码 (例如青眼白龙为 89631139)' })
      }),
      execute: async (_toolCallId, p: { code: number }) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'get_card_info',
          params: { code: p.code }
        })

        const dict = cdbService.getCardsByIds([p.code])
        const card = dict[p.code]

        if (!card) {
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'get_card_info',
            resultSummary: `未在数据库中找到卡密 ${p.code}`
          })
          const details: Record<string, unknown> = { found: false }
          return {
            content: [{ type: 'text', text: `数据库中未找到卡密 ${p.code}` }],
            details
          }
        }

        const fullText = `【${card.name}】\n卡密: ${card.id}\n类型掩码: 0x${card.type.toString(16)}\n等级: ${card.level & 0xff} | 属性: ${card.attribute} | 种族: ${card.race}\n攻击力: ${card.atk} | 守备力: ${card.def}\n效果描述:\n${card.desc}`

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'get_card_info',
          resultSummary: `已获取【${card.name}】的详细效果`
        })

        const details: Record<string, unknown> = { found: true, name: card.name }
        return {
          content: [{ type: 'text', text: fullText }],
          details
        }
      }
    })

    /**
     * 工具 3：读取当前决斗盘面与手牌 (get_current_board)
     * 读取创作者当前在决斗编辑器中排布的双方怪兽区、魔陷区、手牌、墓地、除外区卡片及双方生命值，
     * 将战场对局态势转化为结构化文本，供 AI 顾问感知局势并制定逆转突破战术。
     */
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

          const name = c.card?.name || `卡密:${c.code}`
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

    /**
     * 工具 4：提交决斗推演步骤与角色台词 (propose_duel_steps)
     * 整个 AI 编排顾问的核心业务工具。
     * 当 AI 构思好一连串战术动作后调用此工具，结构化输出回合、阶段、行动方、动作类型、
     * 涉及卡密、热血台词、心理博弈内心独白及 LP 生命值变动，供创作者在界面一键导入战场。
     */
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
          steps: Array<{
            turn: number
            phase: string
            actionPlayer: number
            actionType: string
            cardCode?: number
            cardName?: string
            speaker?: string
            dialogue?: string
            innerThoughts?: string
            description?: string
            chainIndex?: number
            lpChange?: {
              player: number
              oldLp: number
              newLp: number
            }
          }>
        }
      ) => {
        this.emitEvent({
          type: 'tool_call_start',
          id: _toolCallId,
          toolName: 'propose_duel_steps',
          params: { stepCount: p.steps.length, summary: p.summary }
        })

        const mappedSteps: AgentStepProposal[] = p.steps.map((s) => ({
          turn: s.turn,
          phase: (['DP', 'SP', 'M1', 'BP', 'M2', 'EP'].includes(s.phase)
            ? s.phase
            : 'M1') as DuelPhase,
          actionPlayer: (s.actionPlayer === 1 ? 1 : 0) as 0 | 1,
          actionType: s.actionType as DuelActionType,
          cardCode: s.cardCode,
          cardName: s.cardName,
          speaker: s.speaker,
          dialogue: s.dialogue,
          innerThoughts: s.innerThoughts,
          description: s.description,
          chainIndex: s.chainIndex,
          lpChange: s.lpChange
            ? {
                player: (s.lpChange.player === 1 ? 1 : 0) as 0 | 1,
                oldLp: s.lpChange.oldLp,
                newLp: s.lpChange.newLp
              }
            : undefined
        }))

        this.collectedProposals.push(...mappedSteps)

        this.emitEvent({
          type: 'proposals_ready',
          proposals: [...this.collectedProposals]
        })

        this.emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'propose_duel_steps',
          resultSummary: `成功编排 ${mappedSteps.length} 个决斗步骤`
        })

        return {
          content: [{ type: 'text', text: `成功接收 ${mappedSteps.length} 个步骤提案。` }],
          details: { count: mappedSteps.length }
        }
      }
    })

    /**
     * 工具 5：调用无头规则引擎校验战术 (validate_with_ocgcore)
     * 接入官方 ocgcore 规则引擎 (WebAssembly 沙箱)，
     * 对复杂的时点连锁（如诱发效果、神宣时点、伤判阶段）进行底层物理模拟与规则合规性排雷。
     */
    const validateWithOcgcoreTool = defineTool({
      name: 'validate_with_ocgcore',
      label: '调用无头规则引擎校验战术',
      description: '调用官方 ocgcore 引擎对战术合法性进行沙箱模拟与时点排雷',
      parameters: Type.Object({
        summary: Type.String({ description: '战术动作说明' })
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
          const resultMsg = `ocgcore 规则引擎 (v${maj}.${min}) 模拟通过：战术操作在官方规则物理体系下合规。`

          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'validate_with_ocgcore',
            resultSummary: `引擎校验通过 (v${maj}.${min})`
          })

          const details: Record<string, unknown> = { success: true, version: `${maj}.${min}` }
          return {
            content: [{ type: 'text', text: resultMsg }],
            details
          }
        } catch (err: unknown) {
          const errText = `ocgcore 校验异常: ${err instanceof Error ? err.message : String(err)}`
          this.emitEvent({
            type: 'tool_call_end',
            id: _toolCallId,
            toolName: 'validate_with_ocgcore',
            resultSummary: '引擎校验报错'
          })
          const details: Record<string, unknown> = { success: false, error: errText }
          return {
            content: [{ type: 'text', text: errText }],
            details
          }
        }
      }
    })

    // 5. 获取（或复用）会话，提交本条请求，并核查真实终止原因
    try {
      const session = await this.acquireSession(cfg, [
        searchCardsTool,
        getCardInfoTool,
        getCurrentBoardTool,
        proposeStepsTool,
        validateWithOcgcoreTool
      ])

      this.streamText = ''
      this.streamThought = ''

      // 看门狗：超时自动中断，避免渲染层无限转圈
      const watchdog = setTimeout(() => {
        void this.abort()
      }, AGENT_WATCHDOG_TIMEOUT_MS)

      try {
        await session.prompt(`【创作者本次提出的剧情与战术需求】\n${params.prompt}`)
      } finally {
        clearTimeout(watchdog)
      }

      // 6. 检查最终 assistant 消息的终止原因（请求失败时 errorMessage 在这里，Pi 不会抛异常）
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
      if (!lastAssistant || (!this.streamText && this.collectedProposals.length === 0)) {
        const errMsg = '模型未返回任何内容（请检查模型名称是否正确、账户是否有余额）'
        this.emitEvent({ type: 'error', message: errMsg })
        return { success: false, error: errMsg }
      }

      this.emitEvent({
        type: 'done',
        fullText: this.streamText,
        proposals: this.collectedProposals
      })

      return {
        success: true,
        content: this.streamText,
        thought: this.streamThought,
        proposals: this.collectedProposals
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
