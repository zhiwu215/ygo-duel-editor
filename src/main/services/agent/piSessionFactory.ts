import { app } from 'electron'
import path from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import type { AgentSession, ModelRuntime, ToolDefinition } from '@earendil-works/pi-coding-agent'
import {
  AgentModelConfig,
  AgentRuntimeConfig,
  AgentStreamEvent,
  cleanAgentApiKey,
  toPiApiType
} from '@shared/index'
import { buildSystemPrompt } from './systemPrompt'

export type PiAgentModule = typeof import('@earendil-works/pi-coding-agent')

let piAgentPromise: Promise<PiAgentModule> | null = null

export function getPiAgent(): Promise<PiAgentModule> {
  if (!piAgentPromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<PiAgentModule>
    piAgentPromise = dynamicImport('@earendil-works/pi-coding-agent')
  }
  return piAgentPromise
}

export type SessionConfig = AgentModelConfig &
  Pick<
    AgentRuntimeConfig,
    'supportsVision' | 'supportsStructuredOutput' | 'supportsMidConversationSystem'
  >

const PROVIDER_TIMEOUT_MS = 60_000

const DEFAULT_CONTEXT_WINDOW = 131_072

const LOCAL_ENDPOINT_PLACEHOLDER_KEY = 'local-no-key'

export interface PiSessionStreamDeps {
  emitEvent: (event: AgentStreamEvent) => void
  onTextDelta: (delta: string) => void
  onThinkingDelta: (delta: string) => void
}

let cachedSession: { session: AgentSession; signature: string } | null = null

export function getCachedSession(): AgentSession | null {
  return cachedSession ? cachedSession.session : null
}

export function disposeSession(): boolean {
  if (!cachedSession) return false
  cachedSession.session.dispose()
  cachedSession = null
  return true
}

export async function acquireSession(
  cfg: SessionConfig,
  tools: ToolDefinition[],
  deps: PiSessionStreamDeps
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
    cfg.supportsVision,
    cfg.supportsStructuredOutput,
    cfg.supportsMidConversationSystem,
    cfg.systemPrompt
  ])
  if (cachedSession && cachedSession.signature === signature) {
    return cachedSession.session
  }
  if (cachedSession) {
    cachedSession.session.dispose()
    cachedSession = null
  }

  const agentDir = path.join(app.getPath('userData'), 'pi-agent')
  mkdirSync(agentDir, { recursive: true })
  const modelsPath = path.join(agentDir, 'models.json')

  const cleanApiKey = cleanAgentApiKey(cfg.apiKey)

  const compat: Record<string, boolean> = {}
  if (cfg.supportsStructuredOutput) compat.supportsStrictMode = true
  if (cfg.supportsMidConversationSystem) compat.supportsMidConvoSystemMessages = true

  const modelsConfig = {
    providers: {
      [cfg.provider || 'custom-openai']: {
        baseUrl: cfg.baseUrl,
        api: toPiApiType(cfg.apiFormat),
        apiKey: cleanApiKey || LOCAL_ENDPOINT_PLACEHOLDER_KEY,
        models: [
          {
            id: cfg.model,
            name: cfg.model,
            reasoning: Boolean(cfg.enableReasoning),
            contextWindow: cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
            ...(cfg.maxTokens ? { maxTokens: cfg.maxTokens } : {}),
            ...(cfg.supportsVision ? { input: ['text', 'image'] } : {}),
            ...(Object.keys(compat).length > 0 ? { compat } : {})
          }
        ]
      }
    }
  }
  writeFileSync(modelsPath, JSON.stringify(modelsConfig, null, 2), 'utf-8')

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

  const loader = new DefaultResourceLoader({
    cwd: agentDir,
    agentDir,
    systemPromptOverride: () => buildSystemPrompt(cfg),
    appendSystemPromptOverride: () => []
  })
  await loader.reload()

  const { session } = await createAgentSession({
    cwd: agentDir,
    agentDir,
    model: targetModel,
    modelRuntime,
    resourceLoader: loader,
    sessionManager: SessionManager.create(agentDir, path.join(agentDir, 'sessions')),
    settingsManager: SettingsManager.inMemory({
      retry: { enabled: false, provider: { timeoutMs: PROVIDER_TIMEOUT_MS } },
      cacheWarming: 'off'
    }),
    tools: tools.map((t) => t.name),
    customTools: tools
  })

  session.subscribe((event) => {
    if (event.type === 'message_update') {
      const assistantEvent = event.assistantMessageEvent
      if (assistantEvent.type === 'text_delta') {
        deps.onTextDelta(assistantEvent.delta)
        deps.emitEvent({ type: 'text_delta', delta: assistantEvent.delta })
      } else if (assistantEvent.type === 'thinking_delta') {
        deps.onThinkingDelta(assistantEvent.delta)
        deps.emitEvent({ type: 'thinking_delta', delta: assistantEvent.delta })
      }
    } else if (event.type === 'auto_retry_start') {
      deps.emitEvent({
        type: 'status',
        message: `模型请求失败，第 ${event.attempt}/${event.maxAttempts} 次重试：${event.errorMessage}`
      })
    }
  })

  cachedSession = { session, signature }
  return session
}
