# 游戏王决斗编辑器：AI 顾问设置独立窗与模型连接修复

本改动是一次原子化提交，围绕同一个痛点展开：**AI 顾问（背后灵）填好配置却连不上模型，而且配置入口散落在会话面板内部、出错时只显示"生成失败"看不到真实原因**。

排查下来是四件事叠加：① 复制粘贴进来的 API Key 常带空格、引号、零宽字符，厂商直接返回 401；② 每次提问都新建会话，多轮上下文丢失；③ 模型列表在渲染层 `fetch` 会撞 CORS；④ Pi 默认开启静默重试且空闲超时长达 5 分钟，真实错误被吞掉、界面一直转圈。

改动按"契约 → 主进程能力 → IPC 与广播 → 渲染层 store → 设置界面 → 面板瘦身"的顺序推进，每一步都是前一步的自然结果。

---

## 第一步：先把数据契约定下来 —— **src/shared/types/ipc.ts**

改动缘由：这次要新增"拉取厂商模型列表""切换会话""打开设置窗""跨窗口配置广播"四组能力，按架构约定必须先在共享层把参数与返回类型写清楚，主进程、preload、渲染层才有同一份事实来源。同时 `AgentModelConfig` 需要承载上下文窗口与输出上限，否则 Pi 的 token 估算与自动压缩拿不到数值；流式事件也需要一个"非正文"的频道来承载重试、超时这类过程提示，避免它们被误当成回答内容。

```diff
 export interface AgentModelConfig {
   systemPrompt?: string
   /** 是否启用深度思考/推理模式 */
   enableReasoning?: boolean
+  /** 模型上下文窗口上限 (tokens)，用于 Pi 的 token 估算与自动压缩；缺省 131072 */
+  contextWindow?: number
+  /** 单次回复最大输出 tokens；缺省 8192 */
+  maxTokens?: number
 }
+
+/**
+ * AI 提供商预设（设置页「常用提供商」区展示）
+ */
+export interface AgentProviderPreset {
+  /** 预设唯一 ID（如 'deepseek'） */
+  id: string
+  /** 显示名称 */
+  name: string
+  /** 默认接口地址 */
+  baseUrl: string
+  /** 默认模型 */
+  model: string
+  /** 是否支持 reasoning 开关 */
+  supportsReasoning?: boolean
+}
+
+/**
+ * AI 提供商连接信息（设置页「已连接」区展示）
+ */
+export interface AgentProviderConnection {
+  /** 提供商 ID（预设 id 或 'custom'） */
+  id: string
+  /** 显示名称 */
+  name: string
+  baseUrl: string
+  /** 连接来源：预设预设 / 自定义 */
+  kind: 'preset' | 'custom'
+  /** 是否已配置 API Key（已连接的判定条件） */
+  hasApiKey: boolean
+  /** 当前选用的模型 */
+  model?: string
+}
```

```diff
 export type AgentStreamEvent =
   | { type: 'tool_call_end'; id: string; toolName: string; resultSummary: string }
   /** AI 构思好的决斗推演步骤与角色台词提案已就绪 */
   | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
+  /** 过程状态提示（自动重试、超时中断、会话重置等非正文信息） */
+  | { type: 'status'; message: string }
   /** 生成过程中发生异常或被用户手动中断 */
   | { type: 'error'; message: string }
```

```diff
+/**
+ * AI 提供商下可用模型信息（从厂商 /v1/models 接口实时拉取）
+ */
+export interface AgentModelInfo {
+  id: string
+  ownedBy?: string
+}
+
+/**
+ * 透传到厂商的模型列表请求参数
+ */
+export interface AgentFetchModelsParams {
+  baseUrl: string
+  apiKey: string
+}
+
+/**
+ * 模型列表拉取结果
+ */
+export interface AgentFetchModelsResult {
+  success: boolean
+  models?: AgentModelInfo[]
+  error?: string
+}
```

```diff
 export interface IpcApi {
   // AI 决斗编排与剧本顾问
   agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
   agentAbort: () => Promise<boolean>
+  /** 丢弃当前 AI 会话并新建（切换模型配置或用户主动重开对话时调用） */
+  agentResetSession: () => Promise<boolean>
+  /** 从厂商 /v1/models 拉取可用模型列表（主进程代理请求，避免 CORS） */
+  agentFetchModels: (params: AgentFetchModelsParams) => Promise<AgentFetchModelsResult>
+  /** AI 提供商预设列表（静态，设置页「常用提供商」区） */
+  agentGetProviderPresets: () => Promise<AgentProviderPreset[]>
+  /** 打开全局设置独立窗口 (VSCode 风格左下角入口) */
+  openSettingsWindow: () => Promise<void>
+  /** 订阅全局配置变更广播 (主题 / 路径 / AI 配置跨窗口同步)，返回退订函数 */
+  onConfigUpdated: (callback: () => void) => () => void
   onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void
 }
```

---

## 第二步：让主进程代理拉取模型列表 —— **src/main/services/agentService.ts**

改动缘由：模型列表原本打算在渲染层直接 `fetch` 厂商的 `/v1/models`，但渲染层请求走 Chromium 网络栈、受 CORS 约束，各家厂商的跨域头又不统一，失败时只给一个笼统的 `TypeError: Failed to fetch`。这类 Read 接口交给主进程 Node 侧直连最稳，顺带能把 401 单独翻译成"API Key 无效"这种可执行的提示。另外要兼容两种返回体：OpenAI 兼容的 `{ data: [...] }` 与 Ollama 的 `{ models: [...] }`。

