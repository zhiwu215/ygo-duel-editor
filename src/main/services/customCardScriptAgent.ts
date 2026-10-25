import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type {
  AgentModelConfig,
  CustomCardScriptGenerateEvent,
  CustomCardScriptGenerateResult
} from '@shared/index'
import {
  DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
  isLocalEndpoint,
  normalizeCardStrings,
  resolveActiveRuntime,
  type CustomCard
} from '@shared/index'
import { acquireSession, type SessionConfig } from './agent/piSessionFactory'
import { configService } from './configService'
import { cdbService } from '../db/cdbService'
import { collectCustomCardScriptReferences } from './customCardScriptReferences'
import { extractLuaScriptBlock, extractStreamingScript } from './customCardScriptStream'
import {
  buildScriptRepairPrompt,
  buildScriptUserPrompt,
  CUSTOM_CARD_SCRIPT_SYSTEM_PROMPT
} from './customCardScriptPrompt'
import { normalizeScriptText, scriptStructureProblem } from './customCardScriptDraft'

const MAX_ATTEMPTS = 2

const GENERATION_TIMEOUT_MS = 6 * 60 * 1000

interface ActiveGeneration {
  session: AgentSession | null
  aborted: boolean
  timedOut: boolean
}

interface PiAssistantMessage {
  role: 'assistant'
  stopReason: string
  errorMessage?: string
}

interface ScriptDraft {
  script: string
  strings: string[]
  category?: number
  notes?: string
}

let activeGeneration: ActiveGeneration | null = null

export async function abortCustomCardScriptGeneration(): Promise<boolean> {
  const generation = activeGeneration
  if (!generation) return false
  generation.aborted = true
  try {
    await generation.session?.abort()
  } catch {
    void 0
  }
  return true
}

function describeTruncation(outputLimit: number, output: string): string {
  if (output.trim().length === 0) {
    return `模型把全部输出配额（${outputLimit} tokens）用在了思考上，没有写出脚本。请在「设置 → 模型」调高该模型的「最大输出 token 数」，或降低推理等级后重试。`
  }
  return `模型输出达到上限（${outputLimit} tokens）被截断，脚本不完整。请在「设置 → 模型」调高该模型的「最大输出 token 数」后重试。`
}

function parseDraft(text: string, card: CustomCard): { draft: ScriptDraft } | { error: string } {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let raw: Record<string, unknown> | null = null
  if (start >= 0 && end > start) {
    try {
      raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    } catch {
      raw = null
    }
  }

  if (raw && typeof raw.script === 'string' && raw.script.trim().length > 0) {
    const category = Number(raw.category)
    return {
      draft: {
        script: normalizeScriptText(raw.script, card),
        strings: normalizeCardStrings(raw.strings),
        category: raw.category !== undefined && Number.isFinite(category) ? category : undefined,
        notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined
      }
    }
  }

  const lua = extractLuaScriptBlock(text)
  if (lua) {
    return {
      draft: {
        script: normalizeScriptText(lua, card),
        strings: normalizeCardStrings(undefined)
      }
    }
  }

  if (!raw) return { error: start < 0 ? '没有返回 JSON 对象' : '返回的 JSON 无法解析' }
  return { error: '脚本为空' }
}

