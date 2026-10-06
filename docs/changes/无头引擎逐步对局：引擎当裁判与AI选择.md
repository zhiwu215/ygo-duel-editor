# 无头引擎逐步对局：引擎当裁判，AI 只做选择

> 需求：决斗盘装好双方卡组、场面空白时，创作者对背后灵说「安排一场决斗」，AI 能自动生成**每一个符合官方规则**的步骤，并在决斗场上逐帧演示。
>
> 实现选择「路线二」：官方 ocgcore 规则引擎当裁判（枚举合法操作、结算结果），背后灵 LLM 只在引擎给的操作列表里挑一个并写台词。整个改动是一个原子化提交。参考仓库出处：**pi**（工具三分离与 agentic loop）、**ZCode**（业务失败用返回值表达）、**deepseek-harness**（防呆/超时保护预算）。

---

## 第一步：读引擎协议，确定「LLM 选择 → 引擎应答」的翻译层

**缘由**：规则合法性必须来自引擎而不是 LLM 的自我约束。查证 `node_modules/ocgcore-wasm` 的类型声明（**node_modules/ocgcore-wasm/dist/index.d.ts**）后确认可行：引擎每步 `duelProcess()` 驱动一次，返回 `END / WAITING / CONTINUE`；`WAITING` 时 `duelGetMessage()` 里的 `SELECT_*` 消息**直接枚举当前全部合法操作**（`SELECT_IDLECMD` 列出可通常召唤/特招/盖放/发动的卡与进入 BP/EP 的开关，`SELECT_BATTLECMD` 列出可攻击/可发动/进 M2/EP），应答 `OcgResponse` 是**结构化对象**（如 `{ type: SELECT_IDLECMD, action: SELECT_SUMMON, index: i }`），不需要手工编码字节流。`duelQueryLocation` 按序列出某区域所有卡（空格为 null），`duelGetMessage` 还会流出发动/伤害/LP变动/移动等结算事件。

**结论**：桥内为每个可选项**预构造好引擎应答**，LLM 只传编号。

**src/main/services/duelEngineService.ts**（核心桥的整体结构，摘录）：

```diff
+export class DuelEngineService {
+  private session: EngineSession | null = null
+
+  public async start(state: DuelPuzzleState): Promise<EngineRoundResult> {
+    this.session = null
+    const created = await ocgcoreService.createDuelFromState(state)
+    if (!created.handle) {
+      throw new Error('ocgcore 引擎建局失败（请确认规则引擎已安装、卡牌数据可读）')
+    }
+    this.session = {
+      handle: created.handle,
+      core: created.core,
+      ...
+      lp: [state.players[0]?.lp || 8000, state.players[1]?.lp || 8000],
+      ...
+    }
+    const round = await this.ensureWaiting()
+    return {
+      narration: [...round.narrations, `对局开始，${this.describeTurn()}`],
+      options: round.options.map((o) => ({ id: o.id, label: o.label })),
+      finished: null
+    }
+  }
```

## 第二步：事件循环与消息流翻译

**缘由**：一次选择后的结算可能连续多帧（召唤 → 效果 → 连锁 → 伤害），要持续 `duelProcess()` 直到引擎停下等选择（`WAITING`）或终局（`END`），并把期间的消息流翻译成给 LLM 与台本可读的叙述；回合/阶段/LP 需要从 `NEW_TURN / NEW_PHASE / LPUPDATE / DAMAGE / RECOVER` 增量维护。

**src/main/services/duelEngineService.ts**（`ensureWaiting` 循环 + `consumeMessages` 翻译，摘录）：

```diff
+  private async ensureWaiting(): Promise<ProcessRound> {
+    const session = this.requireSession()
+    const narrations: string[] = []
+    let result = await session.core.duelProcess(session.handle)
+    let guard = 0
+    while (result === OcgProcessResult.CONTINUE && guard < MAX_PROCESS_LOOP) {
+      narrations.push(...this.consumeMessages())
+      result = await session.core.duelProcess(session.handle)
+      guard++
+    }
+    if (result === OcgProcessResult.WAITING) {
+      const options = this.buildCurrentOptions()
+      session.lastOptions = options
+      return { narrations, options, waiting: true }
+    }
+    ...
+  }
```

```diff
     } else if (kind === OcgMessageType.DAMAGE || kind === OcgMessageType.RECOVER) {
       const m = msg as unknown as { player: number; amount: number }
       const side = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
       const oldLp = session.lp[side]
       const delta = kind === OcgMessageType.DAMAGE ? -Math.abs(m.amount) : Math.abs(m.amount)
       const newLp = Math.max(0, oldLp + delta)
       session.lp[side] = newLp
       if (newLp !== oldLp) {
         out.push(`${this.sideName(side)}LP ${oldLp} → ${newLp}（${delta > 0 ? '+' : '-'}${Math.abs(delta)}）`)
       }
     }
```

## 第三步：选项枚举与子选择兜底

**缘由**：LLM 决策层只覆盖「顶层动作」（空闲/战斗/连锁/是否发动），而召唤会级联出**子选择**（选祭品、选格子、选表示形式、选效果目标）。子选择若让 LLM 逐步参与，调用次数翻倍且台词会与动作脱节；若完全静默又会随机乱选目标。折中：子选择**自动兜底**（最小合法项），叙述并入同一步的 `description`。

**参考**：ZCode 的 `ToolHandlerFailure`（**ZCode/apps/zcode-cli/packages/core/src/tool/types.ts**）——引擎回 `RETRY` 表示「LLM 上一次选择非法」，桥不抛异常而是把拒绝信息作为叙述返回，让 LLM 换一种选择。deepseek-harness 的 `guard` 家族（超时/重复调用保护）——`MAX_PROCESS_LOOP`/`MAX_CHILD_LOOP` 双重上限防死循环。

**src/main/services/duelEngineService.ts**（子选择兜底循环与部分兜底响应）:

```diff
+    session.core.duelSetResponse(session.handle, option.response)
+    let round = await this.ensureWaiting()
+    session.pending?.narrations.push(...round.narrations)
+    narration.push(...round.narrations)
+
+    let child = 0
+    while (round.waiting && !this.isTopWaiting() && child < MAX_CHILD_LOOP) {
+      const fallback = this.buildFallbackResponse()
+      if (!fallback) break
+      session.core.duelSetResponse(session.handle, fallback)
+      round = await this.ensureWaiting()
+      session.pending?.narrations.push(...round.narrations)
+      narration.push(...round.narrations)
+      child++
+    }
+
+    this.sealPendingStep()
```

```diff
+      if (kind === OcgMessageType.SELECT_POSITION) {
+        const mask = Number((msg as unknown as { positions: number }).positions)
+        const first = [CardPosition.FACEUP_ATTACK, CardPosition.FACEDOWN_DEFENSE, CardPosition.FACEUP_DEFENSE].find(
+          (p) => mask & p
+        )
+        ...
+      }
```

步骤封口（回到顶层选择点或终局时产出一条 `EngineDuelStep`，附带引擎快照与台词）：

```diff
+    session.steps.push({
+      turn: pending.turn,
+      phase: pending.phase,
+      turnPlayer: pending.turnPlayer,
+      actionPlayer: pending.actionPlayer,
+      actionType: pending.actionType,
+      cardCode: pending.cardCode,
+      cardName: pending.cardName,
+      speaker: this.duelistName(pending.actionPlayer),
+      dialogue: dialogue || undefined,
+      description: pending.narrations.length > 0 ? pending.narrations.join('；') : undefined,
+      lpChange,
+      boardAfter: this.snapshotBoard()
+    })
```

## 第四步：盘面快照与实例对齐

**缘由**：每个 `boardAfter` 必须能在渲染端还原（对齐 FieldCard instanceId 才有卡面/卡图），又必须来自引擎的真实局面。做法：开局时把渲染端传入的每张卡记进 `controller:code → instanceId[]` 池；每步结束时对七个区域做 `duelQueryLocation` 拉引擎真实状态，同 code 的卡从池里按顺序取回原 instanceId，池外的新卡（衍生物、新抽）造 `engine_N` 临时实例。卡名由主进程 `cdbService` 反查并缓存。

**src/main/services/duelEngineService.ts**（`snapshotBoard` 核心，摘录）：

```diff
+    const flags: OcgQueryFlags =
+      (OcgQueryFlags.CODE |
+        OcgQueryFlags.POSITION |
+        OcgQueryFlags.IS_PUBLIC |
+        OcgQueryFlags.OWNER) as OcgQueryFlags
+    for (const controller of [0, 1] as const) {
+      for (const [ocgLoc, cardLoc] of areas) {
+        const rows = session.core.duelQueryLocation(session.handle, {
+          flags,
+          controller,
+          location: ocgLoc
+        })
+        rows?.forEach((row, seq) => {
+          if (!row || row.code === undefined) return
+          const code = Number(row.code ?? 0)
+          const key = `${controller}:${code}`
+          const instanceId = pool.get(key)?.shift() ?? `engine_${session.engineCardCounter++}`
+          ...
+        })
+      }
+    }
```

## 第五步：AI 侧的三个工具与对局模式提示

**缘由**：背后灵需要三个动作——建局、每步选择、提交整场。`picks` 是引擎枚举的编号，`speech` 是该步台词（直接落 `dialogue`）；引擎拒绝非法选择时用 opencode 的修正文案思路（**opencode/packages/opencode/src/tool/tool.ts** 的 InvalidArgumentsError：「错误信息本身就是改写指引」）。

**src/main/services/agentService.ts**（三个工具注册进 acquireSession 工具数组）：

```diff
       const session = await this.acquireSession(cfg, [
         searchCardsTool,
         getCardInfoTool,
         getCurrentBoardTool,
         readNovelSourceTool,
         proposeStepsTool,
         proposeBoardSetupTool,
+        duelEngineStartTool,
+        duelEngineChooseTool,
+        duelEngineCommitTool,
         validateWithOcgcoreTool
       ])
```

`duel_engine_choose` 的参数与拒绝语义：

```diff
+      parameters: Type.Object({
+        picks: Type.Array(
+          Type.Number({ description: '要执行的操作编号（对应当前操作列表 id，可多个）' }),
+          { description: '本步选择的编号列表' }
+        ),
+        speech: Type.Optional(
+          Type.String({ description: '这一步的台词或解说（记入台本 dialogue），没有则省略' })
+        )
+      }),
```

**src/main/services/agentService.ts**（system prompt 新增对局模式段）：

```diff
+- 创作者要求「安排一场决斗 / 自动生成一场对局 / 让 AI 自动对打」且双方卡组已装填到卡组区时，走无头引擎逐步对局：
+  - 先 duel_engine_start 建局；引擎会自动完成起手抽卡等流程，你只负责在它列出的合法操作里选择。
+  - 每一步都用 duel_engine_choose：picks 从列表里选编号，speech 写这一步的台词或解说，说话者就是你。台词要有角色张力，每回合至少一句；关键召唤与战斗用招式宣言式口播。
+  - 引擎列表里没有的操作就是规则不允许的：绝不凭空描述引擎外的操作，也不把非法操作说成合法。
+  - 引擎提示「指令非法」就换一种合法选择；对局终了后调 duel_engine_commit 提交整场步骤（中途禁止提交），再在正文写完整战报。
```

## 第六步：渲染端接线——engine_steps_ready 到决斗场

**缘由**：整场步骤经既有 `agent:event` 通道推到渲染端（不需要新 IPC 四件套），汇总卡复用既有「折叠详情 + 覆盖确认」的交互；写入决斗场后，台本工作台的 `previewStepBoard` 逐帧回放的是**引擎逐步结算的真实场面**（不再是 storyReplay 的近似推演）。

**src/shared/types/ipc.ts**（事件与步骤类型）：

```diff
+  | {
+      type: 'engine_steps_ready'
+      steps: EngineDuelStep[]
+      winner: 0 | 1 | null
+      totalTurns: number
+    }
```