```diff
+/** 模型列表拉取超时 */
+const MODEL_LIST_TIMEOUT_MS = 15_000
```

```diff
+  /**
+   * 从厂商 OpenAI 兼容接口拉取模型列表（主进程代理请求，规避 CORS 与浏览器网络栈差异）
+   *
+   * 为什么在主进程做：渲染层 fetch 会走 Chromium 网络栈并受 CORS 限制；
+   * 厂商 /v1/models 是 Read 接口，主进程直连最稳。
+   */
+  public async fetchModels(
+    baseUrl: string,
+    apiKey: string
+  ): Promise<{ success: boolean; models?: { id: string; ownedBy?: string }[]; error?: string }> {
+    const trimmed = baseUrl.trim().replace(/\/+$/, '')
+    if (!trimmed) {
+      return { success: false, error: '接口地址不能为空' }
+    }
+    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
+      return { success: false, error: '接口地址必须以 http:// 或 https:// 开头' }
+    }
+    try {
+      const cleanKey = apiKey
+        .trim()
+        .replace(/^["']|["']$/g, '')
+        .replace(/[\u200B-\u200D\uFEFF]/g, '')
+
+      const controller = new AbortController()
+      const timer = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS)
+      const res = await fetch(`${trimmed}/models`, {
+        headers: cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {},
+        signal: controller.signal
+      })
+      clearTimeout(timer)
+
+      if (!res.ok) {
+        let errorDetail = ''
+        try {
+          const json = (await res.json()) as { error?: { message?: string } }
+          if (json?.error?.message) {
+            errorDetail = json.error.message
+          }
+        } catch {
+          // ignore json parse error
+        }
+        if (!errorDetail) {
+          errorDetail = (await res.text()).slice(0, 300) || res.statusText
+        }
+
+        const msg =
+          res.status === 401
+            ? `身份验证失败 (HTTP 401): ${errorDetail}（请检查 API Key 是否有效）`
+            : `HTTP ${res.status}: ${errorDetail}`
+        return { success: false, error: msg }
+      }
```

---

## 第三步：会话要能复用，配置变了才重建 —— **src/main/services/agentService.ts**

改动缘由：原实现每问一次就 `createAgentSession` 一次，模型、系统提示词、工具都在创建时绑定，等于每次都从零开始，多轮记忆全丢。但反过来也不能无脑复用——用户换了模型或 Key 之后必须重建才能生效。所以按"配置签名"缓存会话：签名一致就复用，不一致就 dispose 重建，并暴露 `resetSession` 让用户能主动丢弃会话。

```diff
 export class AgentService {
-  private currentAbortController: AbortController | null = null
   private currentBoardState: DuelPuzzleState | null = null
+  /** 本轮已收集的战术步骤提案（工具闭包通过实例字段跨消息共享） */
+  private collectedProposals: AgentStepProposal[] = []
+  /** 本轮已累计的正文与思考链增量 */
+  private streamText = ''
+  private streamThought = ''
+  /** 跨消息复用的会话缓存：同一模型配置下保留多轮上下文，配置变化时销毁重建 */
+  private cachedSession: { session: AgentSession; signature: string } | null = null
```

```diff
+  /**
+   * 获取（或复用）AgentSession
+   *
+   * 为什么按配置签名缓存：Pi 的模型/系统提示词/工具在会话创建时绑定，
+   * 重复创建会丢失多轮记忆；配置一旦变化则必须重建才能生效。
+   */
+  private async acquireSession(
+    cfg: AgentModelConfig,
+    tools: ToolDefinition[]
+  ): Promise<AgentSession> {
+    const signature = JSON.stringify([
+      cfg.provider,
+      cfg.baseUrl,
+      cfg.apiKey,
+      cfg.model,
+      cfg.enableReasoning,
+      cfg.contextWindow,
+      cfg.maxTokens,
+      cfg.systemPrompt
+    ])
+    if (this.cachedSession && this.cachedSession.signature === signature) {
+      return this.cachedSession.session
+    }
+    if (this.cachedSession) {
+      this.cachedSession.session.dispose()
+      this.cachedSession = null
+    }
```

```diff
+  /**
+   * 丢弃当前 AI 会话并新建（切换模型配置或用户主动重开对话时调用）
+   */
+  public resetSession(): boolean {
+    if (!this.cachedSession) return false
+    this.cachedSession.session.dispose()
+    this.cachedSession = null
+    this.emitEvent({ type: 'status', message: '已开启新的 AI 会话' })
+    return true
+  }
```

---

## 第四步：把系统提示词放回真正的 system 消息，并收紧工具与超时 —— **src/main/services/agentService.ts**

改动缘由：原先把角色设定拼在用户 prompt 里，既挤占回复预算又容易被模型当成正文引用。改用 `DefaultResourceLoader` 的 `systemPromptOverride` 注入为真正的 system 消息，同时把 `appendSystemPromptOverride` 置空——否则用户磁盘上的 `APPEND_SYSTEM.md`、项目 `AGENTS.md` 会被 Pi 自动注入，把无关内容喂给决斗顾问。

