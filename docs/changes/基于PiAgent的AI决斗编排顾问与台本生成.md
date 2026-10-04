# 基于 Pi Agent 的伴随式 AI 决斗推演顾问「背后灵」与 VSCode 风格活动栏架构

本次提交属于一次高内聚的系统级功能落地与交互重构，旨在彻底打通项目核心定位中的**「同人剧情对局编排」与「智能战术推演」**能力。

依托前期已完成的无头规则引擎（`ocgcore-wasm`）与剧本排版生成器（`screenplayGenerator`），本次改动全面引入 `@earendil-works/pi-coding-agent` SDK，在主进程构建了一个**精通游戏王规则的 AI 决斗编排与剧本顾问「背后灵」**。并在桌面端交互架构上，经历了从「右侧抽屉遮挡」到**「对齐 VSCode 体验的左侧极窄活动栏（Activity Bar）」**的深度演进，实现了情报、棋盘与编排三栏并行的完美创作体验。

---

## 交互设计与架构演进历程

### 1. 痛点洞察：为什么放弃「右侧抽屉/并排窗口」？

- **初版设计问题**：初版将 AI 顾问入口置于顶栏，点击后在右侧滑出抽屉或与右侧栏并排。这直接导致两个致命问题：
  1. **遮挡工作流**：遮挡了创作者赖以排布卡片、调整动作的【步骤编排】与【卡片检索】栏；
  2. **压缩战场视野**：若右侧强行并排双列（320px + 440px = 760px），中央决斗战场（DuelBoard）会被极限挤压成狭长条带，完全无法看清怪兽区、魔陷区与指示物。

### 2. 终局方案：对齐 VSCode 活动栏（Activity Bar）的左侧工作台

创作者在构思剧情时，心理模型实际上分为三层：

- **左侧（情报与智囊）**：查阅当前选定卡片效果（`卡片详情`）或与 AI 探讨战术路线与台词（`背后灵`）；
- **中央（主决斗战场）**：超宽、全景呈现双方场面、生命值、连锁与指示物（`DuelBoard`）；
- **右侧（动作执行与检索）**：卡库检索拖拽上场（`CardSearchPanel`）与时间线动作序列（`StepSequencerPanel`）。

当在左侧让背后灵生成战术提案后，点击【一键应用到决斗】，推演步骤自左向右自然注入到中央战场与右侧编排栏中，视野开阔且毫无遮挡。

---

## 开发者思考脉络与代码改动

### 第一步：双端共享层 IPC 通信契约与数据模型定义

- **思考与改动缘由**：
  在引入 AI 编排顾问之前，首要任务是在进程间共享层（`@shared`）确立严谨、类型安全的数据通信契约：
  1. **模型配置契约（`AgentModelConfig`）**：支持自定义主流兼容 OpenAI 标准格式的大语言模型服务商（如 DeepSeek V3/R1、通义千问、Kimi、Ollama、SiliconFlow 等），涵盖 Base URL、API Key、Model ID、系统设定与深度思考开关，并将其扩展至全局持久化配置 `AppConfig` 中；
  2. **结构化提案契约（`AgentStepProposal`）**：AI 生成的战术绝非纯文本，包含清晰的回合数、阶段（DP/SP/M1/BP/M2/EP）、行动者、动作类型（通常召唤/特殊召唤/发动效果/攻击宣言/受到伤害/角色对白等）、卡密与卡名、角色台词、内心独白与战术逻辑，可无损转换为 `DuelStep`；
  3. **实时事件流契约（`AgentStreamEvent`）**：定义思考流（`thinking_delta`）、文本流（`text_delta`）、工具调用生命周期（`tool_call_start` / `tool_call_end`）与提案就绪（`proposals_ready`）等事件，支撑前端流畅的流式生成动画与状态感知；
  4. **扩展 `IpcApi`**：声明 `agentSendMessage`、`agentAbort` 与事件监听器 `onAgentEvent`。

**src/shared/types/ipc.ts**