```diff
+import { DuelPhase, DuelActionType, EngineDuelStep } from './story'
```

**src/shared/types/story.ts**（步骤类型）：

```diff
+export type EngineDuelStep = Omit<DuelStep, 'id'>
```

**src/renderer/src/stores/useAgentStore.ts**（消息字段 + 事件分支 + 应用）：

```diff
 +  /** 该条消息里无头引擎逐步对局产生的整场步骤（引擎结算、每步带盘面快照；确认后写入决斗场） */
 +  engineSteps?: EngineDuelStep[]
 +  /** 引擎判定的胜者；null 表示未分胜负 */
 +  engineWinner?: 0 | 1 | null
```

```diff
 +        } else if (event.type === 'engine_steps_ready') {
 +          set({
 +            messages: messages.map((m) =>
 +              m.id === lastMsg.id
 +                ? {
 +                    ...m,
 +                    engineSteps: event.steps,
 +                    engineWinner: event.winner
 +                  }
 +                : m
 +            )
 +          })
 +        }
```

**src/renderer/src/stores/useDuelStore.ts**（整体写入动作——单次 set，盘面保持现状作为回放基准）：

```diff
+      applyEngineDuel: ({ steps }) =>
+        set((prev) => {
+          if (steps.length === 0) return prev
+          const resolved: DuelStep[] = steps.map((s, idx) => ({
+            ...s,
+            id: `step_${Date.now()}_${idx.toString(36)}_${Math.random().toString(36).substring(2, 7)}`
+          }))
+          const first = resolved[0]
+          return {
+            state: {
+              ...prev.state,
+              steps: resolved,
+              initialBoardSnapshot:
+                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
+            },
+            ...
+            currentStepIndex: null,
+            currentTurn: first.turn,
+            currentPhase: first.phase,
+            currentChain: 0,
+            activeTurnPlayer: first.turnPlayer
+          }
+        }),
```

**src/renderer/src/components/BehindSpirit/DuelProposalSummaryCard.tsx**（复用汇总卡，新增引擎模式：标题「引擎对局」+「官方规则引擎结算」徽章 + 胜者标示。

**src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx**（分支渲染与应用）：

```diff
+  const handleApplyEngineSteps = async (messageId: string): Promise<void> => {
+    ...
+    const existingSteps = useDuelStore.getState().state.steps ?? []
+    if (existingSteps.length > 0) {
+      const confirmed = window.confirm(
+        `当前决斗场已排有 ${existingSteps.length} 步。\n应用会替换整条步骤时间线（引擎对局 ${msg.engineSteps.length} 步）。继续吗？`
+      )
+      ...
+    }
+    const res = await applyEngineSteps(msg.engineSteps)
+    ...
+  }
```

## 增补：编剧抽卡——AI 编排牌堆顺序

**缘由**：抽卡的随机性会毁掉编排好的戏剧节奏——主角的关键 combo 卡迟迟不出现，或对方在中盘就摸到反转牌。引擎建局用的是 `PSEUDO_SHUFFLE` + 固定 seed（不自洗牌，牌堆顺序 = 注入顺序），这正好留了一个精确控制点：重排该方 DECK 区卡的 sequence，就等于决定了后续每一张抽到的牌。

**src/main/services/duelEngineService.ts**（校验 + 重排，摘录）：

```diff
+  public prepareArrangement(
+    state: DuelPuzzleState,
+    proposal: AgentDeckArrangeProposal
+  ): { state: DuelPuzzleState; narration: string } {
+    // 多重集校验：codes 的卡密分布必须与该方（或指定决斗者的）DECK 现有卡完全一致，
+    // 不一致时给出「缺少 X ×N / 多出 Y ×N」的明细让模型修正
+    ...
+    const remaining = [...scope]
+    const reassign = new Map<string, number>()
+    let seq = 0
+    for (const code of proposal.codes) {
+      const idx = remaining.findIndex((c) => c.code === code)
+      ...
+      reassign.set(card.instanceId, seq)
+      seq += 1
+    }
+    const newCards = state.cards.map((c) =>
+      reassign.has(c.instanceId) ? { ...c, sequence: reassign.get(c.instanceId)! } : c
+    )
+    return { state: { ...state, cards: newCards }, narration: ... }
+  }
```

`duel_engine_start` 时优先采用重排后的盘面建局，并在引擎任何 process 之前**先拍一份开局全景快照**（含重排后的牌序）挂进会话：

```diff
+      initialBoard: this.snapshotStatic(state.cards),
```

**src/main/services/agentService.ts**（`arrangedBoardState`：每条消息的重排结果缓存，`duel_engine_start`/`arrange` 复用；commit 事件携带 `initialCards`）：

```diff
 -        this.emitEvent({
 -          type: 'engine_steps_ready',
 -          steps,
 -          winner: finish?.winner ?? null,
 -          totalTurns
 -        })
 +        this.emitEvent({
 +          type: 'engine_steps_ready',
 +          steps,
 +          winner: finish?.winner ?? null,
 +          totalTurns,
 +          initialCards: duelEngineService.collectInitialBoard()
 +        })
```

**src/renderer/src/stores/useDuelStore.ts**（应用到决斗场时把引擎开局盘面整体还原，卡面按 instanceId 从原盘面继承——牌堆里 AI 排好的顺序直接可见；回放基线与其一致）：

```diff
 -              steps: resolved,
 -              initialBoardSnapshot:
 -                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
 +              steps: resolved,
 +              cards,
 +              initialBoardSnapshot: createLightweightSnapshot(cards)
```

**工具流程**：`duel_engine_arrange_deck`（每方至多一次，start 之前）→ `duel_engine_start` → `duel_engine_choose` × N → `duel_engine_commit`。system prompt 要求 AI「先想故事再动牌」：让关键 combo、中转卡、解场卡各自按起手铺垫 / 中期拉锯 / 终盘爆发落位。校验失败（卡密分布对不上）时工具返回差异明细，AI 自行修正后重交。

## 增补二：意图检索层——「万卡找卡」的第一层（FTS5，零新依赖）

**缘由**：创作者现有卡组打不出理想结局时，需要背后灵从 1 万多张卡里找「能补上缺口」的组件。把全库塞进模型上下文既不可能也不必要：正确架构是 AI 用工具**带着意图检索**，服务端只回 top-N 摘要。现有 `search_cards` 是 LIKE 子串匹配，对「按功能找卡」命中不稳，第一层升级为 FTS5 全文索引 + 领域同义词扩展（better-sqlite3 自带 FTS5，零新依赖）。

**cards.cdb 是只读库**（AGENTS.md 硬约束：绝不写入用户文件），索引建在独立内存库（**src/main/db/cdbService.ts** 的 `intentDb`），open 成功后全量重建、close 销毁：

```diff
+      this.db = db
+      this.currentPath = cdbPath
+      this.loadStringsConf(cdbPath)
+      this.rebuildIntentIndex()
```

**中文检索的关键设计：预分词**。FTS5 默认 unicode61 对连续 CJK 的分词行为不可靠，因此**入库时**把卡名/效果文本按 CJK 区段逐字加空格（**src/main/db/cdbService.ts** 的 `segmentForIndex`），查询时把短语同样处理并用引号包裹（`toFtsPhrase`），两字/四字短语都能精确命中：

```diff
+function segmentForIndex(text: string): string {
+  return (
+    text
+      .replace(/[

	]+/g, ' ')
+      .replace(/([぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯])/gu, ' $1 ')
+      .replace(/\s+/g, ' ')
+      .trim() + ' '
+  )
+}
```

**领域同义词扩展**（**src/main/services/intentLexicon.ts**）：AI 写的意图词（「烧血」「手坑」「找卡」）映射成效果文本里的规范化词组（「基本分/伤害」「手牌/效果发动」「检索/加入手牌」「卡组特殊召唤」…），命中任意扩展组即可召回。

**src/main/services/agentService.ts**（新工具 `find_cards_by_intent`，与 `search_cards` 并列注册）——FTS BM25 排序（**卡名列权重 12 倍**，名字最像意图的优先）+ 主类型过滤（`d.type & ?`），返回 top-12 摘要（卡名/卡密/种类/攻防 + 效果文前 160 字）， PROMPT 要求按功能找卡时优先此工具；**src/renderer/src/components/BehindSpirit/ToolCallList.tsx** 补了折叠汇总标签。

**实测冒烟**（合成样本 + 真实分词路径）：

- 意图「无效发动手牌卡」→ 灰流丽 排第一；
- 意图「检索卡组战士族」→ 仅命中 增援；
- 意图「破坏对方怪兽」→ 神圣防护罩 -反射镜力-。

**第二层预留**：若实测发现效果改写类语义仍查不到，升级 `sqlite-vec` 真 RAG（全卡 embedding 一次性构建，与 FTS 结果 RRF 混排）——需要引入新依赖与 embedding 供应商，动手前先与创作者确认。

## 增补三：精确结局的编剧式替卡——「让对方恰好剩 1000 被打掉」

**缘由**：创作者提出「让对方恰好剩 1000 LP、由我的怪兽造成这一击」这类精确结局时，手牌与未翻开的盖卡是**还没动用的资源**——场上已有的卡打不出这道数学题时，应该允许 AI 去全卡库找能精确达成该数值的卡，并把手牌/盖卡的对应格位换掉。

三块拼图：

1. **AI 能算账**：`get_current_board` 此前只输出卡名与区域，AI 也没有每张怪兽的打点，算不清账。升级后每张怪兽区卡带「表示形式 + 攻/守（兼容 customAtk/Def 与 ? 值）」，手牌 带「显示顺序 [n]」（对应的 HandTray 排序），SZONE 带格号（**src/main/services/agentService.ts**）：

```diff
-          lines.push(`- [${owner}] ${name} 位于 ${locName}`)
+          if (c.location === CardLocation.MZONE) {
+            const pos = POSITION_NAMES[c.position] ?? '未知表示'
+            const atk = c.customAtk ?? c.card?.atk ?? '?'
+            const def = c.customDef ?? c.card?.def ?? '?'
+            ...
+            lines.push(`- [${owner}] ${name} 位于 ${locName} · ${pos} · 攻${atkText} / 防${defText}`)
+          }
```

2. **找卡**：用已实现的 `find_cards_by_intent`（FTS5 + 领域同义词扩展）检索「造成恰好 1000 点伤害的卡 / 让怪兽攻击力加 X 的装备 / 把对方 LP 拉到 1000 的回复卡」等。

3. **换卡通道 `propose_card_replacement`**：现有布局提案是「叠加」语义（手牌会越 Andersen 越多），改格位必须**替换**语义。新增工具 → `card_swap_ready` 事件 → 渲染端确认卡 → `applyCardSwap` 单次 set 替换。

**src/main/services/agentService.ts**（新工具，已注册进工具数组与 system prompt 编排指引段）；提案 schema：

```diff
+export interface AgentCardSwapPlacement {
+  side: 0 | 1
+  /** 'HAND' 手牌（按显示顺序 index）或 'SZONE' 魔陷区（按格子序号） */
+  slot: 'HAND' | 'SZONE'
+  index: number
+  code: number
+  cardName?: string
+  replacedName?: string
+}
```

（放 **src/shared/types/ipc.ts**，事件为 `card_swap_ready { proposal }`，`done` 同步携带。）

**src/renderer/src/stores/useDuelStore.ts**（`applyCardSwap` 单次落盘，摘录）：

```diff
+      applyCardSwap: ({ placements, cardMap }) =>
+        set((prev) => {
+          const cards = [...prev.state.cards]
+          for (const placement of placements) {
+            const zone = placement.slot === 'HAND' ? CardLocation.HAND : CardLocation.SZONE
+            let target: FieldCard | undefined
+            if (placement.slot === 'HAND') { target = [...].sort(sequence)[index] }
+            else { target = [...].find((c) => c.sequence === placement.index) }
+            ...
+            cards[idx] = { instanceId: ..., code: face.id, card: face, ... duelistId 保留 ... }
+          }
+          return { state: { ...prev.state, cards }, ... }
+        }),
```