另外两个隐患也必须一并处理：Pi 默认会启用 `read`/`bash`/`edit`/`write` 等内置工具，等于把磁盘暴露给模型，这里只开放业务工具；Pi 默认还有静默自动重试、空闲超时继承 5 分钟，导致真实错误被拖到几分钟后才暴露，这里关掉重试并把单次请求超时收紧到 60 秒。

```diff
+/**
+ * 决斗编排顾问的系统提示词
+ * 通过 DefaultResourceLoader 的 systemPromptOverride 注入为真正的 system 消息，
+ * 不再与用户请求拼接，避免挤占回复预算
+ */
+function buildSystemPrompt(cfg: AgentModelConfig): string {
+  return `你是一位精通《游戏王》(Yu-Gi-Oh!) 全时代规则的大师级同人决斗编排与剧本写作顾问。
+你的核心任务是：
+1. 理解创作者的剧情构思、对战双方角色性格与决斗意图；
+2. 遇到不确定的卡片效果时，使用【search_cards】或【get_card_info】查询官方真实卡片数据，杜绝口胡虚构效果；
+3. 可以使用【get_current_board】获取创作者当前盘面上双方的卡片与生命值；
+4. 构思战术与扣人心弦的热血对白、心理博弈内心独白；
+5. 在完成战术推演后，**必须调用【propose_duel_steps】工具**，将详细步骤提交给创作者，方便其一键导入决斗盘面与生成 Markdown 台本！
+6. 必要时可调用【validate_with_ocgcore】对复杂时点进行规则引擎合规检验。${
+    cfg.systemPrompt ? `\n\n【创作者补充背景设定】\n${cfg.systemPrompt}` : ''
+  }`
+}
```

```diff
+    // 3. 用真正的 system 消息承载角色设定（原先拼在 user prompt 里，挤占回复预算）
+    const loader = new DefaultResourceLoader({
+      cwd: agentDir,
+      agentDir,
+      systemPromptOverride: () => buildSystemPrompt(cfg),
+      // 屏蔽用户磁盘上的 APPEND_SYSTEM.md / 项目 AGENTS.md，避免无关内容注入决斗顾问
+      appendSystemPromptOverride: () => []
+    })
+    await loader.reload()
+
+    // 4. 创建会话
+    const { session } = await createAgentSession({
+      cwd: agentDir,
+      agentDir,
+      model: targetModel,
+      modelRuntime,
+      resourceLoader: loader,
+      // 会话持久化到用户数据目录，便于事后追溯
+      sessionManager: SessionManager.create(agentDir, path.join(agentDir, 'sessions')),
+      // 关闭 Pi 的静默自动重试并收紧空闲超时（默认 5 分钟），让真实报错秒级暴露
+      settingsManager: SettingsManager.inMemory({
+        retry: { enabled: false, provider: { timeoutMs: PROVIDER_TIMEOUT_MS } },
+        cacheWarming: 'off'
+      }),
+      // 只开放业务工具：Pi 默认会启用 read/bash/edit/write，等于把磁盘暴露给模型
+      tools: tools.map((t) => t.name),
+      customTools: tools
+    })
```

```diff
+/** 整次请求的看门狗超时：含工具调用的 agentic 编排可能持续数分钟，需宽松；
+ * 真正的连接卡死由 provider 空闲超时 (PROVIDER_TIMEOUT_MS) 秒级暴露 */
+const AGENT_WATCHDOG_TIMEOUT_MS = 600_000
+/** 单次模型请求的空闲超时（Pi 默认继承 httpIdleTimeoutMs = 5 分钟，太久） */
+const PROVIDER_TIMEOUT_MS = 60_000
```

---

## 第五步：生成 models.json 时别再写空密钥 —— **src/main/services/agentService.ts**

改动缘由：Pi 的 `models.json` schema 要求 `apiKey` 至少 1 个字符。原来无论有没有填都直接写 `apiKey: cfg.apiKey`，结果使用 Ollama、LM Studio 这类本地服务（无需密钥）时整份配置校验失败，表现为"所有模型都不可用"。这里改成：清洗后为空就整个省略字段；同时把上下文窗口与输出上限写进模型声明，让 Pi 的 token 估算与压缩能正常工作。

```diff
+/**
+ * 判断接口地址是否指向本机（Ollama / LM Studio 等本地推理服务），这类服务通常无需 API Key。
+ * 解析失败时按远端处理，避免把畸形地址误当成本地端点而放行空密钥。
+ */
+function isLocalEndpoint(baseUrl: string): boolean {
+  try {
+    const host = new URL(baseUrl).hostname.toLowerCase()
+    return (
+      host === 'localhost' ||
+      host === '127.0.0.1' ||
+      host === '0.0.0.0' ||
+      host === '::1' ||
+      host.endsWith('.local')
+    )
+  } catch {
+    return false
+  }
+}
```

```diff
+    const cleanApiKey = (cfg.apiKey || '')
+      .trim()
+      .replace(/^["']|["']$/g, '')
+      .replace(/[\u200B-\u200D\uFEFF]/g, '')
+
     const modelsConfig = {
       providers: {
         [cfg.provider || 'custom-openai']: {
           baseUrl: cfg.baseUrl,
           api: 'openai-completions',
-          apiKey: cfg.apiKey,
+          // Pi 的 models.json schema 要求 apiKey 至少 1 字符；本地服务（Ollama 等）
+          // 无需密钥时必须整个省略该字段，否则整份配置校验失败、提供商全部不可用
+          ...(cleanApiKey ? { apiKey: cleanApiKey } : {}),
           models: [
             {
               id: cfg.model,
               name: cfg.model,
-              reasoning: Boolean(cfg.enableReasoning)
+              reasoning: Boolean(cfg.enableReasoning),
+              // 声明上下文与输出上限，让 Pi 的 token 估算与自动压缩正常工作
+              contextWindow: cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
+              maxTokens: cfg.maxTokens ?? DEFAULT_MAX_TOKENS
             }
           ]
```