```diff
 import { CdbCard } from './card'
 import { DuelPuzzleState } from './duel'
 import { DeckData } from './deck'
+import { DuelPhase, DuelActionType } from './story'

 /**
  * 卡片检索查询参数
@@ -47,6 +48,64 @@
 }

 /**
+ * AI 决斗顾问大模型配置
+ */
+export interface AgentModelConfig {
+  /** 模型提供商标识 (默认 openai-compatible) */
+  provider?: string
+  /** API 基础服务地址 (如 https://api.deepseek.com/v1) */
+  baseUrl: string
+  /** API 密钥 */
+  apiKey: string
+  /** 模型名称 (如 deepseek-chat, deepseek-reasoner, qwen-plus) */
+  model: string
+  /** 自定义系统提示词 */
+  systemPrompt?: string
+  /** 是否启用深度思考/推理模式 */
+  enableReasoning?: boolean
+}
+
+/**
+ * AI 结构化步骤提案 (与 DuelStep 对齐，可一键导入对局)
+ */
+export interface AgentStepProposal {
+  turn: number
+  phase: DuelPhase
+  actionPlayer: 0 | 1
+  actionType: DuelActionType
+  cardCode?: number
+  cardName?: string
+  speaker?: string
+  dialogue?: string
+  innerThoughts?: string
+  description?: string
+  chainIndex?: number
+  lpChange?: {
+    player: 0 | 1
+    oldLp: number
+    newLp: number
+  }
+}
+
+/**
+ * AI 流式推送事件
+ */
+export type AgentStreamEvent =
+  | { type: 'thinking_delta'; delta: string }
+  | { type: 'text_delta'; delta: string }
+  | { type: 'tool_call_start'; id: string; toolName: string; params: Record<string, unknown> }
+  | { type: 'tool_call_end'; id: string; toolName: string; resultSummary: string }
+  | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
+  | { type: 'error'; message: string }
+  | { type: 'done'; fullText: string; proposals: AgentStepProposal[] }
+
+/**
+ * 发送给 AI 顾问的消息参数
+ */
+export interface AgentSendMessageParams {
+  prompt: string
+  boardState?: DuelPuzzleState
+  configOverride?: Partial<AgentModelConfig>
+}
+
+/**
+ * AI 顾问消息响应结果
+ */
+export interface AgentSendMessageResult {
+  success: boolean
+  content?: string
+  thought?: string
+  proposals?: AgentStepProposal[]
+  error?: string
+}
+
+export interface IpcApi {
   // ...
+  agentSendMessage: (params: AgentSendMessageParams) => Promise<AgentSendMessageResult>
+  agentAbort: () => Promise<void>
+  onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void
 }
```

#### 通信协议设计思考与核心参数解析

这套类型是专门为本项目的 AI 决斗编排顾问（背后灵）功能设计的。它的本质是：**主进程（Node.js 侧运行的 AI Agent）向渲染进程（React 侧 UI）实时单向推送的 IPC 流式事件协议（Discriminated Union，可辨识联合类型）**。

##### 设计背景与解决的痛点

在游戏王对局编排中，AI 顾问需要做很多耗时操作（思考战术、查询本地卡库 CDB、读取盘面卡片、甚至调用 ocgcore 规则引擎校验时点），一次完整生成往往需要耗费数秒到数十秒。

如果使用传统的 IPC `invoke`（一次性等待返回），前端只能一直转圈等待，体验极差。因此设计了这套**细粒度的流式推送协议**，主进程每产生一点进展（思考、说话、调工具、推演完步骤），就通过 `agent:event` 广播出去，前端根据 `event.type` 做精准的局部增量渲染。

##### 协议设计逻辑与思考过程

这套设计是基于**契约优先设计（Contract-First Design）**与**领域事件建模（Domain Events）**推导出来的。很多人在开发时容易陷入“框架有什么我就调什么”的习惯（直接把大模型 SDK 的原始流对象或库的数据结构透传到组件里），而本协议的设计遵循了以下思考过程：