**渲染端**：`useAgentStore.applyCardSwap` 先经 `getCardsByIds` 解析完整卡面，再交 store 落盘；**src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx** 中的替换提案汇总卡（答复摘要 + 「原卡 → 新卡」清单 + 应用确认按钮）；工具折叠标签经 **src/renderer/src/components/BehindSpirit/ToolCallList.tsx**。

**system prompt 编排指引**：要求 AI 先读盘面数字手写算账式核对「恰好」这道数学题，然后 find_cards_by_intent 找卡 → 拿确切卡密 → propose_card_replacement；说明被替换格位的合法性边界（只动未使用的手牌与未翻开的盖卡，翻开的卡需要征得同意）。

## 增补五：为什么 CLI 里没事、这里很快截断——输出/结果/行为三层对齐

**用户实测疑问**：用 pi / opencode / zcode / dsh 很少遇到输出上限问题，本项目为何频繁触发。三层差异（均已修复）：

1. **工具结果预算层**（CLI 皆有、本项目曾缺）：pi 源码 `truncate.ts` 写死 `DEFAULT_MAX_LINES = 2000 / DEFAULT_MAX_BYTES = 50KB`，opencode 同值，ZCode 是 100KB 预算契约。本项目 `get_card_info` 曾返回**完整效果文无截断**，一批 22 张即 1 万多字灌进上下文。已补：单次最多 12 张（超限提示分批）、效果文 400 字截断（**src/main/services/agentService.ts**）；`get_current_board` 曾把 DECK 40 张逐行列出（每轮 45+ 行常驻历史），现压缩为一行汇总（顶部 5 张 + 总数）；`duel_engine_arrange_deck` 校验失败时**自带完整牌堆清单**（**src/main/services/duelEngineService.ts** 的 `describeDeck`），编排牌序不再需要先读全盘面。

2. **auto-retry 层**：pi 的 retry 默认开启（源码注释 `default: true, maxRetries: 3`），CLI 里截断/瞬时错误自动续传用户无感；本项目曾主动关闭，增补四已改为受控开启。

3. **输出上限与行为约束**：CLI agent 一次回复很轻（短句+小工具调用），而编排任务在一条回复里装思考链+正文+大工具参数，厂商默认 max_tokens=4096 几乎必然截断。两层修复：`maxTokens` 在用户未显式设置时默认写 8192（**src/main/services/agentService.ts**；DeepSeek-chat 硬上限 8192，Claude/GPT/Qwen 系均不低于）；system prompt 明确「不要在思考里推演整场对局、不要一次性 propose 全场步骤、思考链保持简短、整场对局靠多轮 duel_engine_choose 逐步完成」——实测事故正是模型在思考链里推演整场把预算烧光（截断点在分析阶段，工具都还没调）。

4. **终端乱码**：Windows 控制台默认 GBK 代码页解码 UTF-8 → 中文乱码；agentLogger 模块加载时 `chcp 65001`（切继承的控制台缓冲区），值内换行压成 `⇐` 保证一行一事件。

## 增补四：可靠性加固——护栏要「可观测、可恢复」

**事故还原**：一场引擎对局中途，模型回复超长被截断（`stopReason: 'length'`），界面提示「未输出任何内容」——但工具调用其实已成功 21 步，且整场已结算步骤还留在引擎会话里；同时主进程终端零输出。两个问题：**护栏不可观测**（错误只走 IPC 不落日志），**不可恢复**（文案谎报产出丢失）。

对照参考仓库的四个设计落地：

1. **主进程日志层**（**src/main/services/agentLogger.ts**，新文件）：分级 INFO/WARN/ERROR，双通道（electron-vite dev 的 stdout 直接可见 + `userData/logs/agent.log` 落盘、超 2MB 轮换）。对应 deepseek-harness 的 guard 家族原则：超时/重试/截断这些**护栏动作必须留痕**；agentService 的关键节点全部埋点：工具调用（call/done）、截断、看门狗、会话错误、done（含耗时/工具次数/各提案计数）。

2. **截断文案停止说谎 + 恢复出口**（**src/main/services/agentService.ts**）：截断提示如实报告「实际已产出：正文 N 字、工具调用 M 次、提案 X 个」；引擎对局进行中时额外说明「已结算的整场步骤仍在引擎会话里，新开一条消息说『提交对局』即可回收（`duel_engine_commit` 描述已放宽为截断后可调用），不会从零重跑」——引擎会话本来就跨消息存活于主进程。

3. **受控自动重试**（**src/main/services/agentService.ts** 的 SettingsManager 配置）：pi 内建 auto-retry 之前被禁用（理由是「静默重试让报错看不见」），现改为受控开启——最多 2 次、1s 起步指数退避、上限 8s；每次重试经既有 `auto_retry_start` 事件转发为渲染层可见的「第 X/Y 次重试」状态，不再静默。

4. **判定完整性**：空内容/无结论判定补上 `cardSwap` 维度（此前只看布局/步骤提案）。

## 增补六：第二轮实测修复——开局失败要「报得出原因」、堆叠区全面压缩

**实测新问题**：`duel_engine_start` 界面显示「引擎开局失败」，但终端没有任何原因（engine 工具的失败路径此前没有埋点）；且模型把失败自行理解成「引擎不可用，转手动推演」，在思考链里手算整场 LP 账目再次截断。三个修复：

1. **engine start 细粒度日志**（**src/main/services/agentService.ts**）：`engine start begin/done/failed`（失败带错误信息与堆栈前 4 行）；界面 resultSummary 同时带上失败原因前 80 字，不再只有一句「失败」。
2. **堆叠区全面压缩**：`get_current_board` 把 DECK / 额外卡组 / 墓地 / 除外**全部**改为「一行汇总（张数 + 前 4 张）」——117 张卡的局面此前逐行输出仍是巨大上下文（每轮常驻）；手牌保留逐行（格位替换提案需要显示序号）。压缩后完整局面约 20 行。
3. **行为约束**（system prompt）：引擎开局失败或反复拒绝时**停下来如实报告、等创作者处理**；明确禁止「把失败当成引擎不可用而转手动推演/手算整场」——那条路必然截断。

## 增补七：第三轮实测——日志要「敢输出」，牌序编排要「给得起清单」

### 先说清楚这一轮的真实矛盾

**矛盾：上下文预算和模型可见性此消彼长，两边都已经撞过墙。**

- **一边是上下文**。引擎对局里模型每一轮都要重读盘面，`get_current_board` 的输出不是一次性消耗品，而是**常驻在对话历史里**、每轮重新付费。牌堆 40 行逐行列出，多轮下来就是上千行常驻——这正是增补五、增补六下决心把堆叠区压成「一行汇总」的原因，此前正因为逐行输出把预算烧光、模型在分析阶段就被截断（工具都还没调）。
- **另一边是可见性**。牌序编排（`duel_engine_arrange_deck`）提交的是**卡密**，模型却只能从盘面读到**卡名**。压缩成「顶部 5 张」之后，模型连这 5 张的卡密都拿不到，只能凭卡名猜卡密提交——实测日志里连续两次 `牌序编排被拒绝`，之后模型放弃编排转去查卡。压缩上下文的代价，是制造了一个必失败的工具。

**于是出现一个死结**：要拿到完整清单，得先猜对卡密；猜不对就永远拿不到清单。增补五省下来的上下文，被增补五自己制造的重试吃回去。

**需求**：把「每轮都要付的成本」和「只有特定任务才需要的成本」拆开——前者压到 1 行，后者按需付费、只付一次。同时保证这条链路本身**可观测**，否则这种矛盾根本不会被发现（本轮四个问题里，有两个是先从 `agent.log` 里看见才定位到的）。

**解决思路**（对应下面五步）：

1. **分级按需取数**：`get_current_board` 只留 1 行概览且补回卡密 → `get_deck_list` 整副清单（可 `limit`）→ `duel_engine_arrange_deck` 重排。清单不再塞进每轮常驻的历史，只在模型真的要看/要改时出现。
2. **让「取清单」本身成为合法用途**：`arrange_deck` 不带 codes 即返回清单，失败路径也附清单——把「先猜对卡密才能拿清单」的死结拆掉。
3. **拒绝要分诊**：拒绝带错误码、按码给不同下一步，避免模型拿同一份清单原地重试（重试就是再付一次上下文）。
4. **日志要敢输出**：终端默认转义、落盘保留中文原文，保证「模型到底拿到了什么」始终查得到。

补一句自省：增补五、增补六的压缩方向没错，错的是压缩时**没有同时留出按需取全量的出口**。这一轮补的就是这个出口，而不是把压缩回退。

### 第一步：终端乱码不是 chcp 能救的，改成默认转义

**缘由**：增补五第 4 点把乱码归因于「Windows 控制台 GBK 代码页」，解法是模块加载时 `chcp 65001`；实测仍乱码。真正的链路是：Electron 是 GUI 子系统进程，主进程 stdout 通过 pipe 交给启动它的终端，终端按自己的代码页解码（cmd / PowerShell 默认 936），而 `chcp` 改的是子进程继承的控制台、改不到父终端——GUI 进程本身甚至没有控制台。只要往 stdout 写 UTF-8 中文，父终端必乱码。同源的第二个隐患：换行折叠符用的是 `⇐`，这个字符不在 GBK 里，一样会碎。

**src/main/services/agentLogger.ts**（编码策略重写）：

```diff
-try {
-  if (process.platform === 'win32') {
-    execSync('chcp 65001', { stdio: 'ignore' })
-  }
-} catch {}
+const rawUnicode = process.env.AGENT_LOG_UNICODE === '1'
+
+if (rawUnicode && process.platform === 'win32') {
+  try {
+    execSync('chcp 65001', { stdio: 'ignore' })
+  } catch {
+    // 切换失败只影响显示，不影响功能
+  }
+}
```

```diff
-function asciiEscape(text: string): string {
-  return text.replace(/[\u0080-\uffff]/gu, (ch) => {
-    const hex = ch.codePointAt(0)!.toString(16).padStart(4, '0')
-    return `\\u${hex}`
-  })
-}
+function asciiEscape(text: string): string {
+  let out = ''
+  for (const ch of text) {
+    const cp = ch.codePointAt(0) ?? 0
+    out += cp > ASCII_MAX ? '\\u' + cp.toString(16).padStart(4, '0') : ch
+  }
+  return out
+}
```

改正则为逐字符遍历，是因为源码里写 `\u0080-\uffff` 会把两个裸控制字符真正嵌进文件，容易被后续工具或编辑器破坏。

```diff
-  return value.replace(/[\r\n]+/g, ' ⇐ ')
+  return value.replace(/[\r\n]+/g, ' | ')
```

```diff
+  private bannerWritten = false
+
+  private takeBanner(): string {
+    if (this.bannerWritten) return ''
+    this.bannerWritten = true
+    const where = 'userData/logs/agent.log'
+    return rawUnicode
+      ? `[agent] log: raw unicode mode (AGENT_LOG_UNICODE=1); copy also in ${where}\n`
+      : `[agent] log: non-ASCII is escaped as \\uXXXX so GBK terminals stay readable; set AGENT_LOG_UNICODE=1 for raw Chinese; full text in ${where}\n`
+  }
+
   private write(line: string): void {
     const stamp = new Date().toISOString()
     const full = `${flattenValue(line)}\n`
+    const banner = this.takeBanner()
     try {
-      process.stdout.write(`[agent ${stamp}] ${asciiEscape(full)}`)
+      process.stdout.write(`${banner}[agent ${stamp}] ${rawUnicode ? full : asciiEscape(full)}`)
     } catch {
       // 窗口模式下 stdout 可能不可用，只走落盘
     }
```