---

## 第六步：让失败原因真的暴露出来 —— **src/main/services/agentService.ts**

改动缘由：这是"连不上却只看到转圈"的核心。Pi 在模型请求失败时**不会抛异常**，而是把 `stopReason: 'error'` 和 `errorMessage` 写在最后一条 assistant 消息上；原实现只看 `try/catch`，于是失败也当成成功返回、界面永远停在生成中。这里补上三段核查：error、aborted、以及"既无正文又无提案"的空返回；同时给整次请求加看门狗，超时自动中断；`abort` 也从"标记 AbortController"改成真正中断会话。

```diff
+/**
+ * 只关心 assistant 消息终止原因的结构化视图
+ * （避免为读取 stopReason 而引入 Pi 深层类型依赖）
+ */
+interface PiAssistantMessage {
+  role: 'assistant'
+  stopReason: string
+  errorMessage?: string
+}
```

```diff
-  public abort(): boolean {
-    if (this.currentAbortController) {
-      this.currentAbortController.abort()
-      this.currentAbortController = null
-      this.emitEvent({ type: 'error', message: '已由用户中断生成' })
-      return true
+  public async abort(): Promise<boolean> {
+    const session = this.cachedSession?.session
+    const wasActive = session ? !session.isIdle : false
+    if (wasActive) {
+      try {
+        await session?.abort()
+      } catch {
+        // 会话可能已自行结束，忽略中断异常
+      }
     }
-    return false
+    return wasActive
   }
```

```diff
+      // 看门狗：超时自动中断，避免渲染层无限转圈
+      const watchdog = setTimeout(() => {
+        void this.abort()
+      }, AGENT_WATCHDOG_TIMEOUT_MS)
+
+      try {
+        await session.prompt(`【创作者本次提出的剧情与战术需求】\n${params.prompt}`)
+      } finally {
+        clearTimeout(watchdog)
+      }
+
+      // 6. 检查最终 assistant 消息的终止原因（请求失败时 errorMessage 在这里，Pi 不会抛异常）
+      const lastAssistantMsg = [...session.messages]
+        .reverse()
+        .find((m) => (m as PiAssistantMessage).role === 'assistant')
+      const lastAssistant = lastAssistantMsg as PiAssistantMessage | undefined
+
+      if (lastAssistant?.stopReason === 'error') {
+        const errMsg = lastAssistant.errorMessage || '模型请求失败（未返回具体错误信息）'
+        console.error('[AgentService] Model request failed:', errMsg)
+        this.emitEvent({ type: 'error', message: errMsg })
+        return { success: false, error: errMsg }
+      }
+      if (lastAssistant?.stopReason === 'aborted') {
+        const errMsg = '生成已中断'
+        this.emitEvent({ type: 'error', message: errMsg })
+        return { success: false, error: errMsg }
+      }
+      if (!lastAssistant || (!this.streamText && this.collectedProposals.length === 0)) {
+        const errMsg = '模型未返回任何内容（请检查模型名称是否正确、账户是否有余额）'
+        this.emitEvent({ type: 'error', message: errMsg })
+        return { success: false, error: errMsg }
+      }
```

```diff
+      } else if (event.type === 'auto_retry_start') {
+        this.emitEvent({
+          type: 'status',
+          message: `模型请求失败，第 ${event.attempt}/${event.maxAttempts} 次重试：${event.errorMessage}`
+        })
+      }
```

### 为什么需要 `PiAssistantMessage` 这个最小类型视图

上面这段核查里出现了这样一个类型声明，它既不是配置、也不是运行时数据结构：

```ts
/**
 * 只关心 assistant 消息终止原因的结构化视图
 * （避免为读取 stopReason 而引入 Pi 深层类型依赖）
 */
interface PiAssistantMessage {
  role: 'assistant'
  stopReason: string
  errorMessage?: string
}
```

它被这样使用：从 `session.messages` 里倒着找出最后一条助手消息，再按 `stopReason` 分流。

```ts
const lastAssistantMsg = [...session.messages]
  .reverse()
  .find((m) => (m as PiAssistantMessage).role === 'assistant')
const lastAssistant = lastAssistantMsg as PiAssistantMessage | undefined

if (lastAssistant?.stopReason === 'error') {
  /* 取出 errorMessage 提示真实原因 */
}
if (lastAssistant?.stopReason === 'aborted') {
  /* 提示生成已中断 */
}
```

**为什么要有这个 interface**：Pi（`pi-coding-agent`）的消息是一个很深的联合类型，user / assistant / toolResult 各自字段众多，完整引入就要把 Pi 的内部类型一起依赖进来，版本一变动我们这边就跟着编译失败。而这里的目的只是「看看最后一条助手消息是怎么结束的」，跟其余几十个字段毫无关系，所以就地声明一个只有三个字段的最小类型就够了。

**它是结构化类型（structural typing）的视图**：TypeScript 只看形状是否匹配，不要求对象出自同一个声明或同一个类。`session.messages` 里的元素字段比它多得多，但仍然「满足」这个接口——多出来的字段不影响匹配。这就是注释里「结构化视图」的含义。