- **逆向倒推法：从「用户在屏幕前想看到什么」出发**
  不去想底层用了什么 AI 库，而是先想决斗创作者在使用软件时的感受：
  - 用户不想面对一个死机般的等待圈 → 需要打字机正文（`text_delta`）；
  - 用 DeepSeek-R1 这类模型时，用户想知道它在算什么伏笔 → 需要思考过程（`thinking_delta`）；
  - AI 查卡库、读盘面时，用户需要知道它在干什么（比如“正在查黑魔术师...”），而不是以为程序卡了 → 需要工具调用的起止（`tool_call_start` / `tool_call_end`）；
  - 构思完了，创作者需要点击一个按钮把卡片和对白一键铺上战场 → 需要专属的战术提案（`proposals_ready`）。
  **UI 上需要这几类状态，反推回来，通信协议里就必须恰好有这几种事件。**

- **解耦思维：绝不让第三方框架“绑架”前端**
  如果直接在前端去监听某个特定框架（比如直接用 LangChain、Pi Agent 或 OpenAI SDK 的原生事件）：哪天想把底层换成 Claude SDK 或本地 Python 进程，前端组件和 Store 全得重写。
  **好的架构就像插座和插头**：主进程和渲染进程之间只认这 7 个标准化事件。底层哪怕换了 10 种大模型框架，只要在主进程把它们翻译成这 7 个事件，**前端 React 代码连一个字母都不需要动**。

- **为什么长成这样？（TypeScript 的「可辨识联合类型」）**
  这种设计模式在 TypeScript / Rust 里叫 **Discriminated Union（可辨识联合）**：
  所有的事件共用一个 `type` 字段作为标签；每一类的参数完全独立。当前端写 `if (event.type === 'tool_call_start')` 时，TypeScript 会**自动把类型收窄**，代码补全立刻知道它有 `params`，而不会出现 `event.delta` 这种无关字段，编译期就能把所有低级 bug 拦截掉。

##### 各流式事件的具体定义逻辑（按 Agent 生命周期划分）

| 事件 `type` | 携带数据 | 设计逻辑与前端交互映射 |
| :--- | :--- | :--- |
| **`thinking_delta`** | `delta: string` | **深度思考增量**：支持像 DeepSeek-R1 等具备推理链（Reasoning）的模型，将模型在输出正文前的思考过程流式推给前端，渲染成可折叠的「思考中...」模块。 |
| **`text_delta`** | `delta: string` | **正文打字机增量**：模型生成的对话、解说台词等内容，逐字追加到界面气泡中，提供即时的打字机反馈。 |
| **`tool_call_start`** | `id, toolName, params` | **工具调用开始**：当 Agent 决定调用工具（如 `search_cards` 查卡表、`get_current_board` 读当前盘面）时发射。前端 UI 立即显示一个“正在查卡/正在读取双方场面...”的加载步骤气泡。 |
| **`tool_call_end`** | `id, toolName, resultSummary` | **工具调用完成**：工具执行完毕后发射，携带简洁摘要（如 `“找到 15 张匹配卡片”` 或 `“规则引擎校验通过”`），前端将加载动画变为绿色的完成状态，让创作者直观看到 AI 调用的透明依据。 |
| **`proposals_ready`** | `proposals: AgentStepProposal[]` | **战术推演步骤就绪（核心业务事件）**：当 Agent 构思完战术并调用了 `propose_duel_steps` 后发射。前端接收到结构化的步骤数据（包含回合、阶段、卡密、召唤/发动动作、台词、内心戏、LP变动），立即在界面展示「一键导入场面/生成台本」的操作卡片。 |
| **`error`** | `message: string` | **异常中断**：当网络失败、API Key 错误或用户主动点击“中断”按钮时发射，前端立即终止加载动画，并红字提示错误信息。 |
| **`done`** | `fullText, proposals` | **最终收敛事件**：全流程结束。携带完整的文本与最终战术提案做最后兜底校验，前端将 `isGenerating` 状态重置为 `false`。 |