双通道分工就此明确：**stdout 默认只写 ASCII**（中文成 `\uXXXX`，任何代码页都不乱码、信息也不丢），**落盘始终中文原文**（`%APPDATA%\ygo-duel-editor\logs\agent.log`）；终端本身支持 UTF-8 时设 `AGENT_LOG_UNICODE=1` 就能原样看中文。首行 banner 说明当前处于哪种模式，避免「转义看不懂」变成新的困惑。

### 第二步：牌序编排连拒——模型其实拿不到卡密

**缘由**：实测日志里 `duel_engine_arrange_deck` 连续两次 `牌序编排被拒绝`，之后模型放弃去查卡。增补五、增补六先后把卡组压成「一行汇总（张数 + 顶部 5 张）」，顺手把卡密压掉了——模型看得见卡名、看不见卡密，而工具的 `codes` 只收卡密，于是只能盲猜，必撞 `unknown_card`。压缩上下文反而造出了新的失败点：想拿完整清单，得先猜对卡密。

**src/main/services/agentService.ts**（`get_current_board` 的卡组汇总行补回卡密，并指明更靠后的牌去哪取）：

```diff
-            const topNames = sideDeck
-              .slice(0, 5)
-              .map((c) => c.card?.name || `卡密${c.code}`)
-              .join('、')
-            lines.push(
-              `- [${side === 0 ? '我方' : '对方'}] 主卡组共 ${sideDeck.length} 张（顶部依次: ${topNames}）`
-            )
+            const topNames = sideDeck
+              .slice(0, 5)
+              .map((c) => `${c.card?.name || `卡密${c.code}`}(${c.code})`)
+              .join('、')
+            lines.push(
+              `- [${side === 0 ? '我方' : '对方'}] 主卡组共 ${sideDeck.length} 张（顶部依次: ${topNames}；要编排更靠后的牌序就调用 duel_engine_arrange_deck 拿完整清单）`
+            )
```

**src/main/services/agentService.ts**（`codes` 改为可选：省略或空数组 = 只取清单，不判失败、不改盘面）：

```diff
-        codes: Type.Array(Type.Number(), {
-          description:
-            '想控制的前 K 张卡密顺序（第 0 位 = 引擎下一张抽到的牌；列关键卡即可，其余自动按原顺序跟上；每张必须是牌堆里现有的卡）'
-        }),
+        codes: Type.Optional(
+          Type.Array(Type.Number(), {
+            description:
+              '想控制的前 K 张卡密顺序（第 0 位 = 引擎下一张抽到的牌；列关键卡即可，其余自动按原顺序跟上；每张必须是牌堆里现有的卡）。省略或空数组 = 只取牌堆清单，不改盘面'
+          })
+        ),
```

```diff
         const details: { arranged: boolean; message?: string } = { arranged: false }
+        if (codes.length === 0) {
+          const deckList = duelEngineService.describeDeck(baseState, side, duelistName)
+          this.emitEvent({
+            type: 'tool_call_end',
+            id: _toolCallId,
+            toolName: 'duel_engine_arrange_deck',
+            resultSummary: '已返回牌堆清单，等待 codes'
+          })
+          return {
+            content: [
+              {
+                type: 'text',
+                text: `下面是牌堆清单（第 0 行 = 引擎下一张抽到的牌）。挑出想控制的前几张，按目标顺序把卡密填进 codes 再调用一次本工具：\n${deckList}`
+              }
+            ],
+            details
+          }
+        }

         try {
```

工具描述同步改成两步用法（先空调用取清单 → 再带 codes 提交），这个死锁被拆掉。

### 第三步：拒绝要分诊，而不是一律甩同一份清单

**缘由**：此前所有拒绝都只回一句 `牌序编排被拒绝`，原因既不进日志也不进界面——无法判断是牌堆空了、多人局没指定决斗者、还是卡密不对；而对前两种情况，回一份「完整牌堆清单」毫无帮助，模型只会原样重试。

**src/main/services/duelEngineService.ts**（错误带码）：

```diff
+export type DeckArrangeErrorCode =
+  'deck_empty' | 'duelist_missing' | 'duelist_ambiguous' | 'too_many' | 'unknown_card'
+
+export class DeckArrangeError extends Error {
+  public readonly code: DeckArrangeErrorCode
+  public readonly offenders: string[]
+
+  constructor(code: DeckArrangeErrorCode, message: string, offenders: string[] = []) {
+    super(message)
+    this.name = 'DeckArrangeError'
+    this.code = code
+    this.offenders = offenders
+  }
+}
```

`prepareArrangement` 里五处 `throw new Error` 全部换成带码的 `DeckArrangeError`，例如：

```diff
-      throw new Error(`${sideName}的卡组区是空的（请先在决斗档案里装填卡组）`)
+      throw new DeckArrangeError(
+        'deck_empty',
+        `${sideName}的卡组区是空的（请先在决斗档案里装填卡组）`
+      )
```
```diff
-      throw new Error(`阵营「${sideName}」有多名决斗者，重排卡组必须指定 duelistName`)
+      throw new DeckArrangeError(
+        'duelist_ambiguous',
+        `阵营「${sideName}」有多名决斗者，重排卡组必须指定 duelistName`,
+        teamDuelists.map((d) => d.name)
+      )
```

（其余 `duelist_missing` / `too_many` / `unknown_card` 同式改写，`unknown_card` 额外带上越界的卡密清单。）

**src/main/services/agentService.ts**（按码分诊 + 拒绝原因入日志）：

```diff
+  private arrangeRejectHint(
+    code: DeckArrangeErrorCode | 'internal',
+    state: DuelPuzzleState,
+    side: 0 | 1
+  ): string {
+    if (code === 'deck_empty') {
+      return '牌堆是空的，编排无从下手：不要再重试本工具，直接调用 duel_engine_start 开局，或提示创作者先在决斗档案里给这一方装填卡组。'
+    }
+    if (code === 'duelist_ambiguous' || code === 'duelist_missing') {
+      const names = (state.duelists || []).filter((d) => d.team === side).map((d) => d.name)
+      return `这一方当前可用的 duelistName：${
+        names.length > 0 ? names.join('、') : '（名单为空，请先 get_current_board 读取决斗者名单）'
+      }。带上正确的名字重试。`
+    }
+    if (code === 'too_many') {
+      return `牌堆真实张数见下方清单，codes 最多只能列这么多张：\n${duelEngineService.describeDeck(state, side)}`
+    }
+    return `下面是当前牌堆的完整清单，请按完全一致的卡密分布重列 codes（只能改顺序，不能加牌）：\n${duelEngineService.describeDeck(state, side)}`
+  }
```

```diff
         } catch (err: unknown) {
           const detail = err instanceof Error ? err.message : String(err)
+          const code: DeckArrangeErrorCode | 'internal' =
+            err instanceof DeckArrangeError ? err.code : 'internal'
           details.message = detail
+          agentLogger.warn('tool', 'arrange rejected', {
+            name: 'duel_engine_arrange_deck',
+            side,
+            count: codes.length,
+            code,
+            reason: detail
+          })
           this.emitEvent({
             type: 'tool_call_end',
             id: _toolCallId,
             toolName: 'duel_engine_arrange_deck',
-            resultSummary: '牌序编排被拒绝'
+            resultSummary: `牌序编排被拒绝（${code}）：${detail.slice(0, 40)}`
           })
           return {
             content: [
               {
                 type: 'text',
-                text: `牌序编排未通过：${detail}\n下面是当前牌堆的完整清单，请按完全一致的卡密分布重列 codes（可以只改顺序）：\n${deckList}`
+                text: `牌序编排未通过（${code}）：${detail}\n${this.arrangeRejectHint(code, baseState, side)}`
               }
             ],
             details
           }
         }
```

现在再被拒，日志直接给出 `code=unknown_card reason=...`，界面摘要也带原因前 40 字。

### 第四步：`createCore is not a function`——打包后的 ESM 互操作

**缘由**：日志里 `engine ERROR start failed | error=createCore is not a function`，可同一模块的具名导出（`OcgLocation` 等）却用得好好的。查打包产物 `out/main/index.js` 第 9 行是 `const createCore = require("ocgcore-wasm")`——主进程被打包成 CJS，而 `ocgcore-wasm` 是纯 ESM（`package.json` 标 `"type": "module"`，产物末尾 `export { ... Ce as default }`），require 拿到的是 ESM 命名空间，默认导出落在 `.default` 上，所以它自己不可调用、具名属性却都在。

**src/main/services/ocgcoreService.ts**：

```diff
+type CoreFactory = (options: { sync: boolean }) => Promise<OcgCoreSync>
+
+function resolveCoreFactory(): CoreFactory {
+  const mod: unknown = createCore
+  if (typeof mod === 'function') return mod as CoreFactory
+  const nested = (mod as { default?: unknown } | null)?.default
+  if (typeof nested === 'function') return nested as CoreFactory
+  throw new Error('ocgcore-wasm 未导出可用的 createCore（打包互操作异常）')
+}
```
```diff
-      this.core = await createCore({ sync: true })
+      this.core = await resolveCoreFactory()({ sync: true })
```

两种形态都认：dev 的 ESM 路径下 `createCore` 本身就是函数，打包成 CJS 后走 `.default`。真出问题时抛的是「未导出可用的 createCore（打包互操作异常）」而不是 `is not a function`，一眼看得出是互操作而不是引擎本身坏了。

### 第五步：把「查看」和「编排」解耦——新增 get_deck_list

**缘由**：第二步把完整清单挂在了编排工具上，语义上仍然别扭——模型若只是想评估某个 combo 打不打得出来、想推荐补什么卡，也得「假装在编排」才能看到卡组。`get_current_board` 的那一行概览又只有 5 张。查看和编排是两件事，应该各自有入口。

**src/main/services/duelEngineService.ts**（`describeDeck` 拆出 `deckList`，支持 `limit` 并回传张数）：

```diff
   public describeDeck(state: DuelPuzzleState, side: 0 | 1, duelistName?: string): string {
-    let scope = state.cards.filter((c) => c.controller === side && c.location === CardLocation.DECK)
+    return this.deckList(state, side, duelistName).text
+  }
+
+  public deckList(
+    state: DuelPuzzleState,
+    side: 0 | 1,
+    duelistName?: string,
+    limit?: number
+  ): { text: string; count: number } {
+    let scope = state.cards.filter((c) => c.controller === side && c.location === CardLocation.DECK)
     ...
     const ordered = [...scope].sort((a, b) => a.sequence - b.sequence)
-    if (ordered.length === 0) return '该方牌堆是空的（卡组尚未装填）'
+    if (ordered.length === 0) {
+      return { text: '该方牌堆是空的（卡组尚未装填）', count: 0 }
+    }
-    const lines = ordered.map(
+    const capped =
+      limit !== undefined && limit > 0 && limit < ordered.length ? ordered.slice(0, limit) : ordered
+    const lines = capped.map(
       (c, i) => `${i}. ${c.card?.name || `卡密${c.code}`}（卡密: ${c.code}）`
     )
-    return `「${this.sideNameOf(state, side)}」牌堆共 ${ordered.length} 张（第 0 行最接近下一张抽到的牌）：\n${lines.join('\n')}`
+    const tail =
+      capped.length < ordered.length
+        ? `\n（只列了前 ${capped.length} 张，共 ${ordered.length} 张；传更大的 limit 可看完整清单）`
+        : ''
+    const text = `「${this.sideNameOf(state, side)}」牌堆共 ${ordered.length} 张（第 0 行最接近下一张抽到的牌）：\n${lines.join('\n')}${tail}`
+    return { text, count: ordered.length }
   }
```

**src/main/services/agentService.ts**（新工具，只看不改）：