**它只在编译期存在**：`interface` 编译后完全消失，不产生任何运行时代码，既不改数据也不做校验，纯粹是给编译器和读代码的人看的一份契约说明。

**`as PiAssistantMessage` 是一次类型断言**：等于对编译器说「相信我，这个对象长这样」。好处是与 Pi 解耦；代价是——如果 Pi 哪天把字段改名（比如 `stopReason` 改成 `finishReason`），编译器不会报错，运行时只会读到 `undefined`。为降低这个风险，`find` 里先用 `role === 'assistant'` 筛过一轮，确保取到的是助手消息而不是工具结果。

**三个字段各自的含义**：

- `role: 'assistant'` 是字面量类型而非宽泛的 `string`，只能精准匹配助手消息；
- `stopReason: string` 表示这一轮生成为什么停下来，正常写完是 `stop`、请求失败是 `error`、被中断是 `aborted`；
- `errorMessage?: string` 是可选的，只有 `error` 时才有厂商返回的真实原因。

**为什么它是这次修复的关键**：Pi 在模型请求失败时不会抛异常，`try / catch` 抓不到，而是把结果写进最后一条 assistant 消息的 `stopReason` 与 `errorMessage`。原来的代码只看 `try / catch`，于是请求失败也被当成成功返回，界面就一直转圈。加上这段核查之后，401、余额不足、模型名写错都能立刻显示真实原因。

---

## 第七步：把新能力挂到 IPC 上 —— **src/main/ipc/registerIpc.ts**

改动缘由：按项目 IPC 四件套约定，主进程的新方法必须在这里注册 handler 才对渲染层可见。`window:open-settings` 归入已有的 `window:` 域，与卡组编辑器窗口并列。

```diff
 import { agentService } from '../services/agentService'
+import { settingsWindowService } from '../services/settingsWindowService'
```

```diff
+  // 全局设置独立窗口 (VSCode 风格左下角入口)
+  ipcMain.handle('window:open-settings', async () => {
+    settingsWindowService.openSettingsWindow()
+  })
+
   ipcMain.handle('deck:get-list', async () => {
```

```diff
+  ipcMain.handle('agent:reset-session', async () => {
+    return agentService.resetSession()
+  })
+
+  ipcMain.handle('agent:fetch-models', async (_, params) => {
+    return agentService.fetchModels(String(params?.baseUrl ?? ''), String(params?.apiKey ?? ''))
+  })
+
+  ipcMain.handle('agent:get-provider-presets', async () => {
+    return agentService.getProviderPresets()
+  })
```

---

## 第八步：配置一改，所有窗口都要知道 —— **src/main/services/configService.ts**

改动缘由：设置窗口是独立窗口，改完主题或路径后主窗口不会自动刷新；AI 配置改完，会话面板也读不到新值。与其让各窗口轮询，不如写入成功后直接广播一条 `config:updated`，由各窗口自行重载。

```diff
-import { app } from 'electron'
+import { app, BrowserWindow } from 'electron'
```

```diff
       this.config = { ...this.config, ...partial }
       writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
+      // 广播到所有窗口 (主窗口 / 设置窗口 / 卡组编辑器)，主题与路径改动即时同步
+      for (const win of BrowserWindow.getAllWindows()) {
+        win.webContents.send('config:updated')
+      }
       return true
```

---

## 第九步：preload 补齐桥接 —— **src/preload/index.ts**

改动缘由：渲染层永远不直接接触 Electron，新增的三个方法加一个广播订阅必须在 contextBridge 里显式暴露；`onConfigUpdated` 沿用 `onAgentEvent` 的写法，返回退订函数，方便组件在 effect 里清理。

```diff
   agentSendMessage: (params) => ipcRenderer.invoke('agent:send-message', params),
   agentAbort: () => ipcRenderer.invoke('agent:abort'),
+  agentResetSession: () => ipcRenderer.invoke('agent:reset-session'),
+  agentFetchModels: (params) => ipcRenderer.invoke('agent:fetch-models', params),
+  agentGetProviderPresets: () => ipcRenderer.invoke('agent:get-provider-presets'),
+  openSettingsWindow: () => ipcRenderer.invoke('window:open-settings'),
+  onConfigUpdated: (callback) => {
+    const handler = (): void => callback()
+    ipcRenderer.on('config:updated', handler)
+    return () => {
+      ipcRenderer.removeListener('config:updated', handler)
+    }
+  },
   onAgentEvent: (callback) => {
```

---

## 第十步：AI store 承接状态事件、会话重置与配置自愈 —— **src/renderer/src/stores/useAgentStore.ts**

改动缘由：主进程新增的 `status` 事件要落到消息上展示（重试、超时、会话重置）；"清空对话"过去只清本地数组，Pi 侧会话还在，历史上下文会在下一轮复活，所以换成 `resetSession` 连同会话一起丢弃。最关键的是配置自愈：历史上已经写进配置文件的脏 Key（带空格、引号、零宽字符）需要在读取时就清洗，并在检测到修正后立刻回写，否则用户不重新输入就永远 401。

```diff
 export interface AgentChatMessage {
   role: 'user' | 'assistant'
   content: string
   thought?: string
+  /** 过程状态提示（重试、超时、会话重置等非正文信息） */
+  status?: string
   toolCalls?: AgentToolCallItem[]
   proposals?: AgentStepProposal[]
```