##### 什么是 delta（德尔塔）？

`delta` 来源于希腊字母 **Δ（Delta）**（数学和物理里常用来表示**“增量 / 变化量”**）。

在大模型（LLM）的流式打字机传输中，它是**工业界事实上的标准命名**（OpenAI、Claude、DeepSeek 的官方 API 结构里都叫 `delta`）：

- **如果不用 delta（发送全量）**：
  - 第 1 秒推送：`"我"`
  - 第 2 秒推送：`"我觉"`
  - 第 3 秒推送：`"我觉得"`
  - 这种方式既浪费内存，又浪费带宽（每次都要重发前面的字，数据量成倍膨胀）。
- **使用 delta（只发增量）**：
  - 第 1 秒推送：`delta = "我"`
  - 第 2 秒推送：`delta = "觉"`
  - 第 3 秒推送：`delta = "得"`
  - 前端拿到之后，只需要做一件事：`content = content + event.delta`（像打字机一样把新字拼上去）。

在这个协议中，区分了两种 delta：
- **`thinking_delta`**：模型**深度思考/思维链**的增量字（例如 DeepSeek-R1 的思考过程），用来拼在折叠的「思考框」里。
- **`text_delta`**：模型**最终回答正文**的增量字，用来拼在聊天气泡里。

##### 什么是 proposals（提案）及其作用？

`proposal` 的英文本意是**“提议、方案”**。在决斗编辑器中，它特指 **`AgentStepProposal[]`（AI 给出的结构化决斗推演步骤列表）**。

它是连接 **AI 自然语言对话** 与 **决斗编辑器核心战场** 的**数据桥梁**。

- **为什么不直接叫 `steps`（步骤），而叫 `proposals`？**
  因为这是作为“顾问”的 AI 生成的**建议性步骤**。创作者才是导演：
  - AI 推演出一串精妙战术（如：“第 1 回合 M1 阶段，我方发动《羽毛扫》，角色大喊台词，对方 LP 扣除 1000...”）；
  - 它**不能**擅自强行修改用户的战场，而是把这组数据打包成一个 `proposals` 提出来；
  - 前端会把它渲染成一张带有「**一键应用到决斗**」或者「**生成 Markdown 剧本**」按钮的卡片，供创作者审查或采纳。

- **如果没有它 vs 有了它**：
  - **如果没有这个参数（仅普通聊天）**：
    AI 只能在气泡里用纯文本说：*“第 1 回合主要阶段 1，主角通常召唤《黑魔导女孩》，大喊台词‘上吧！’，然后进入战斗阶段攻击，对方受到 2000 点伤害……”*。用户只能看个乐，然后自己手动去下方的步骤轴里一步一步手动选卡、选阶段、敲台词。
  - **有了这个参数后（自动化编排）**：
    AI 在战术构思完毕后，会把这串战术打包成结构化的 JSON 步骤数组（`proposals`）一起返回。前端聊天气泡下方会立刻弹出一个卡片区：
    > 🎛️ **生成战术步骤提案 (3)**  
    > 按钮：**【一键应用到决斗】**

- **点击【一键应用到决斗】时会发生什么？**
  在前端代码 `useAgentStore.ts` 中，当点击该按钮时：

  ```typescript
  applyProposalsToDuel: (proposals) => {
    for (const p of proposals) {
      // 直接把 AI 生成的数据灌入主编辑器的步骤轴
      addStep({
        turn: p.turn,           // 第几回合
        phase: p.phase,         // 阶段 (DP/SP/M1/BP/M2/EP)
        actionPlayer: p.actionPlayer, // 行动方 (0我方 / 1对方)
        actionType: p.actionType,     // 动作类型 (通常召唤/特殊召唤/攻击/发动效果等)
        cardCode: p.cardCode,   // 8位真实卡密 (如 46986414)
        cardName: p.cardName,   // 中文卡名
        speaker: p.speaker,     // 说话角色名
        dialogue: p.dialogue,   // 角色台词
        innerThoughts: p.innerThoughts, // 内心博弈独白
        lpChange: p.lpChange    // 扣血数值 (如 8000 -> 6000)
      })
    }
  }
  ```

  这些步骤会**立刻同步到下方的「步骤推演（StepSequencer）」面板和剧本导出器中**，省去创作者手动配置步骤的繁琐操作。