```diff
+    const getDeckListTool = defineTool({
+      name: 'get_deck_list',
+      label: '查看牌堆清单',
+      description:
+        '读取某一方主卡组的完整清单（卡名 + 卡密），按抽牌顺序排列（第 0 行 = 引擎下一张抽到的牌）。只在确实需要看整副卡组时调用：评估某个 combo 打不打得出来、想推荐补什么卡、要挑出换掉哪张。只想知道张数和顶部几张时用 get_current_board 更省；想改抽牌顺序用 duel_engine_arrange_deck',
+      parameters: Type.Object({
+        side: Type.Number({ description: '查看哪一方：0 = 我方，1 = 对方' }),
+        duelistName: Type.Optional(
+          Type.String({ description: '多人对局时指定该阵营哪位决斗者的卡组；1v1 时省略' })
+        ),
+        limit: Type.Optional(
+          Type.Number({ description: '最多返回多少行，默认全部；只想看牌堆前半可传 20' })
+        )
+      }),
+      execute: async (_toolCallId, p: { side: number; duelistName?: string; limit?: number }) => {
+        const side = (p.side === 1 ? 1 : 0) as 0 | 1
+        const duelistName = p.duelistName?.trim() || undefined
+        this.emitEvent({
+          type: 'tool_call_start',
+          id: _toolCallId,
+          toolName: 'get_deck_list',
+          params: { side, duelist: duelistName }
+        })
+
+        const state = this.currentBoardState
+        if (!state) {
+          ... resultSummary: '盘面为空' ...
+        }
+
+        const { text, count } = duelEngineService.deckList(state, side, duelistName, p.limit)
+        this.emitEvent({
+          type: 'tool_call_end',
+          id: _toolCallId,
+          toolName: 'get_deck_list',
+          resultSummary: `已返回${side === 0 ? '我方' : '对方'}牌堆清单，共 ${count} 张`
+        })
+        return { content: [{ type: 'text', text }], details: { cardCount: count } }
+      }
+    })
```

注册进工具表（`getCurrentBoardTool` 之后）与 system prompt 的编排指引：

```diff
         getCurrentBoardTool,
+        getDeckListTool,
         readNovelSourceTool,
```
```diff
-codes 里的每张卡必须是牌堆里真实存在的（不能加牌换牌，只能调整现有卡的顺序）。
+codes 里的每张卡必须是牌堆里真实存在的（不能加牌换牌，只能调整现有卡的顺序），**不要凭卡名猜卡密**：不知道牌堆里有哪些卡时先用 get_deck_list 看完整清单（只看不改），或 duel_engine_arrange_deck 不带 codes 取清单。
```

三级入口就此分工明确：`get_current_board` 一行概览（每轮常驻）→ `get_deck_list` 整副清单（按需查看）→ `duel_engine_arrange_deck` 重排（按需改写）。

- 验收（本轮）：`pnpm typecheck:node` 零错误；`npx eslint` 对 `agentLogger.ts`、`duelEngineService.ts`、`ocgcoreService.ts`、`agentService.ts` 零错误零警告（`duelEngineService.ts` 两处 prettier 换行已 `--fix`）。
- 复验方式：重启 dev，终端首行应出现 banner；让背后灵编排牌序时，`agent.log` 里应能看到 `tool INFO done | name=duel_engine_arrange_deck summary=已返回牌堆清单，等待 codes`，或带 `code=` 的拒绝行。

- `pnpm typecheck`（node + web）零错误；`pnpm exec eslint <改动文件>` 零错误零警告。
- 使用流程：装好双方卡组 → 对背后灵说「安排一场决斗」→ 引擎开局后 AI 逐步 `duel_engine_choose`（每步带台词）→ 终局后 `duel_engine_commit` → 汇总卡显示「整场 N 步 · M 回合 · 引擎结算 · 胜者」→ 「应用到决斗场」→ 台本工作台逐帧回放。
- 与转写链路（storyReplay 本地近似重放）的分工：引擎对局的快照来自 ocgcore 真实结算；小说转写/API 不可用时退回近似。两条链路共用同一套台本与回放（`previewStepBoard`）出口。

## 增补八：第四轮实测——攻击这一步要「看得见打谁、打出了什么」

### 先说清楚这一轮的真实矛盾

**矛盾：结局算得准，过程看不见。**

实测场景：我方 LP 不足 1000，对方场上只剩一只星尘龙，我方用青眼究极龙攻击它，对方 LP 正好清零。问题是「AI 能够正常执行吗」。

翻完代码后的答案是**结果链路通、过程链路断**：

- **通的**：`MSG_DAMAGE` 会输出 `对方LP 2000 → 0（-2000）`，`MSG_WIN` 会输出 `对局终了：我方获胜（LP 归零）`。AI 打完知道自己赢了。
- **断的**：AI 在点下攻击**之前**不知道这一刀会落在谁身上；打完**之后**也不知道星尘龙有没有被战斗破坏。它唯一拿到的攻击旁白是「我方宣告【未知卡】攻击」——攻击方卡名都丢了，更别说目标。

**为什么这是硬伤而不是「够用就行」**：这个场景能成立的前提是「4500 打 2500，穿透 2000，对方 LP 正好 2000」。一旦那只星尘龙是**守备表示**（DEF 2000），4500 照样突破它，但**零伤害**，对方 LP 不动。而零伤害意味着引擎不发 `MSG_DAMAGE`，战斗破坏又没有任何旁白——AI 收到的反馈是「攻击了、什么都没发生」，接下来只会反复重试或推翻剧本。它分不清「打空了」和「引擎卡住了」，因为两条路的观察结果完全一样。

**需求**：把攻击这一步从「盲打」变成「可核对」——宣告前能确认目标是谁、是否是攻击表示、数值对不对；结算后能确认谁被战斗破坏了。

**解决思路**（对应下面三步）：

1. **修字段**：`MSG_ATTACK` 里根本没有卡密，按位置反查卡名，并把一直被丢掉的 `target` 写出来。
2. **补分支**：`MSG_BATTLE` 是「谁被战斗破坏」的唯一来源，此前从未进入旁白。
3. **补选项**：攻击选项只报攻击方名字，改成同时报出对方场上有什么、什么表示形式、什么数值，让模型在点之前就能算。

### 第一步：`MSG_ATTACK` 没有卡密字段，旁白一直在输出「未知卡」

**缘由**：`duelEngineService.ts` 里攻击旁白读的是 `msg.code`。但查 `node_modules/ocgcore-wasm/dist/index.d.ts` 可知 `OcgMessageAttack` 是 `{ type, card: OcgLocPos, target: OcgLocPos | null }`，而 `OcgLocPos` 只有 `controller / location / sequence / position`，**不含卡密**（对照 `ygopro/ygopro/gframe/duelclient.cpp` 的经典报文解析：`MSG_ATTACK` 只读攻击方与目标方的 控制者+区域+序列，同样没有卡密字段）。于是 `Number(undefined)` = `NaN`，`cardName()` 走 `if (!key || key <= 0) return '未知卡'`。更要紧的是 `target` 整块被丢掉——模型永远不知道打的是谁。

**src/main/services/duelEngineService.ts**（改用位置反查，并把目标写进旁白）：

```diff
       } else if (kind === OcgMessageType.ATTACK) {
-        out.push(
-          `${this.sideName(session.activePlayer)}宣告【${this.cardName(Number((msg as unknown as { code: number }).code))}】攻击`
-        )
+        const m = msg as unknown as { card?: unknown; target?: unknown }
+        const attacker = this.resolveLocName(m.card) ?? '未知怪兽'
+        const target = this.resolveLocName(m.target)
+        out.push(
+          target
+            ? `${this.sideName(session.activePlayer)}【${attacker}】攻击【${target}】`
+            : `${this.sideName(session.activePlayer)}【${attacker}】直接攻击玩家`
+        )
```

新增两个位置反查的私有方法（`cardName` 之前）。用现成的 `duelQueryLocation`（快照逻辑里已经在用）按 控制者+区域+序列 取卡密，失败一律降级为 `null` 而不是抛异常——旁白是只读装饰，不该因为一次查询失败把整个 `duelProcess` 循环打断：

```diff
+  private resolveLocCode(loc: unknown): number {
+    if (!loc || typeof loc !== 'object') return 0
+    const p = loc as { controller?: number; location?: number; sequence?: number }
+    const controller = Number(p.controller)
+    const location = Number(p.location)
+    const sequence = Number(p.sequence)
+    if (!Number.isFinite(controller) || !Number.isFinite(location) || !Number.isFinite(sequence)) {
+      return 0
+    }
+    const session = this.requireSession()
+    try {
+      const rows = session.core.duelQueryLocation(session.handle, {
+        flags: OcgQueryFlags.CODE as OcgQueryFlags,
+        controller: (controller === 1 ? 1 : 0) as 0 | 1,
+        location: location as OcgLocation
+      })
+      const code = Number(rows?.[sequence]?.code ?? 0)
+      return code > 0 ? code : 0
+    } catch {
+      return 0
+    }
+  }
+
+  private resolveLocName(loc: unknown): string | null {
+    const code = this.resolveLocCode(loc)
+    if (!code) return null
+    const name = this.cardName(code)
+    return name === '未知卡' ? null : name
+  }
```

### 第二步：`MSG_BATTLE` 从未进入过旁白

**缘由**：`OcgMessageBattle` 是 `{ card: OcgCardLocBattle, target: OcgCardLocBattle | null }`，`OcgCardLocBattle` 带 `attack / defense / destroyed`——这是整条链路里**唯一**能告诉模型「星尘龙被战斗破坏了」的消息。但 `consumeMessages()` 从第一步写到增补七，一直只有 `ATTACK / DAMAGE / RECOVER / LPUPDATE / MOVE / POS_CHANGE / CHAINING / WIN`，**没有 `BATTLE` 分支**。模型要推断破坏，只能靠 `MSG_MOVE`（星尘龙 怪兽区 → 墓地）间接猜，而 `MSG_MOVE` 同样分不清是被战斗破坏、被效果破坏还是被解放。

**src/main/services/duelEngineService.ts**（补结算分支，按表示形式取攻/防，并覆盖攻击方反被破坏的情况）：

```diff
+      } else if (kind === OcgMessageType.BATTLE) {
+        const m = msg as unknown as {
+          card?: { destroyed?: boolean }
+          target?: { attack?: number; defense?: number; position?: number; destroyed?: boolean }
+        }
+        const attacker = this.resolveLocName(m.card) ?? '未知怪兽'
+        const target = this.resolveLocName(m.target)
+        if (!target) {
+          out.push(`战斗结算：【${attacker}】直接攻击`)
+        } else {
+          const pos = Number(m.target?.position ?? 0)
+          const isAttackPos =
+            pos === CardPosition.FACEUP_ATTACK || pos === CardPosition.FACEDOWN_ATTACK
+          const stat = isAttackPos ? Number(m.target?.attack ?? 0) : Number(m.target?.defense ?? 0)
+          const verdict =
+            m.target?.destroyed === true ? `【${target}】被战斗破坏` : `【${target}】未被战斗破坏`
+          const backfire = m.card?.destroyed === true ? `；【${attacker}】反被战斗破坏` : ''
+          out.push(
+            `战斗结算：【${attacker}】vs【${target}】（${isAttackPos ? '攻' : '防'}${stat}）→ ${verdict}${backfire}`
+          )
+        }
+      } else if (kind === OcgMessageType.CHAINING) {
```

输出形如 `战斗结算：【青眼究极龙】vs【星尘龙】（攻2500）→ 【星尘龙】被战斗破坏`。模型现在能自己核对「4500 > 2500 → 破坏 + 2000 穿透」，也能一眼看出「（防2000）→ 被战斗破坏」却没有任何 LP 变化——正是上面那个最易翻车的情形。

### 第三步：攻击选项只报攻击方，模型在点之前无从核对

**缘由**：`buildBattleOptions` 的攻击项 label 是 `宣告攻击：青眼究极龙`，只有攻击方名字。模型当然可以回头调 `get_current_board` 看对方场上，但那要多一次工具调用、多付一轮上下文，而且和「这一步要选什么」不在同一屏里。更实际的收益是：把对方场上的**表示形式和数值**直接贴在选项上，模型在点之前就能算 `4500 - 2500 = 2000`，算不对就不会点。