```diff
+        } else if (event.type === 'status') {
+          set({
+            messages: messages.map((m) =>
+              m.id === lastMsg.id ? { ...m, status: event.message } : m
+            )
+          })
         } else if (event.type === 'tool_call_start') {
```

```diff
+/** 跨窗口配置广播只订阅一次（设置窗口改配置后，主窗口会话面板同步刷新） */
+let configUpdatedSubscribed = false
```

```diff
   loadConfig: async () => {
     if (!window.api?.getConfig) return
+    if (!configUpdatedSubscribed && window.api.onConfigUpdated) {
+      configUpdatedSubscribed = true
+      window.api.onConfigUpdated(() => {
+        void get().loadConfig()
+      })
+    }
     try {
       const cfg = await window.api.getConfig()
       if (cfg.agentConfig) {
-        set({ config: { ...DEFAULT_CONFIG, ...cfg.agentConfig } })
+        const merged = { ...DEFAULT_CONFIG, ...cfg.agentConfig }
+        // 清洗复制粘贴混入的空白字符、两端多余引号与不可见字符：这些会导致厂商直接 401
+        const cleanKey = (merged.apiKey || '')
+          .trim()
+          .replace(/^["']|["']$/g, '')
+          .replace(/[\u200B-\u200D\uFEFF]/g, '')
+
+        const sanitized: AgentModelConfig = {
+          ...merged,
+          baseUrl: (merged.baseUrl || '').trim(),
+          apiKey: cleanKey,
+          model: (merged.model || '').trim()
+        }
+        set({ config: sanitized })
+        // 自愈历史脏配置：检测到空白残留或格式自动修正时立即回写清洗后的值
+        const raw = cfg.agentConfig
+        if (
+          sanitized.apiKey !== (raw.apiKey || '') ||
+          sanitized.baseUrl !== (raw.baseUrl || '') ||
+          sanitized.model !== (raw.model || '')
+        ) {
+          void get().saveConfig()
+        }
       }
```

```diff
-  clearMessages: () => set({ messages: [] }),
```

```diff
+  resetSession: async () => {
+    try {
+      await window.api?.agentResetSession?.()
+    } catch (err) {
+      console.error('[useAgentStore] resetSession failed:', err)
+    }
+    set({ messages: [], isGenerating: false })
+  },
```

---

## 第十一步：配置 store 同样订阅广播 —— **src/renderer/src/stores/useConfigStore.ts**

改动缘由：主题与路径也在设置窗口里改，主窗口需要即时生效，逻辑与 AI store 一致，用模块级标记保证只订阅一次（Zustand store 在多个窗口、多个组件里都会初始化）。

```diff
+/** 跨窗口配置广播只订阅一次（设置窗口改主题/路径后，其余窗口即时生效） */
+let configUpdatedSubscribed = false
```

```diff
   loadConfig: async () => {
+    if (!configUpdatedSubscribed && window.api?.onConfigUpdated) {
+      configUpdatedSubscribed = true
+      window.api.onConfigUpdated(() => {
+        void get().loadConfig()
+      })
+    }
     try {
       const cfg = await window.api.getConfig()
```

---

## 第十二步：给设置窗口开一条 hash 路由 —— **src/renderer/src/App.tsx**

改动缘由：设置页要跑在独立窗口里，但复用同一个渲染 bundle，只能靠 URL 区分。沿用既有的 `#deck-editor` 约定加一条 `#settings`，在渲染主入口最前面分流。

```diff
 import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
+import { SettingsApp } from './components/Settings/SettingsApp'
```

```diff
   const isDeckEditor = window.location.hash === '#deck-editor'
+  const isSettingsWindow = window.location.hash === '#settings'
 
   useEffect(() => {
     loadConfig()
   }, [loadConfig])
 
+  if (isSettingsWindow) {
+    return <SettingsApp />
+  }
+
   if (isDeckEditor) {
```

---

## 第十三步：AI 顾问设置页落成独立组件 —— **src/renderer/src/components/Settings/AgentSettingsContent.tsx**

改动缘由：配置从会话面板搬到设置窗口后，需要有承载"连接提供商 → 选模型 → 调对话参数"三步走的地方。设计上取法 VSCode / OpenCode：改动即时落盘，文本输入失焦才提交，避免每次按键都写配置文件。连接这一步刻意先"实测再保存"——用 `/v1/models` 探一次，只有明确的 HTTP 401（Key 被厂商拒绝）才拦下不允许保存，其它错误放行但如实提示，避免把无效密钥写进配置后聊天与拉列表连锁失败。

```diff
+/** 混淆 API Key：仅显示前 4 与后 4 位 */
+function maskApiKey(key: string): string {
+  if (key.length <= 8) return '••••••••'
+  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
+}
+
+/** 通用凭据清洗：去除首尾空格、外层引号与不可见字符 */
+function cleanApiKey(key: string): string {
+  return key
+    .trim()
+    .replace(/^["']|["']$/g, '')
+    .replace(/[\u200B-\u200D\uFEFF]/g, '')
+}
+
+/** 将当前配置聚合为「已连接提供商」视图 */
+function toConnection(
+  cfg: AgentModelConfig,
+  presets: AgentProviderPreset[]
+): AgentProviderConnection {
+  const preset = presets.find((p) => p.baseUrl === cfg.baseUrl)
+  return {
+    id: preset?.id || 'custom',
+    name: preset?.name || cfg.provider || '自定义提供商',
+    baseUrl: cfg.baseUrl,
+    kind: preset ? 'preset' : 'custom',
+    hasApiKey: Boolean(cfg.apiKey.trim()),
+    model: cfg.model
+  }
+}
```