- **核心区分**：
  - `content`：是生成给**人读**的自然语言解释与剧情描写；
  - `proposals`：是生成给**软件程序执行**的结构化数据。有了 `proposals`，AI 顾问才从一个“只能陪聊的机器人”变成了真正能帮你“做场编排”的助手。

##### 其他关键参数含义

- **`tool_call_start` 与 `tool_call_end`（工具调用起止）**：
  - **`id`**：这次调用的唯一流水号。因为 AI 可能会连续查好几张卡，前端需要用 `id` 来匹配“哪个工具调用完成了”。
  - **`toolName`**：调用的工具名字（例如 `search_cards` 查卡片数据库、`get_current_board` 读当前场地、`validate_with_ocgcore` 规则校验）。
  - **`params`**：AI 传给这个工具的具体参数（比如 `{ keyword: "青眼白龙", limit: 10 }`）。
  - **`resultSummary`**：工具执行完成后的精炼摘要（比如 `"找到 15 张匹配卡片"` 或 `"ocgcore 模拟校验通过"`），直接用来在界面上点亮一个绿色的小标签。
- **`error` $\rightarrow$ `message`**：出错时的具体错误信息（如“API Key 未填写”、“用户主动中断”）。
- **`done` $\rightarrow$ `fullText`**：AI 说完最后一句话时推送的**完整最终文本**，前端拿它做一次最终校验与存档，并把“思考中”动画关掉。

---

### 第二步：主进程 Agent 服务封装（Pi Agent SDK 整合与本地四大工具定义）

- **思考与改动缘由**：
  在 **src/main/services/agentService.ts** 中创建 `AgentService` 单例。利用 Pi Agent SDK 提供的 `Agent` 与工具注册机制，封装具有决斗专家人设的伴随式背后灵：
  1. **工具 1：`search_cards`**：基于本地 `cdbService` 毫秒级模糊匹配卡名与效果描述，杜绝大模型凭空捏造假卡或魔法卡密码；
  2. **工具 2：`get_board_state`**：读取用户当前传入的 `DuelPuzzleState`，感知怪兽攻守表示、魔陷盖伏、手牌、墓地与 LP 分布；
  3. **工具 3：`propose_duel_steps`**：提供精确校验的结构化战术步骤提案，支持生成角色对白与心理博弈；
  4. **工具 4：`verify_rule_legal`**：对接主进程本地卡库与规则常识，为创作者排查时点错漏与村规口胡；
  5. **流式分发与协同**：通过 `BrowserWindow.webContents.send('agent:event', event)` 向渲染进程实时分发思考链与文本 token；
  6. **中断支持**：支持 `abortController.abort()` 随时中断漫长生成。

**src/main/services/agentService.ts**

```typescript
// 核心片段：创建包含四大工具的 Pi Agent 实例
const agent = new Agent({
  model: currentModel,
  systemPrompt: buildSystemPrompt(config),
  tools: [
    createSearchCardsTool(cdbService),
    createGetBoardStateTool(() => currentBoardState),
    createProposeDuelStepsTool(),
    createVerifyRuleLegalTool(cdbService)
  ]
})
```

---

### 第三步：主进程 IPC 路由注册与 Preload 安全桥接

- **思考与改动缘由**：
  严格遵守四件套规范，在 `registerIpc.ts` 与 `preload/index.ts` 中注册安全通信通道，不让 Renderer 直接接触任何 Node API。

**src/main/ipc/registerIpc.ts**