**src/main/services/duelEngineService.ts**（`buildBattleOptions` 增加 `player` 入参，攻击项附对方场上摘要）：

```diff
   private buildBattleOptions(m: {
+    player: number
     chains: { code: number }[]
     attacks: { code: number; can_direct: boolean }[]
     to_m2: boolean
     to_ep: boolean
   }): InternalOption[] {
     const options: InternalOption[] = []
+    const side = (Number(m.player) === 1 ? 1 : 0) as 0 | 1
+    let targetsCache: string[] | null = null
+    const targets = (): string[] => {
+      if (targetsCache === null) targetsCache = this.attackTargetDescriptions(side)
+      return targetsCache
+    }
```

```diff
     ;(m.attacks ?? []).forEach((c, i) => {
+      const foes = targets()
+      const foeText = foes.length === 0 ? '对方场上没有怪兽' : `对方场上: ${foes.join('、')}`
+      const directText = c.can_direct ? ' · 可直接攻击玩家' : ''
       options.push({
         id: 0,
-        label: `宣告攻击：${this.cardName(Number(c.code))}${c.can_direct ? '（可直接攻击玩家）' : ''}`,
+        label: `宣告攻击：${this.cardName(Number(c.code))}（${foeText}${directText}）`,
```

`targets()` 是懒求值——没有可攻击的怪兽时一次 wasm 查询都不做，避免每轮 `SELECT_BATTLECMD` 都白付一次开销。配套新增 `attackTargetDescriptions`，一次 `duelQueryLocation` 取回对方怪兽区的 卡密+表示形式+攻防：

```diff
+  private attackTargetDescriptions(player: 0 | 1): string[] {
+    const foe = (player === 1 ? 0 : 1) as 0 | 1
+    const session = this.requireSession()
+    try {
+      const rows = session.core.duelQueryLocation(session.handle, {
+        flags: (OcgQueryFlags.CODE |
+          OcgQueryFlags.POSITION |
+          OcgQueryFlags.ATTACK |
+          OcgQueryFlags.DEFENSE) as OcgQueryFlags,
+        controller: foe,
+        location: OcgLocation.MZONE
+      })
+      const out: string[] = []
+      rows?.forEach((row) => {
+        const code = Number(row?.code ?? 0)
+        if (!row || code <= 0) return
+        const pos = Number(row.position ?? 0)
+        const isAttackPos =
+          pos === CardPosition.FACEUP_ATTACK || pos === CardPosition.FACEDOWN_ATTACK
+        const stat = isAttackPos ? Number(row.attack ?? 0) : Number(row.defense ?? 0)
+        out.push(`${this.cardName(code)}(${positionName(pos)} ${isAttackPos ? '攻' : '防'}${stat})`)
+      })
+      return out
+    } catch {
+      return []
+    }
+  }
```

调用点同步补上 `player`（`SELECT_BATTLECMD` 消息本身带这个字段，不需要额外查询）：

```diff
       return this.buildBattleOptions(
         msg as unknown as {
+          player: number
           chains: { code: number }[]
           attacks: { code: number; can_direct: boolean }[]
```

选项形如：`宣告攻击：青眼究极龙（对方场上: 星尘龙(表侧攻击 攻2500)）`。

### 这一轮的边界：攻击目标仍然不可选

必须写清楚，第三步**没有**让模型获得「指定打哪只」的能力——`OcgResponseSelectBattleCMD` 的类型是 `{ type, action, index }`，**没有目标位**；ocgcore 的消息枚举里也不存在「选择攻击目标」这一步（`ygopro/ygopro/gframe/duelclient.cpp` 的 `MSG_SELECT_BATTLECMD` 解析证实 `attacks` 每项 8 字节 = 卡密+控制者+区域+序列+`can_direct`，不含目标）。目标由引擎自行判定。

所以这条边界是**协议层限制，不是本次改动能消掉的**：对方场上只有 1 只可攻击怪兽时（本轮实测场景）完全等价、无需选择；对方 ≥2 只时，模型只能宣告「谁来攻击」，打谁由引擎定。选项上的 `对方场上: A、B` 至少让模型知道**存在歧义**，避免它以为自己已经指定了目标。

- 验收（本轮）：`npx tsc -p tsconfig.node.json --composite false --noEmit` 零错误；`npx eslint src/main/services/duelEngineService.ts` 零错误零警告；`npx prettier --write` 无变更。
- 复验方式：让背后灵推演一场带攻击的对局，`agent.log` / 观众旁白里应出现 `我方【青眼究极龙】攻击【星尘龙】` 与 `战斗结算：…（攻2500）→ 【星尘龙】被战斗破坏`，而不再是 `宣告【未知卡】攻击`。

## 增补九：第五轮实测——开局卡死在空操作列表，根因是忘了 `startDuel`

### 先说清楚这一轮的真实矛盾

**矛盾：引擎能建会话、能枚举消息，却唯独在「开局第一手」交了白卷。**

复现：双方卡组装填、牌序编排后 `duel_engine_start` 开局，返回的是 `对局开始，第 0 回合 · 我方回合 · DP` 加一行 `当前可执行的操作：（空白）`；`duel_engine_choose` 传任何 `picks` 都被回「编号不在当前可选项中」。引擎确实起了一个会话（不是建局失败），但一个合法操作都枚举不出来。

**为什么这次不能靠「加个兜底」糊过去**：空列表有两种成因——（a）引擎真没启动，从未推进到能出操作的状态；（b）引擎启动了，但当前盘面下确实没有任何合法动作（比如双方都没能召唤的怪）。两者处理完全不同：前者是 bug，后者是规则。必须先确认是哪一种，否则改动会越改越偏。

**查证结论（决定性）**：`DP` 这个字样不是引擎说的，是 `start()` 里写死的 `session.currentPhase = 'DP'` 初始值（`start()` 把 `ensureWaiting` 拿到的 narration 和「对局开始 + describeTurn()」拼在一起，而 `describeTurn` 读的就是这个初始值）。也就是说，**`duelProcess` 一次都没真正推进过**——如果引擎跑起来了，至少该有条 `MSG_NEW_PHASE` 把它推进到 M1。配合「全程零消息」这一事实，根因锁定为**对局从未启动**。

**解决思路**：`ocgcore-wasm` 的 `OcgCore` 接口明确有 `startDuel(handle): Promise<void>`，文档原文「Triggers the start of the duel」；标准 EDOPro 流程是 `createDuel → duelNewCard → startDuel → duelProcess 循环`。本项目 `createDuelFromState` 只做了前两步，缺了 `startDuel`，于是 `duelProcess` 在「未启动」状态下直接回一个空 `SELECT_IDLECMD`。

### 第一步：用最小对局脚本实测，把「缺 startDuel」坐实

**缘由**：上一轮（增补五/六/七）的压缩与编排问题一直在更上层，从没人真正跑到「开局后第一个 summon 列表」，所以这个缺失一直没暴露。要确认根因，最快的办法是绕开整个 Electron / 编排层，直接用 `ocgcore-wasm` 在 Node 里跑同一个最小流程，对比「不调 startDuel」与「调 startDuel」两种情况下 `duelGetMessage` 的产物。

**实测结果（最小对局：我方手牌 1 张青眼白龙 / 对方手牌 1 张 / 我方卡组 1 张，MR5 + PSEUDO_SHUFFLE）**：

- **不调 `startDuel`**：`message types seen: []`，`SELECT_IDLECMD: never produced` —— 引擎全程零消息，与用户复现的「空列表」完全吻合。
- **调了 `startDuel`**：`message types seen: ["40:1","33:2","41:3","2:1","11:1"]`（分别是 NEW_TURN / SHUFFLE_HAND / NEW_PHASE / DRAW / SELECT_IDLECMD），并能在手牌的 4 星怪上枚举出 `summons` 选项；把青眼白龙（8 星）放手里时 `summons` 为空——因为它需要 2 只祭品才能通常召唤，属**正确**行为，不是引擎问题。

这一步把「空列表 = 没启动」从推测变成了可复现的事实。

### 第二步：补上缺失的 `startDuel`

**缘由**：根因既明，改动极小——在「逐张注入卡牌」的循环之后、返回 handle 之前，补上启动调用即可。这步必须放在 `createDuelFromState` 里（它持有 handle 且负责建局），而不是 `duelEngineService.start()`（`start` 返回后才建会话）。注意 `startDuel` 属 `OcgCoreSync` 的同步变体，depromisify 后返回 `void`，`await` 即可。

**src/main/services/ocgcoreService.ts**（建局后启动对局）：

```diff
       cardCount++
     }
+
+    await core.startDuel(handle)
 
     return { handle, core, cardCount }
```

- 验收（本轮）：`npx tsc -p tsconfig.node.json --composite false --noEmit` 零错误；`npx eslint src/main/services/ocgcoreService.ts` 零警告；最小对局脚本实测「调 startDuel → 出现 SELECT_IDLECMD 且 summons 可枚举」，删脚本后已清理。
- 交给 AI 的下一步：开局后 `duel_engine_choose` 应能拿到真实的「通常召唤 / 特殊召唤 / 进入战斗阶段」等选项；若盘面确实无合法操作（如双方手牌都不能召唤、也没法进阶段），那才是规则性的空列表，需要 `choose` 兜底而非改引擎。两种空列表现在必须靠「有没有 MSG_NEW_PHASE 推进过」来区分。

## 增补十：第六轮实测——不是因为「写太长」被截断，而是查卡吃光了输出预算

### 先说清楚这一轮的真实矛盾

**矛盾：输出预算是共享的，而工具调用和正文在抢同一份。**

现象：引擎修好后（增补九）再跑同一道题，AI 连着调了 8 次 `get_card_info`（每批 10~12 张卡的完整效果文），然后报「回答因超出单次回复上限被截断」。日志里有一行最有信息量的字段：`streamChars=0` —— **正文一个字都没写出来**。

这行字把问题彻底定了性：它不是「正文写太长写不下」，而是**预算在正文开始之前就被工具参数吃光了**。因为单次回复的输出 token 是「思考链 + 正文 + 所有工具调用的参数」共用的一个池子，8 次查卡的返回内容连同后续每轮的思考，把这池子填满了，轮到写正文时已经没有额度。

**为什么之前的护栏没挡住**：`get_card_info` 早就设了「单次最多 12 张」的上限，注释里还记着一次真实事故（「16+22+11 张连查后正文预算见底被截断」）。但这道闸只防「一次查爆」，防不住「连续多次把预算磨光」——8 次 × 12 张 = 近百张卡的全文，单次限制对此完全无感。

**需求**：把「单次能查多少」升级为「一轮总共能消耗多少」，并在逼近上限时把模型**赶去写正文**而不是继续查。同时，缺省输出上限本身也不该写死。

**解决思路**（对应下面三步）：

1. **缺省输出上限不能写死**：参考 ZCode `model-token-limits.ts` 的取法——模型/用户声明的值优先，没声明才用缺省；再按「剩余窗口」钳一次（pi `clampMaxTokensToContext` 的同款思路）。此前写死 8192 等于把所有模型都当成 `deepseek-chat`。
2. **加「本轮累计查询预算」**：参考 dsh 工具结果预算（`thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`）与 opencode `DOOM_LOOP_THRESHOLD`（连续同类调用即拦）的口径，给 `get_card_info` 增加按字符计的本轮累计闸；超限后只回一句引导，逼模型用已有信息推进。
3. **提示词层面分回合**：参考 ZCode `classifyOutputTokenContinuation` 的核心判定——**本轮有工具调用就不期待正文**。把「工具轮」与「正文轮」在指令上分开，思考链就不会和工具参数抢预算。

### 第一步：缺省输出上限从「写死 8192」改成「声明优先 + 剩余窗口钳制」