```diff
+  /** 即时落盘：更新本地草稿 + store + 配置文件 */
+  const apply = (next: AgentModelConfig): void => {
+    setDraft(next)
+    updateConfig(next)
+    void saveConfig()
+  }
+
+  // 拉取模型列表（凭据用入参显式传入：连接后立即拉取时，本次渲染闭包里的 draft 可能还是旧值）
+  const refreshModels = async (override?: { baseUrl?: string; apiKey?: string }): Promise<void> => {
+    if (!window.api?.agentFetchModels) return
+    const baseUrl = override?.baseUrl ?? draft.baseUrl
+    const apiKey = override?.apiKey ?? draft.apiKey
+    if (!baseUrl?.trim()) return
+    setModelsLoading(true)
+    setModelsError('')
+    setModelsList([])
+    const res = await window.api.agentFetchModels({
+      baseUrl,
+      apiKey: apiKey || ''
+    })
+    if (res.success && res.models) {
+      setModelsList(res.models)
+    } else {
+      setModelsError(res.error || '拉取失败')
+    }
+    setModelsLoading(false)
+  }
```

```diff
+  /**
+   * 实测凭据是否被厂商接受：HTTP 401 说明 key 被明确拒绝，此时不允许保存，
+   * 避免把无效密钥写进配置后 chat 与拉取全部连锁失败（厂商其余错误不拦，允许连接）
+   */
+  const validateCredential = async (
+    baseUrl: string,
+    apiKey: string
+  ): Promise<{ ok: boolean; error?: string }> => {
+    if (!window.api?.agentFetchModels) return { ok: true }
+    const cleaned = cleanApiKey(apiKey)
+    const probe = await window.api.agentFetchModels({ baseUrl, apiKey: cleaned })
+    if (probe.success) return { ok: true }
+    const err = probe.error || '未知错误'
+    if (err.includes('HTTP 401') || err.includes('身份验证失败')) {
+      return { ok: false, error: err }
+    }
+    return { ok: true, error: err }
+  }
```

```diff
+  /** 断开当前提供商（清空 Key 并立即落盘，保留 baseUrl 以便重连） */
+  const disconnect = (): void => {
+    apply({ ...draft, apiKey: '', model: '' })
+    setTestResult(null)
+  }
+
+  /** 从预设发起连接 */
+  const connectPreset = (p: AgentProviderPreset): void => {
+    setConnectingId(p.id)
+    setKeyInput('')
+    setConnectError('')
+    setDraft((d) => ({ ...d, baseUrl: p.baseUrl, model: d.model || p.model }))
+  }
```

---

## 第十四步：活动栏底部放设置入口 —— **src/renderer/src/components/LeftSidebar/LeftSidebar.tsx**

改动缘由：设置入口原本在菜单栏里（后面会移除），按 VSCode 惯例挪到活动栏最底部常驻，点一下唤起独立设置窗口。顺带把背后灵页签的高亮色从写死的琥珀色改成主题色变量，让它在深浅两套主题下都能读。

```diff
-import { BookOpen, Bot, FolderKanban } from 'lucide-react'
+import { BookOpen, Bot, FolderKanban, Settings2 } from 'lucide-react'
```

```diff
+        {/* 底部固定：全局设置 (VSCode 风格入口，打开独立设置窗口) */}
+        <div className="mt-auto flex flex-col items-center gap-1 w-full">
+          <button
+            type="button"
+            onClick={() => void window.api.openSettingsWindow()}
+            title="设置 (打开全局设置窗口：外观、路径与目录、AI 顾问)"
+            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
+          >
+            <Settings2 className="w-[18px] h-[18px]" />
+          </button>
+        </div>
```

```diff
             {isLeftOpen && activeLeftTab === 'agent' && (
-              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-amber-500 rounded-r" />
+              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-primary rounded-r" />
             )}
```

```diff
                 isLeftOpen && activeLeftTab === 'agent'
-                  ? 'text-amber-500 bg-amber-500/15 shadow-xs'
-                  : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10'
+                  ? 'text-foreground bg-accent/60 shadow-xs'
+                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
```

---

## 第十五步：背后灵面板只留对话，配置交给设置窗 —— **src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx**

改动缘由：面板里的"设置 Tab"（预设服务商、Base URL、Key、模型、保存按钮）与新的独立设置窗完全重复，两套入口迟早改漏一处，整块删掉；本地的 `PRESET_ENDPOINTS` 常量也一并移交给主进程的 `PROVIDER_PRESETS`。清空按钮从 `clearMessages` 换成 `resetSession`，才能真正丢掉模型侧的多轮上下文。另外补一处引导：没配 Key 时空状态直接告诉用户去哪配，以及新增的过程状态提示条。

```diff
-const PRESET_ENDPOINTS = [
-  { name: 'DeepSeek 官方', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', reasoningModel: 'deepseek-reasoner' },
-  ...
-]
```

```diff
   const {
-    activeTab,
     isGenerating,
     config,
     messages,
-    setActiveTab,
-    updateConfig,
     loadConfig,
-    saveConfig,
-    clearMessages,
+    resetSession,
     sendMessage,
     abort,
     applyProposalsToDuel
   } = useAgentStore()
```