```diff
+  ipcMain.handle('agent:send-message', async (_event, params: AgentSendMessageParams) => {
+    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
+    return agentService.sendMessage(params, win?.webContents)
+  })
+
+  ipcMain.handle('agent:abort', async () => {
+    agentService.abort()
+  })
```

**src/preload/index.ts**

```diff
+  // AI 决斗推演顾问 (背后灵)
+  agentSendMessage: (params) => ipcRenderer.invoke('agent:send-message', params),
+  agentAbort: () => ipcRenderer.invoke('agent:abort'),
+  onAgentEvent: (callback) => {
+    const handler = (_: unknown, event: unknown): void => callback(event as AgentStreamEvent)
+    ipcRenderer.on('agent:event', handler)
+    return () => {
+      ipcRenderer.removeListener('agent:event', handler)
+    }
+  }
```

---

### 第四步：左侧活动栏状态管理（useDuelStore 与 useAgentStore）

- **思考与改动缘由**：
  为支撑 VSCode 风格活动栏与多模态面板切换：
  1. 在 **src/renderer/src/stores/useDuelStore.ts** 中扩充左侧栏状态：
     - `activeLeftTab: 'card' | 'agent'`（当前激活的视图：卡片详情 vs 背后灵）；
     - `isLeftOpen: boolean`（左侧面板展开/收起，默认展开）；
     - `leftWidth: number`（左侧面板宽度，默认 340px，限制在 280~600px 间可拖拽）；
     - `toggleLeftTab(tab)`：核心交互逻辑——若点击非当前激活项则切换并确保展开；若点击当前已激活项则折叠收起。
  2. 在 **src/renderer/src/stores/useAgentStore.ts** 中管理背后灵推演上下文：
     - 流式消息列表、思考过程展开状态、工具调用动态记录；
     - 预设大模型配置（DeepSeek、DashScope、SiliconFlow、Ollama）与本地保存；
     - `applyProposalsToDuel(proposals)`：一键将提案批量追加至决斗步骤中。

**src/renderer/src/stores/useDuelStore.ts**

```diff
   // 战术全息透视浮层
   tacticalView: boolean
+
+  // 左侧栏模态 (VSCode 风格活动栏与多模态面板)
+  activeLeftTab: 'card' | 'agent'
+  isLeftOpen: boolean
+  leftWidth: number
+  setActiveLeftTab: (tab: 'card' | 'agent') => void
+  setLeftOpen: (open: boolean) => void
+  toggleLeftTab: (tab: 'card' | 'agent') => void
+  setLeftWidth: (width: number) => void
```

---

### 第五步：VSCode 风格左侧活动栏（LeftSidebar.tsx）

- **思考与改动缘由**：
  彻底取代传统的顶部切换与侧边抽屉，建立 **src/renderer/src/components/LeftSidebar/LeftSidebar.tsx**：
  1. **极窄活动栏（Activity Bar: 48px）**：
     - 位于最左侧，包含 `[📖 卡片详情]` 与 `[🤖 背后灵]` 两个核心视图图标；
     - 激活项左侧展示与 VSCode 一致的竖向指示条（`before:w-[2.5px]`）；
     - 背后灵推演生成中具备金黄色呼吸脉冲圆点指示；
     - 去除底部所有冗余图标（如设置与额外折叠按钮），直接复用点击同名图标自然折叠/展开；
  2. **可调宽主面板**：
     - 展开时根据 `activeLeftTab` 动态挂载 `<CardDetailPanel />` 或 `<BehindSpiritPanel />`；
     - 右侧边缘带有拖拽把手（`cursor-col-resize hover:bg-amber-500`），支持自由调整宽度；
     - 折叠时仅保留 48px 图标条，将中央决斗战场横向宽度释放至最大化。

**src/renderer/src/components/LeftSidebar/LeftSidebar.tsx**