**缘由**：`agentService.ts` 原来写的是 `...(cfg.maxTokens ? { maxTokens: cfg.maxTokens } : { maxTokens: 8192 })`，注释里的理由是「deepseek-chat 硬上限就是 8192」。但这是把**一个厂商的限制当成了全局默认**：声明 32K/64K 窗口的模型也被压回 8192，而编排任务（思考链 + 8 次查卡 + 正文）在 8192 里必然截断。查四份参考：pi 自身默认 16384，opencode 与 ZCode 的缺省都是 32K。

**措辞更正**（原文写的「模型声明了更大的就该原样用」容易被误读）：四份参考里的「声明值优先」，指的是它们**内置的模型能力元数据表**（由 `models.dev` 之类的目录生成，记着每个模型的 context/output 上限）比缺省值权威；**不是**指用户手填的配置能突破服务端硬上限。本项目没有那份元数据表，所以这里的语义是：用户在设置里为某个模型显式填了值就听用户的，没填才用 32768 缺省；而无论哪种，服务端硬上限更低时请求会被**拒绝**（不会静默降级），需要用户自己填对。

**src/main/services/agentService.ts**（新增两个常量）：

```diff
 const DEFAULT_CONTEXT_WINDOW = 131_072
+/**
+ * 未配置输出上限时的安全默认值（tokens）。
+ * 此前写死 8192，实测在「串行 8 次 get_card_info + 整场编排」的任务里必然半途截断
+ * （stopReason: length，正文 0 字）。参考 ZCode `model-token-limits.ts` 的取法：
+ * 模型自己声明的值优先、没声明才用这个默认值——32K 是「缺省值」而非「全局上限」，
+ * 声明了更大窗口的模型不该被这里压回去。pi 自身默认 16384、opencode/ZCode 均以
+ * 32K 为缺省，取三者中更宽但仍在主流厂商硬上限内的 32768。
+ */
+const DEFAULT_MAX_OUTPUT_TOKENS = 32_768
+/**
+ * 输出预算与上下文之间的安全余量（tokens），参考 pi `clampMaxTokensToContext`
+ * 的 CONTEXT_SAFETY_TOKENS=4096：把输出上限钳到「剩余窗口」之内，避免
+ * 工具结果堆积后输出预算把上下文顶爆。
+ */
+const OUTPUT_CONTEXT_SAFETY_TOKENS = 4096
```

把「写死 8192」换成解析函数：

```diff
+    const contextWindow = cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW
+    const resolveMaxTokens = (): number => {
+      const declared =
+        cfg.maxTokens && cfg.maxTokens > 0 ? cfg.maxTokens : DEFAULT_MAX_OUTPUT_TOKENS
+      const ceiling = Math.max(1024, contextWindow - OUTPUT_CONTEXT_SAFETY_TOKENS)
+      return Math.min(declared, ceiling)
+    }
+
     const modelsConfig = {
```

```diff
-              contextWindow: cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
-              // 输出上限：读不到模型真实上限时**整个省略 maxTokens 字段**，
-              // 让厂商按自己的默认值走，而不是猜一个数把回答截在半途。
-              // 参考 ZCode 的处理：值不可知就不写进 models.json（它用 JSON Merge Patch
-              // 达成同样效果，值为 undefined 的 key 不会出现在请求体里）。
-              // 实测修正：DeepSeek 等厂商的**默认 max_tokens 只有 4096**，而编排任务
-              // 在一条回复里要同时装思考链 + 正文 + 大工具参数，4096 几乎必然半途截断
-              // （stopReason: length）。用户没显式设置时写安全默认 8192 —— DeepSeek-chat
-              // 的硬上限就是 8192，Claude / GPT / Qwen 系也都不低于它；用户显式设置的值原样生效。
-              ...(cfg.maxTokens ? { maxTokens: cfg.maxTokens } : { maxTokens: 8192 }),
+              contextWindow,
+              // 输出上限：采用 ZCode `resolveModelStepMaxOutputTokens` 的取法——
+              // 用户为模型显式配置的值优先，没配才回落到 DEFAULT_MAX_OUTPUT_TOKENS；
+              // 两者都要再按「剩余窗口」钳一次（pi `clampMaxTokensToContext` 的同款思路），
+              // 防止工具结果堆积后输出预算把上下文顶爆。
+              // 早期版本在这里写死 8192（理由是 deepseek-chat 硬上限为 8192），
+              // 但那等于把所有模型都当成 deepseek-chat：声明了 32K/64K 窗口的模型
+              // 会被无谓压回 8192，编排任务（思考链 + 8 次查卡 + 正文）必然截断。
+              maxTokens: resolveMaxTokens(),
```

**src/renderer/src/components/Settings/AgentSettingsContent.tsx**（placeholder 与说明同步，避免 UI 仍暗示默认 8192）：

```diff
-            placeholder="8192"
+            placeholder="32768"
```

```diff
-        按所选模型实际能力填写（留空使用默认值），影响 token 估算与自动压缩。失焦后自动保存。
+        按所选模型实际能力填写（留空使用默认值 32768），影响 token
+        估算与自动压缩。编排类任务（查卡 + 写战报）建议不低于 16384；部分厂商硬上限较低（如
+        deepseek-chat 为 8192），填超过会被服务端拒绝。失焦后自动保存。
```

### 第二步：给 `get_card_info` 加「本轮累计预算」，超限就把预算赶回正文

> **本节已被增补十一推翻。** 该方案把「效果文」当成了可压缩的噪声，但 `①②③` / `●` 是规则语义、
> 截断会让模型失去判断卡与卡联动的前提。下面保留原始记录以便对照，现行方案见增补十一
> （开局一次性注入双方完整卡表 + 查卡去重，取消字符闸）。

**缘由**：单次 12 张的闸门挡不住「连续多次」。新增一个按字符计的**本轮累计**闸：单张卡约 400~600 字符，给 16000 字符的额度（约 25~30 张卡），够认真核对关键卡，再查基本就是在刷上下文。超限后本工具**不再返回效果文**，只回一句明确引导——这样模型下一轮收到的不是更多资料，而是「该动手了」。

**src/main/services/agentService.ts**（新增实例字段与常量）：

```diff
   /** 本轮工具调用次数（可观测性与截断诊断用） */
   private toolCallCount = 0
+  /**
+   * 本轮 get_card_info 累计输出的字符数。单次调用限 12 张只能挡住「一次查爆」，
+   * 挡不住「连续 N 次把预算磨光」——实测 8 次调用后正文预算见底、一个字都写不出。
+   * 参考 opencode `DOOM_LOOP_THRESHOLD`（同名同参连续调用即拦截）与 dsh 工具结果
+   * 预算（`thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`）的口径，
+   * 按「本轮累计字符数」设闸：超限后本工具只回提示，把预算逼回给正文与编排。
+   */
+  private cardInfoCharsThisTurn = 0
+  /**
+   * 单轮 get_card_info 累计输出字符上限。单张卡约 400~600 字符，这个额度大致够
+   * 认真核对 25~30 张卡；超过它再查基本是在刷上下文而非做判断。
+   */
+  private static readonly CARD_INFO_TURN_CHAR_BUDGET = 16_000
```

在工具入口加闸（在单次 12 张的截断之后、真正查询之前）：

```diff
         this.emitEvent({
           type: 'tool_call_start',
           id: _toolCallId,
           toolName: 'get_card_info',
           params: { codes }
         })
+
+        // 本轮累计配额：单次 12 张只是「防一次查爆」，连续多次仍能把整轮预算磨光。
+        // 到达上限后不再返回效果文，只回一句引导，让模型用已有信息推进正文/编排。
+        if (this.cardInfoCharsThisTurn >= AgentService.CARD_INFO_TURN_CHAR_BUDGET) {
+          this.emitEvent({
+            type: 'tool_call_end',
+            id: _toolCallId,
+            toolName: 'get_card_info',
+            resultSummary: `本轮查卡已达上限（${this.cardInfoCharsThisTurn} 字符），返回引导`
+          })
+          return {
+            content: [
+              {
+                type: 'text',
+                text: `本轮查询卡片的总量已达上限（约 ${Math.round(AgentService.CARD_INFO_TURN_CHAR_BUDGET / 1000)}K 字符）。你已经有足够信息了：请停止继续查卡，直接用已获得的效果文本推进剧情与编排（编排整场对局、或在正文里写出战报）。若确实还缺某张关键卡的信息，请在下一轮再查，并把本轮结论先写出来。`
+              }
+            ],
+            details: { found: 0, budgetExhausted: true }
+          }
+        }
```

返回处累计，并在每轮开始清零：

```diff
-        const details: Record<string, unknown> = {
+        const text = fullText + suffix + overflowNote
+        this.cardInfoCharsThisTurn += text.length
+
+        const details: Record<string, unknown> = {
           found: found.length,
           names: found.map((c) => c.name),
           missing
         }
         return {
-          content: [{ type: 'text', text: fullText + suffix + overflowNote }],
+          content: [{ type: 'text', text }],
           details
         }
```

```diff
     this.arrangedBoardState = null
     this.collectedCardSwap = null
     this.toolCallCount = 0
+    this.cardInfoCharsThisTurn = 0
```

### 第三步：诊断日志要分清「写太长」和「被工具吃光」

**缘由**：原来只有一句 `reply truncated by model length cap`，两种完全不同的成因被混成一条。参考 ZCode `classifyOutputTokenContinuation` 的判定（**`toolCallCount > 0` 就不走续写路径**）——工具调用占着预算时，正确答案不是「继续写」，而是「换一轮再写」。诊断和给用户的建议都要跟着分开。

**src/main/services/agentService.ts**（日志加 `starvedByTools` 与 `cardInfoChars`，提示语分情况）：

```diff
       if (lastAssistant?.stopReason === 'length') {
         const summaryText = (this.streamText || '').trim()
+        // 正文 0 字 + 有工具调用 = 预算被工具参数吃光，而非「写太长被截」。
+        // 两种成因的下一步完全不同，诊断时分开记，别再笼统归一句「调高上限」。
+        const starvedByTools = summaryText.length === 0 && this.toolCallCount > 0
         agentLogger.warn('chat', 'reply truncated by model length cap', {
           streamChars: summaryText.length,
+          starvedByTools,
+          cardInfoChars: this.cardInfoCharsThisTurn,
```

```diff
+        const causeNote = starvedByTools
+          ? `这次是「工具调用吃光了输出预算」而不是「正文写太长」：本轮已调用 ${this.toolCallCount} 次工具、其中查卡约 ${this.cardInfoCharsThisTurn} 字符，留给正文的额度不够了。最有效的做法不是调高上限，而是让它分两步走——先说「继续编排」让它接着推进，或直接说「写战报」把正文单独放一轮。`
+          : ''
-        const errMsg = `回答因超出单次回复上限被截断。${workNote}${engineNote}可在「设置 → 模型设置 → 对话」中调高「单次回复上限」后重试。`
+        const errMsg = `回答因超出单次回复上限被截断。${causeNote}${workNote}${engineNote}可在「设置 → 模型设置 → 对话」中调高「单次回复上限」后重试。`
```

顺带在 system prompt 的编排段落补两句可执行约束（**分回合**、**查卡要克制**），把「工具轮不写正文」变成明确指令而不是期望：参考 ZCode 的判定，工具轮与正文轮分开推进，思考链就不会和工具参数抢同一份预算。

```diff
   - **不要在思考里推演整场对局**，也**不要用 propose_duel_steps 一次性编排全场步骤**——一条回复装不下整场，只会被截断。思考链保持简短（行动前的准备，不是剧本本身），把输出预算留给工具调用与台词。
+  - **查卡要克制**：get_card_info 一次最多 12 张效果文，很占输出预算；全轮累计查询也有上限（超限后本工具只会回一句提示）。真正需要核对效果的是少数关键卡，不要为了「万全」把两边牌堆都查一遍——那会先把预算磨光，最后反而一个字都写不出来。查完就该动手。
+  - **分回合推进，不要在同一轮里「查完再写完」**：工具调用（查卡、开局、选择）与正文战报分开推进。工具轮只做工具调用、保持简洁；等引擎把整场对局跑完、你确认终局后，再在下一轮正文里写完整战报。这样思考链不会和工具参数抢同一份输出预算。
```