```diff
-          {activeTab === 'chat' && messages.length > 0 && (
+          {messages.length > 0 && (
             <button
               type="button"
-              onClick={clearMessages}
-              title="清空对话"
+              onClick={() => void resetSession()}
+              title="清空对话并重置 AI 会话"
```

```diff
+                  {/* 过程状态提示（自动重试 / 超时中断 / 会话重置） */}
+                  {msg.status && (
+                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
+                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
+                      <span>{msg.status}</span>
+                    </div>
+                  )}
```

```diff
               <h3 className="text-xs font-bold text-foreground">我是您的决斗创作者背后灵</h3>
+              {!config.apiKey && (
+                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
+                  尚未连接模型提供商：点击窗口左下角的「设置」，
+                  在独立设置窗中连接提供商并选用模型。
+                </p>
+              )}
```

---

## 第十六步：菜单栏移除设置项 —— **src/renderer/src/components/Header/MenuBar.tsx**

改动缘由：设置既已统一到独立窗口，菜单栏里那套"设置"下拉（主题、cdb、游戏目录、工程目录）就成了第二入口，留着必然出现两处状态不同步，整块删除。随之 `checked` 字段（只为主题单选服务）与相关图标、store 依赖一并清理，菜单结构回到"文件 / 编辑 / 剧情台本 / 帮助"。

```diff
-  Sun,
-  Moon,
-  Database,
-  Folder,
   Keyboard,
   Info,
-  Check,
   Coffee,
```

```diff
-    {
-      id: 'settings',
-      label: '设置',
-      items: [
-        { label: '浅色模式', icon: Sun, checked: !isDark, action: () => setTheme('light') },
-        { label: '深色模式', icon: Moon, checked: isDark, action: () => setTheme('dark') },
-        { label: '', separator: true },
-        { label: config.cdbPath ? '更换 cards.cdb 数据库...' : '加载 cards.cdb 数据库...', icon: Database, action: () => selectCdbFile() },
-        { label: '设置 YGOPro 游戏目录 (本地卡图)...', icon: Folder, action: () => selectGameDir() },
-        { label: ..., icon: FolderKanban, action: () => selectProjectsDir() }
-      ]
-    },
```

```diff
                         <div className="flex items-center gap-2">
-                          {item.checked !== undefined ? (
-                            <span className="w-3.5 h-3.5 flex items-center justify-center">
-                              {item.checked && <Check className="w-3.5 h-3.5" />}
-                            </span>
-                          ) : (
-                            Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />
-                          )}
+                          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                           <span>{item.label}</span>
```

---

## 第十七步：面板顶栏统一收尾 —— **src/renderer/src/components/CardDetail/CardDetailPanel.tsx**

改动缘由：这一轮把设置从面板内、菜单栏里全部收走后，各面板顶栏的"收起"按钮成了新的不一致来源（背后灵面板已去掉，卡片详情还留着）。统一只保留标题，关面板交给活动栏页签，顶栏视觉自此对齐。

```diff
-import { HelpCircle, ZoomIn, X, Copy, Check, BookOpen, PanelLeftClose } from 'lucide-react'
+import { HelpCircle, ZoomIn, X, Copy, Check } from 'lucide-react'
```

```diff
         <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
-          <div className="flex items-center gap-1.5 min-w-0">
-            <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
-            <span className="text-xs font-bold text-foreground">卡片详情</span>
-          </div>
-          <button
-            type="button"
-            onClick={() => useDuelStore.getState().setLeftOpen(false)}
-            title="收起左侧面板"
-            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
-          >
-            <PanelLeftClose className="w-3.5 h-3.5" />
-          </button>
+          <span className="text-xs font-bold text-foreground">卡片详情</span>
         </div>
```

---

## 改动文件一览

| 文件 | 角色 |
| --- | --- |
| **src/shared/types/ipc.ts** | 新增提供商预设、模型信息、status 事件与 5 个 IPC 契约 |
| **src/main/services/agentService.ts** | 模型列表代理、会话复用、system 消息注入、失败原因核查、看门狗 |
| **src/main/ipc/registerIpc.ts** | 注册 `agent:reset-session` / `agent:fetch-models` / `agent:get-provider-presets` / `window:open-settings` |
| **src/main/services/configService.ts** | 配置写盘后向所有窗口广播 `config:updated` |
| **src/preload/index.ts** | 桥接新方法与配置广播订阅 |
| **src/renderer/src/stores/useAgentStore.ts** | status 事件、会话重置、配置清洗自愈、广播订阅 |
| **src/renderer/src/stores/useConfigStore.ts** | 订阅配置广播 |
| **src/renderer/src/App.tsx** | `#settings` hash 路由 |
| **src/renderer/src/components/Settings/AgentSettingsContent.tsx** | 新增：提供商 / 模型 / 对话三分区设置页 |
| **src/renderer/src/components/LeftSidebar/LeftSidebar.tsx** | 活动栏底部设置入口、页签主题色 |
| **src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx** | 移除内嵌设置 Tab，改为纯对话 + 状态提示 |
| **src/renderer/src/components/Header/MenuBar.tsx** | 移除设置菜单 |
| **src/renderer/src/components/CardDetail/CardDetailPanel.tsx** | 顶栏统一，移除收起按钮 |