```tsx
export function LeftSidebar(): JSX.Element {
  const { activeLeftTab, isLeftOpen, leftWidth, toggleLeftTab, setLeftWidth } = useDuelStore()
  const { isGenerating, setOpen: setAgentStoreOpen } = useAgentStore()

  return (
    <aside className="h-full flex shrink-0 select-none overflow-hidden">
      {/* VSCode 风格最左侧活动栏 (Activity Bar: 标准 48px 宽度) */}
      <div className="w-12 h-full border-r border-border bg-muted/40 dark:bg-neutral-900/80 flex flex-col items-center justify-start py-2 shrink-0 select-none z-10">
        <div className="flex flex-col items-center gap-1 w-full">
          {/* 卡片详情 */}
          <button onClick={() => toggleLeftTab('card')}>
            <BookOpen className="w-[18px] h-[18px]" />
          </button>
          {/* 背后灵 */}
          <button
            onClick={() => {
              toggleLeftTab('agent')
              setAgentStoreOpen(true)
            }}
          >
            <Bot
              className={cn('w-[18px] h-[18px]', isGenerating && 'animate-pulse text-amber-500')}
            />
          </button>
        </div>
      </div>

      {/* 可拖拽主内容面板 */}
      {isLeftOpen && (
        <div
          style={{ width: leftWidth }}
          className="h-full flex flex-col shrink-0 relative border-r border-border bg-card/40"
        >
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-500"
          />
          {activeLeftTab === 'card' ? <CardDetailPanel /> : <BehindSpiritPanel />}
        </div>
      )}
    </aside>
  )
}
```

---

### 第六步：双面板细节精简与顶栏规范化

- **思考与改动缘由**：
  根据用户体验细节反馈，对两个面板的顶栏进行统一重构：
  1. **卡片详情面板**（**CardDetailPanel.tsx**）：
     - 统一 40px 高度顶栏，展示清晰的「卡片详情」标题；
     - **去除冗余卡名**：移除顶栏重复的卡名药丸徽标，标题栏保持纯净；
     - **去除放大镜图标**：用户直接点击卡图即可查看高清大图，移除顶栏多余的缩放按钮；
     - 右侧保留面板收起折叠按钮。
  2. **背后灵工作台**（**BehindSpiritPanel.tsx**）：
     - 统一 40px 高度顶栏，展示「背后灵」与当前生效模型名称；
     - 切换「对话」与「设置」Tab，支持快速切换 DeepSeek/通义千问/SiliconFlow/Ollama 预设；
     - 常用提词胶囊（逆转路线、热血对白、时点排雷）；
     - 消息气泡深度融合：支持展开模型思考链、工具调用动态记录（`search_cards` 等）；
     - 结构化步骤提案卡片（**AiProposalCard.tsx**），支持一键批量注入决斗步骤。
  3. **顶部导航栏精简**（**Header.tsx**）：
     - 彻底移除顶部工具栏中原先的「背后灵」按钮，实现「视图切换统一收归左侧活动栏，不从顶部切换」的清晰设计原则。

---

## 质量验证与验收结果

1. **类型安全性检查**：

   ```bash
   pnpm typecheck
   # Output:
   # > ygo-duel-editor@1.0.0 typecheck:node
   # > tsc --noEmit -p tsconfig.node.json --composite false
   # > ygo-duel-editor@1.0.0 typecheck:web
   # > tsc --noEmit -p tsconfig.web.json --composite false
   # 结果：双端零错误通过！
   ```

2. **代码规范与格式化**：

   ```bash
   pnpm lint
   # 结果：源码目录零错误通过！
   ```

3. **交互体验实测**：
   - 点击最左侧活动栏上的 `卡片详情` / `背后灵` 图标，面板丝滑切换；
   - 再次点击当前激活的图标，左侧面板自然折叠，中央场地获得全屏级横向空间；
   - 拖拽面板右边缘，可在 280px ~ 600px 间平滑调节宽度；
   - 右侧检索栏、中央战场与左侧背后灵三者完全并行互不干扰；
   - 背后灵生成的战术提案点击一键应用，步骤立即同步到中央战场与右侧编排栏。