export async function generateCustomCardScript(
  card: CustomCard,
  existingScript: string | undefined,
  emit: (event: CustomCardScriptGenerateEvent) => void
): Promise<CustomCardScriptGenerateResult> {
  const appConfig = configService.get()
  const merged = {
    ...(appConfig.agentConfig ?? { baseUrl: '', apiKey: '', model: '' })
  } as AgentModelConfig
  const runtime = resolveActiveRuntime(merged)
  if (!runtime.apiKey && !isLocalEndpoint(runtime.baseUrl)) {
    return { success: false, error: '请先在设置中配置 AI 模型 API Key。' }
  }

  const cfg: SessionConfig = {
    providers: merged.providers,
    provider: runtime.providerId,
    baseUrl: runtime.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: runtime.apiKey,
    model: runtime.model || 'deepseek-chat',
    apiFormat: runtime.apiFormat,
    systemPrompt: CUSTOM_CARD_SCRIPT_SYSTEM_PROMPT,
    reasoningEfforts: runtime.reasoningEfforts,
    reasoningEffort: runtime.reasoningEffort,
    contextWindow: runtime.contextWindow,
    maxTokens: runtime.maxTokens,
    input: runtime.input,
    supportsStructuredOutput: runtime.supportsStructuredOutput,
    supportsMidConversationSystem: runtime.supportsMidConversationSystem
  }

  let streamText = ''
  let sentScriptLength = 0
  let watchdog: NodeJS.Timeout | undefined
  const generation: ActiveGeneration = { session: null, aborted: false, timedOut: false }
  activeGeneration = generation

  const emitStatus = (message: string): void => emit({ type: 'status', message })

  try {
    const categories = cdbService
      .getSearchFilterOptions()
      .effectCategories.map((item) => `- ${item.mask}: ${item.label}`)
      .join('\n')

    emitStatus('正在检索相似卡脚本参考…')
    const references = collectCustomCardScriptReferences(card)
    emitStatus(
      references.length > 0
        ? `已找到 ${references.length} 个相似卡脚本参考：${references.map((item) => item.name).join('、')}`
        : '没有找到相似卡脚本参考，按通用规则生成'
    )

    emitStatus('正在初始化模型会话…')
    const session = await acquireSession(
      cfg,
      [],
      {
        emitEvent: (event) => {
          if (event.type === 'status') emitStatus(event.message)
        },
        onTextDelta: (delta) => {
          streamText += delta
          const script = extractStreamingScript(streamText)
          if (script.length > sentScriptLength) {
            emit({ type: 'script_delta', delta: script.slice(sentScriptLength) })
            sentScriptLength = script.length
          }
        },
        onThinkingDelta: (delta) => emit({ type: 'thinking_delta', delta })
      },
      { cache: false, systemPrompt: CUSTOM_CARD_SCRIPT_SYSTEM_PROMPT }
    )
    generation.session = session
    if (generation.aborted) return { success: false, error: '生成已中断。' }

    watchdog = setTimeout(() => {
      generation.timedOut = true
      void session.abort().catch(() => undefined)
    }, GENERATION_TIMEOUT_MS)

    let prompt = buildScriptUserPrompt({ card, existingScript, references, categories })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      streamText = ''
      sentScriptLength = 0
      emit({ type: 'attempt_start' })
      emitStatus(attempt === 0 ? '模型正在分析效果并生成脚本…' : '模型正在根据校验结果修正脚本…')

      await session.prompt(prompt)
      if (generation.timedOut) return { success: false, error: '生成超时（6 分钟），已停止。' }
      if (generation.aborted) return { success: false, error: '生成已中断。' }

      const lastAssistantMsg = [...session.messages]
        .reverse()
        .find((message) => (message as PiAssistantMessage).role === 'assistant')
      const lastAssistant = lastAssistantMsg as PiAssistantMessage | undefined
      if (lastAssistant?.stopReason === 'aborted') {
        return { success: false, error: '生成已中断。' }
      }
      if (lastAssistant?.stopReason === 'error') {
        return { success: false, error: lastAssistant.errorMessage || '模型请求失败。' }
      }
      if (lastAssistant?.stopReason === 'length') {
        return {
          success: false,
          error: describeTruncation(cfg.maxTokens ?? DEFAULT_AGENT_MAX_OUTPUT_TOKENS, streamText)
        }
      }

      const parsed = parseDraft(streamText, card)
      if ('error' in parsed) {
        if (attempt + 1 < MAX_ATTEMPTS) {
          prompt = buildScriptRepairPrompt(parsed.error)
          continue
        }
        return { success: false, error: `模型输出无法使用：${parsed.error}。请重试或更换模型。` }
      }

      const problem = scriptStructureProblem(parsed.draft.script, card.id, card.desc)
      if (problem) {
        if (attempt + 1 < MAX_ATTEMPTS) {
          prompt = buildScriptRepairPrompt(`脚本结构不完整（${problem}）`)
          continue
        }
        return { success: false, error: `脚本结构不完整：${problem}。请重试或更换模型。` }
      }

      emitStatus(`脚本已生成（${parsed.draft.script.split('\n').length} 行），等待应用`)
      return {
        success: true,
        script: parsed.draft.script,
        strings: parsed.draft.strings,
        category: parsed.draft.category,
        notes: parsed.draft.notes
      }
    }

    return { success: false, error: '脚本生成失败。' }
  } catch (err: unknown) {
    if (generation.timedOut) return { success: false, error: '生成超时（6 分钟），已停止。' }
    if (generation.aborted) return { success: false, error: '生成已中断。' }
    const message = err instanceof Error ? err.message : '脚本生成失败'
    emitStatus(`生成失败：${message}`)
    return { success: false, error: message }
  } finally {
    if (watchdog) clearTimeout(watchdog)
    if (activeGeneration === generation) activeGeneration = null
    try {
      generation.session?.dispose()
    } catch {}
  }
}
