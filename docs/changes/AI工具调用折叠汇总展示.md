# AI 工具调用折叠汇总展示

本改动是一次原子化提交，围绕一个问题展开：**AI 执行期间会连续调用工具，聊天区把每一次调用都单独摊开，重复检索时几十行过程信息挤占了回答空间，用户既难阅读，也不容易抓住当前进度。**

实现前先直接检查了仓库根目录中的 ZCode、DeepSeek Harness 和 OpenCode 源码。三者都在处理「过程信息很多，但用户仍需随时查看状态和细节」的问题，只是分组层级不同：OpenCode 会将连续的上下文工具调用折叠成组，Harness 会把一段执行过程收进带实时状态的过程组，ZCode 则为单次调用提供摘要行、状态和可展开详情。

本项目的工具调用已经按 ID 保存在 assistant 消息中，因此没有必要改主进程事件协议或 store 数据结构。最终采用「默认聚合、需要时展开」：同一条 assistant 消息的多次工具调用先显示为一条汇总，摘要给出调用总数、工具类别计数和执行中数量；展开后仍按原顺序查看每次调用。单次调用则继续直接显示，不额外套一层折叠。

---

## 第一步：把工具调用信息整理成紧凑摘要 —— **src/renderer/src/components/BehindSpirit/ToolCallList.tsx**

改动缘由：原来的聊天面板直接遍历 `toolCalls`，一次调用生成一行，没有总数、类别汇总或列表级折叠。AI 为了分析多张卡而连续检索时，所有行都会一直占据对话气泡。为避免把汇总、状态判断、工具名称和详情格式继续堆进聊天面板，先将这块展示职责拆成独立组件。

组件为项目内五种工具提供中文名称；多次调用时按工具名统计数量，并把还没有结果摘要的调用计为执行中。摘要行默认折叠，展开后以有限高度的滚动列表显示逐次结果和关键参数；这样收起时不丢失进度，展开时仍能追溯具体查询。只有一次调用时保留原有的直接展示体验。

下面列出这一步新增的关键逻辑片段，重点呈现工具名称、状态统计、汇总与展开方式；与行为无关的视觉样式细节不逐项展开。

```diff
+const TOOL_LABELS: Record<string, string> = {
+  get_current_board: '读取当前盘面',
+  search_cards: '搜索卡片',
+  get_card_info: '查询卡片详情',
+  propose_duel_steps: '整理决斗步骤',
+  validate_with_ocgcore: '校验战术规则'
+}
+
+const runningCount = isGenerating ? calls.filter((call) => !call.resultSummary).length : 0
+
+if (calls.length === 1) {
+  return <ToolCallRow tool={calls[0]} isRunning={runningCount > 0} />
+}
+
+const counts = new Map<string, number>()
+for (const call of calls) {
+  counts.set(call.toolName, (counts.get(call.toolName) ?? 0) + 1)
+}
+const summary = Array.from(
+  counts,
+  ([toolName, count]) => `${getToolLabel(toolName)} ×${count}`
+).join(' · ')
+
+<button
+  type="button"
+  aria-expanded={expanded}
+  onClick={() => setExpanded((current) => !current)}
+>
+  <span>工具调用</span>
+  <span>{calls.length}</span>
+  <span>{summary}</span>
+  {runningCount > 0 && <span>{runningCount} 执行中</span>}
+</button>
+
+{expanded && (
+  <div className="mt-1 max-h-44 space-y-1 overflow-y-auto pl-2">
+    {calls.map((tool) => (
+      <ToolCallRow
+        key={tool.id}
+        tool={tool}
+        isRunning={isGenerating && !tool.resultSummary}
+      />
+    ))}
+  </div>
+)}
```

## 第二步：让聊天面板使用独立的调用列表 —— **src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx**

改动缘由：摘要组件建好后，面板只负责把当前 assistant 消息中的工具调用交给它，并提供生成状态。原先逐项铺开每个工具的 JSX 被替换掉；`messages` 中的调用数据及其顺序不变，工具事件处理和 IPC 也不需要改动。这样交互展示与消息状态管理各自留在合适的职责层。

```diff
+import { ToolCallList } from './ToolCallList'
```



```diff
-                  {msg.toolCalls && msg.toolCalls.length > 0 && (
-                    <div className="mb-2 space-y-1">
-                      {msg.toolCalls.map((t) => (
-                        <div
-                          key={t.id}
-                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-200/50 dark:bg-neutral-800/60 font-mono text-[10px] text-neutral-600 dark:text-neutral-300"
-                        >
-                          <Sliders className="w-3 h-3 text-muted-foreground shrink-0" />
-                          <span className="font-bold">{t.toolName}</span>
-                          {t.resultSummary && (
-                            <span className="text-muted-foreground truncate">
-                              ➔ {t.resultSummary}
-                            </span>
-                          )}
-                        </div>
-                      ))}
-                    </div>
-                  )}
+                  {msg.toolCalls && msg.toolCalls.length > 0 && (
+                    <ToolCallList calls={msg.toolCalls} isGenerating={isGenerating} />
+                  )}
```

## 参考项目的实现方式与本项目取舍

- **OpenCode：**&#x5728; **opencode/packages/session-ui/src/components/message-part.tsx** 的 `groupParts` 中，将连续出现的 `read`、`glob`、`grep`、`list` 等上下文工具归成可折叠组；遇到其他消息或工具时结束当前组，展开后保留每个调用的引用和原有顺序。它按工具类别决定哪些调用可聚合。本项目借鉴「把重复过程收起、细节仍可追溯」的原则，但改为针对一条 assistant 消息统一生成总览，并在详情中保留全部调用顺序。
- **DeepSeek Harness：**&#x5728; **deepseek-harness/packages/client/ui-chat/src/client/chat/ChatGroupSeat.tsx** 中，执行过程由一个可展开的过程标题概括，标题随运行状态显示当前活动；过程成员放在组内，而不是始终全部铺开。本项目借鉴「汇总行表达过程状态，展开后再查看成员」的层级。
- **ZCode：**&#x5728; **ZCode/packages/ui/src/ToolCallBlocks/ToolLayout.tsx** 中，单次工具调用有独立摘要、运行状态和折叠详情，并处理执行结束后的收起行为。本项目保留其单次调用状态与详情分层的思路；但当单条 assistant 消息包含大量调用时，再额外采用列表级汇总，以免一调用一行继续撑长聊天记录。

以上是对各项目展示思路的借鉴，不是复制它们的实现代码。特别是本项目没有照搬 OpenCode 只合并特定工具的规则，也没有引入 Harness 的整套过程数据模型或 ZCode 的持久化展开状态；只在现有消息数据结构上完成轻量的汇总与折叠。

## 验证结果

- 渲染端 TypeScript 检查通过。
- `BehindSpiritPanel.tsx` 与 `ToolCallList.tsx` 定向 ESLint 检查通过。
- `git diff --check` 通过。
- 主进程 `agentService.ts` 的其他未提交改动未纳入本次改动。