- 验收（本轮）：`npx tsc -p tsconfig.node.json --composite false --noEmit` 与 `-p tsconfig.web.json` 均零错误；`npx eslint` 对 `agentService.ts`、`AgentSettingsContent.tsx` 零警告；prettier 已 `--write`。
- 解析逻辑实算校验：缺省 → 32768；用户配 8192 → 8192（原样生效，硬上限低的模型可手动配）；上下文误配成 16384 时 → 自动钳到 12288。
- 复验方式：重启 dev 后重跑同一道剧本，`agent.log` 里截断行应带上 `starvedByTools` 字段；若仍截断，检查 `injectedCards`（开局注入的卡数）。

---

## 增补十一：第七轮——取消「按字符限流」，改成「开局一次性给全 + 查卡去重」

### 先说清楚这一轮的真实矛盾

**矛盾：输出预算是稀缺的，但「卡的效果文」不是可压缩的噪声——它是模型做推理的前提。**

增补十的第二步把 `get_card_info` 卡在了 16000 字符的本轮累计闸上，超限后只回一句「你已经有足够信息了，请动手」。这个设计的隐含假设是：**查卡是「刷上下文」的浪费行为**。但这个假设是错的：

- 效果文里的 `①②③` 是**效果编号**（其他卡的效果里会写「这个效果①……」，跨卡引用就靠它）。
- `●` 是**发动条件标记**（「●自己场上有龙族怪兽存在的场合」这类分支的前提）。

这两类记号一旦被截断，「这张卡能不能特召」「这张卡和那张卡能不能连」的判断就没有依据了。而判断卡间联动恰恰是这套编排的核心能力。所以**闸门拦下的不是浪费，是必要的推理材料**。

**再算一笔账，看这个闸门是否真的必要**：整副卡组约 40 张，双方合计约 87 张；单张卡含完整效果文约 400~600 字符。→ 87 × ~520 ≈ 4.5 万字符 ≈ **1.2 万 token**。这个量级：

- 相对 32768 的输出上限——是一次性的一次工具结果，不是每轮重付；
- 相对 131072 的默认上下文——不到 10%；
- 而它换来的是**整场对局中模型手里始终有全部卡的完整文本**，不必在推演中途反复查卡去和正文抢输出预算。

也就是说：**「按字符限流」是在用不确定的多次小额成本，去规避一次确定的 1.2 万 token 成本——算错了方向。**

**需求**：把「限制查多少」改成「一次性给全 + 不重复给」。

### 第一步：开局一次性注入双方完整卡表

**缘由**：`duel_engine_start` 是双方卡组都已装填、整场对局即将开始的唯一时点。在此刻把双方所有卡片的**完整**效果文（`desc` 不做任何截断）拼进工具结果，一轮就付完全部成本。

**src/main/services/agentService.ts**（新增 `buildCardTableText` 私有方法）：

```diff
+  /**
+   * 开局一次性注入双方卡组的完整效果文。
+   *
+   * 为什么不做「按字符配额」：效果文里的 `①②③` 是效果编号（会被其他卡引用）、
+   * `●` 是发动条件标记，都是**规则语义**，截断或省略会让模型无法判断卡与卡的联动。
+   * 而 token 成本实际上很低——整副卡组约 40 张、单张含全文约 400~600 字符，
+   * 双方合计约 87 张 ≈ 1.2 万 token，且**只在开局付一次**；换来的是此后模型
+   * 推理卡与卡联动时手里始终有完整文本，不必反复查卡去抢输出预算。
+   * 从「按字符限流」改成「一次性给全 + 去重」，是把成本从未知次数摊到一次确定成本。
+   */
+  private buildCardTableText(state: DuelPuzzleState): string {
+    const codes = new Set<number>()
+    for (const card of state.cards) {
+      const code = Number(card.code)
+      if (Number.isFinite(code) && code > 0) codes.add(code)
+    }
+    const idList = [...codes]
+    if (idList.length === 0) return ''
+
+    const dict = cdbService.getCardsByIds(idList)
+    const rows: string[] = []
+    for (const code of idList) {
+      const card = dict[code]
+      if (!card) continue
+      const desc = String(card.desc ?? '')
+      rows.push(
+        `【${card.name}】\n卡密: ${card.id}\n等级: ${card.level & 0xff} | 属性: ${card.attribute} | 种族: ${card.race}\n攻击力: ${card.atk} | 守备力: ${card.def}\n效果描述:\n${desc}`
+      )
+      this.injectedCardCodes.add(code)
+    }
+    if (rows.length === 0) return ''
+    return `\n\n===== 本局双方卡表（完整效果文，已一次性给出）=====\n以下 ${rows.length} 张卡的效果文是**全文**，未做任何截断。判断卡与卡的联动时直接以此为准，不要再用 get_card_info 重复查询这些卡。\n\n${rows.join('\n\n---\n\n')}`
+  }
```

挂到 `duel_engine_start` 的成功返回上：

```diff
-          return {
-            content: [{ type: 'text', text: lines.join('\n') }],
-            details
-          }
+          return {
+            content: [
+              {
+                type: 'text',
+                text: lines.join('\n') + this.buildCardTableText(this.arrangedBoardState ?? state)
+              }
+            ],
+            details
+          }
```

新增一个实例字段（记录已注入的卡，供去重与诊断用）：

```diff
   private toolCallCount = 0
+  /**
+   * 本会话已完整注入过卡表的卡密集合。开局一次性把双方卡组的完整效果文
+   * 灌进上下文，此后同卡再查直接回「已注入」而不重复占用输出预算。
+   */
+  private injectedCardCodes = new Set<number>()
```

### 第二步：删掉字符闸，改成「已注入的卡不重复返回」

**缘由**：闸门取消后，防浪费的职责交给**去重**——同一张卡不再第二次吐全文，但**新卡照样给全**。这是关键差别：闸门是「不给你更多」，去重是「不给你重复的」。

**src/main/services/agentService.ts**（删除闸门，`get_card_info` 返回值改为按是否已注入分流）：

```diff
         this.emitEvent({
           type: 'tool_call_start',
           id: _toolCallId,
           toolName: 'get_card_info',
           params: { codes }
         })
-
-        // 本轮累计配额：单次 12 张只是「防一次查爆」，连续多次仍能把整轮预算磨光。
-        // 到达上限后不再返回效果文，只回一句引导，让模型用已有信息推进正文/编排。
-        if (this.cardInfoCharsThisTurn >= AgentService.CARD_INFO_TURN_CHAR_BUDGET) {
-          this.emitEvent({ ... resultSummary: `本轮查卡已达上限（${this.cardInfoCharsThisTurn} 字符），返回引导` })
-          return {
-            content: [{ type: 'text', text: `本轮查询卡片的总量已达上限（约 ... 请停止继续查卡 ...` }],
-            details: { found: 0, budgetExhausted: true }
-          }
-        }
```

```diff
-        const fullText = found
+        // 开局已完整注入过的卡直接跳过：效果文已在上下文里，重发一遍只是白烧预算。
+        const fresh = found.filter((card) => !this.injectedCardCodes.has(card.id))
+        const alreadyInjected = found.filter((card) => this.injectedCardCodes.has(card.id))
+
+        const fullText = fresh
           .map((card) => { ... })
           .join('\n\n---\n\n')
+        const injectedNote =
+          alreadyInjected.length > 0
+            ? `\n\n（以下卡片的效果文开局已完整给出，此处不再重复：${alreadyInjected
+                .map((c) => `【${c.name}】`)
+                .join('、')}）`
+            : ''
         const suffix = missing.length > 0 ? `\n\n（未找到卡密：${missing.join(', ')}）` : ''
@@
-          resultSummary:
-            found.length === 1
-              ? `已获取【${found[0].name}】的详细效果`
-              : `已获取${found.length} 张卡片的详细效果`
+          resultSummary:
+            fresh.length === 0
+              ? `已跳过 ${alreadyInjected.length} 张开局已注入的卡`
+              : fresh.length === 1
+                ? `已获取【${fresh[0].name}】的详细效果`
+                : `已获取${fresh.length} 张卡片的详细效果`
         })
 
-        const text = fullText + suffix + overflowNote
-        this.cardInfoCharsThisTurn += text.length
+        const text = fullText + injectedNote + suffix + overflowNote
```

每轮重置同步替换：

```diff
     this.toolCallCount = 0
-    this.cardInfoCharsThisTurn = 0
+    this.injectedCardCodes.clear()
```

### 第三步：诊断与提示词跟着改口径

**缘由**：日志字段 `cardInfoChars` 已不存在，换成 `injectedCards`（反映卡表注入规模）；给用户的说明也从「查卡吃光预算」改为正确归因。

```diff
         agentLogger.warn('chat', 'reply truncated by model length cap', {
           streamChars: summaryText.length,
           starvedByTools,
-          cardInfoChars: this.cardInfoCharsThisTurn,
+          injectedCards: this.injectedCardCodes.size,
```

```diff
         const causeNote = starvedByTools
-          ? `这次是「工具调用吃光了输出预算」而不是「正文写太长」：本轮已调用 ${this.toolCallCount} 次工具、其中查卡约 ${this.cardInfoCharsThisTurn} 字符，留给正文的额度不够了。...`
+          ? `这次是「工具调用吃光了输出预算」而不是「正文写太长」：本轮已调用 ${this.toolCallCount} 次工具（开局卡表已一次性完整注入 ${this.injectedCardCodes.size} 张卡，无需再逐张查），留给正文的额度不够了。...`
           : ''
```

system prompt 里那条「查卡要克制」改写为「卡表已给全，不要重复查」：

```diff
-  - **查卡要克制**：get_card_info 一次最多 12 张效果文，很占输出预算；全轮累计查询也有上限（超限后本工具只会回一句提示）。真正需要核对效果的是少数关键卡，不要为了「万全」把两边牌堆都查一遍——那会先把预算磨光，最后反而一个字都写不出来。查完就该动手。
+  - **卡表已一次性给全，不要重复查卡**：duel_engine_start 会把双方卡组全部卡片的**完整效果文**（未截断）一次性注入到这条结果里。判断卡与卡的联动、时点、条件时直接以那份卡表为准；只有卡表之外的卡（例如引擎中途生成的新卡）才需要 get_card_info。反复查同一张卡只是白烧输出预算。
```

### 顺带修正

- **UI 说明去掉具体模型举例**：`AgentSettingsContent.tsx` 的「单次回复上限」帮助文案删掉了「（如 deepseek-chat 为 8192）」——举一个用户根本没在用的模型只会造成困惑，改为「填超过模型本身支持的上限会被服务端拒绝」。
- **文档措辞更正**：增补十里「缺省值不是全局上限，模型声明了更大的就该原样用」容易被读成「用户手填的值能突破服务端上限」。已在增补十该段补上正确说明——四份参考的「声明值优先」指的是它们**内置的模型能力元数据表**（由 `models.dev` 目录生成），不是用户手填的配置。

- 验收（本轮）：`npx tsc -p tsconfig.node.json --composite false --noEmit` 与 `-p tsconfig.web.json` 均零错误；`npx eslint` 对 `agentService.ts`、`AgentSettingsContent.tsx` 零警告。
- 实算校验：双方 87 张卡 × 约 520 字符 ≈ 4.5 万字符（约 1.2 万 token），一次性注入；此后同卡查询只回一行「已注入」提示（约 30 字符），新卡仍返回全文。
- 复验方式：重启 dev 跑同一道剧本，`duel_engine_start` 的结果里应能看到「本局双方卡表（完整效果文，已一次性给出）」段落；`agent.log` 截断行应带 `injectedCards` 字段。若模型仍反复查同一批卡，检查去重是否生效（`tool_call_end` 的 `resultSummary` 应显示「已跳过 N 张开局已注入的卡」）。
