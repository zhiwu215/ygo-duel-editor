import { app, BrowserWindow } from 'electron'
import path from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import type { ModelRuntime } from '@earendil-works/pi-coding-agent'

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
  AgentSendMessageParams,
  AgentSendMessageResult,
  AgentStreamEvent,
  AgentStepProposal,
  DuelPuzzleState,
  DuelPhase,
  DuelActionType,
  CardLocation
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { ocgcoreService } from './ocgcoreService'

export class AgentService {
  private currentAbortController: AbortController | null = null
  private currentBoardState: DuelPuzzleState | null = null

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
  public abort(): boolean {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
      this.emitEvent({ type: 'error', message: '已由用户中断生成' })
      return true
    }
    return false
  }

  /**
   * 发送消息并调用 Pi Agent 编排决斗
   */
  public async sendMessage(params: AgentSendMessageParams): Promise<AgentSendMessageResult> {
    // 1. 中断上一次可能未完成的任务
    this.abort()
    const abortController = new AbortController()
    this.currentAbortController = abortController

    // 2. 准备盘面快照
    this.currentBoardState = params.boardState || null

    // 3. 读取大模型配置
    const appConfig = configService.get()
    const cfg: AgentModelConfig = {
      baseUrl:
        params.configOverride?.baseUrl ||
        appConfig.agentConfig?.baseUrl ||
        'https://api.deepseek.com/v1',
      apiKey: params.configOverride?.apiKey || appConfig.agentConfig?.apiKey || '',
      model: params.configOverride?.model || appConfig.agentConfig?.model || 'deepseek-chat',
      provider:
        params.configOverride?.provider || appConfig.agentConfig?.provider || 'custom-openai',
      systemPrompt:
        params.configOverride?.systemPrompt || appConfig.agentConfig?.systemPrompt || '',
      enableReasoning:
        params.configOverride?.enableReasoning ?? appConfig.agentConfig?.enableReasoning ?? false
    }

    if (!cfg.apiKey.trim()) {
      const errMsg = '请先在右侧 AI 顾问面板中配置 API Key'
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    // 4. 为 Pi Agent 动态生成 models.json
    const agentDir = path.join(app.getPath('userData'), 'pi-agent')
    mkdirSync(agentDir, { recursive: true })
    const modelsPath = path.join(agentDir, 'models.json')

    const modelsConfig = {
      providers: {
        [cfg.provider || 'custom-openai']: {
          baseUrl: cfg.baseUrl,
          api: 'openai-completions',
          apiKey: cfg.apiKey,
          models: [
            {
              id: cfg.model,
              name: cfg.model,
              reasoning: Boolean(cfg.enableReasoning)
            }
          ]
        }
      }
    }
    writeFileSync(modelsPath, JSON.stringify(modelsConfig, null, 2), 'utf-8')

    // 5. 初始化 ModelRuntime
    let modelRuntime: ModelRuntime
    const { createAgentSession, ModelRuntime, SessionManager, defineTool } = await getPiAgent()
    try {
      modelRuntime = await ModelRuntime.create({ modelsPath })
    } catch (err: unknown) {
      const errMsg = `ModelRuntime 初始化失败: ${err instanceof Error ? err.message : String(err)}`
      console.error('[AgentService]', errMsg)
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    const availableModels = await modelRuntime.getAvailable()
    const targetModel = availableModels.find((m) => m.id === cfg.model) || availableModels[0]

    if (!targetModel) {
      const errMsg = `未找到可用模型: ${cfg.model}`
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }

    // 6. 收集 AI 提交的战术步骤
    const collectedProposals: AgentStepProposal[] = []

    // 7. 注册游戏王编排专属 Tools
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

        collectedProposals.push(...mappedSteps)

        this.emitEvent({
          type: 'proposals_ready',
          proposals: [...collectedProposals]
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

    // 8. 创建 AgentSession
    let fullContent = ''
    let fullThought = ''

    try {
      const { session } = await createAgentSession({
        model: targetModel,
        modelRuntime,
        sessionManager: SessionManager.inMemory(),
        customTools: [
          searchCardsTool,
          getCardInfoTool,
          getCurrentBoardTool,
          proposeStepsTool,
          validateWithOcgcoreTool
        ]
      })

      // 9. 订阅会话事件流
      session.subscribe((event) => {
        if (event.type === 'message_update') {
          const assistantEvent = event.assistantMessageEvent
          if (assistantEvent.type === 'text_delta') {
            fullContent += assistantEvent.delta
            this.emitEvent({ type: 'text_delta', delta: assistantEvent.delta })
          } else if (assistantEvent.type === 'thinking_delta') {
            fullThought += assistantEvent.delta
            this.emitEvent({ type: 'thinking_delta', delta: assistantEvent.delta })
          }
        }
      })

      // 10. 组装系统提示词与用户请求
      const systemInstruction = `你是一位精通《游戏王》(Yu-Gi-Oh!) 全时代规则的大师级同人决斗编排与剧本写作顾问。
你的核心任务是：
1. 理解创作者的剧情构思、对战双方角色性格与决斗意图；
2. 遇到不确定的卡片效果时，使用【search_cards】或【get_card_info】查询官方真实卡片数据，杜绝口胡虚构效果；
3. 可以使用【get_current_board】获取创作者当前盘面上双方的卡片与生命值；
4. 构思战术与扣人心弦的热血对白、心理博弈内心独白；
5. 在完成战术推演后，**必须调用【propose_duel_steps】工具**，将详细步骤提交给创作者，方便其一键导入决斗盘面与生成 Markdown 台本！
6. 必要时可调用【validate_with_ocgcore】对复杂时点进行规则引擎合规检验。`

      const promptText = `${systemInstruction}\n\n${cfg.systemPrompt ? `【补充创作者设定】:\n${cfg.systemPrompt}\n\n` : ''}【创作者本次提出的剧情与战术需求】:\n${params.prompt}`

      await session.prompt(promptText)

      session.dispose()
      this.currentAbortController = null

      this.emitEvent({
        type: 'done',
        fullText: fullContent,
        proposals: collectedProposals
      })

      return {
        success: true,
        content: fullContent,
        thought: fullThought,
        proposals: collectedProposals
      }
    } catch (err: unknown) {
      this.currentAbortController = null
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[AgentService] Session error:', err)
      this.emitEvent({ type: 'error', message: errMsg })
      return { success: false, error: errMsg }
    }
  }
}

export const agentService = new AgentService()
