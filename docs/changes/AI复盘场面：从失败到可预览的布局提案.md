# AI 复盘场面：从「查了一堆卡却摆不上去」到可预览的布局提案

本改动是一次原子化提交，起点是创作者提的一个具体请求：

> 自己场上的LP（生命值）为1000，对方场上的LP为2300。对方主要怪兽区：【机动城 堡垒】攻击表示ATK（攻击力）3000、【古代的机械士兵】攻击表示ATK1300、【绿色零件】攻击表示ATK1400、【黄色零件】守备表示DEF（守备力）1200、【红色零件】守备表示DEF1500。魔法陷阱区域里有一张盖卡和发动了的永续魔法卡【暗黑之扉】。自己的场上只有一张攻击表示的怪兽【特拉戈迪亚】，这张卡的攻击力上升手牌数量X600的数值。此时韩诺的手牌上有【恶魔之斧】、【陷阱拆除】、【代价降低】、【对死者的供奉】、【流星之弓-烨焰】、【神禽王 亚力克特】共六张卡，因此此时的【特拉戈迪亚】攻击力为3600。把这个场面复盘到决斗场上

第一反应是去查工具链能不能满足。查完的结论是：**不能满足，而且缺的不是一点能力，是整条写路径。**

于是先做了一件事——不写代码，先把「为什么摆不上去」逐条核实清楚。因为如果只是凭印象下判断，很可能会把「工具少一个」这种表面问题当成根因，真正的问题反而被漏掉。

---

## 排查：沿三层确认写路径是否闭环

判断「AI 能不能操作 X」不能只看工具有没有，而要沿**工具 schema → 事件载荷 → store action** 三层确认状态变更能不能真正落地。现有五个工具全部止步于「生成结构化文案」。

**第一层，工具 schema。**`propose_duel_steps` 的 `AgentStepProposal` 字段只有 turn / phase / actionPlayer / actionType / cardCode / cardName / speaker / dialogue / innerThoughts / description / chainIndex / lpChange。没有 `toLocation`、没有 `toSequence`、没有 `position`、没有 `duelistId`。

**第二层，事件载荷与导入逻辑。**`applyProposalsToDuel` 逐条只调 `addStep`，而 `addStep` 仅往 `steps[]` 追加，**不写 `boardAfter`、不调 `setPlayerLp`**。全项目搜下来，`lpChange` 字段只有 `AiProposalCard.tsx` 读它渲染成一行「LP 2300 ➔ 0 (-2300)」的文字，没有任何代码把它落进 `players[].lp`。而且用户要的是「初始值设为 1000」，提案模型里连这个概念都没有——它只能表达「从 2300 变成 0」。

**第三层，store 能力。**`addCardToZone(card, controller, location, sequence, position, duelistId)` 和 `setCardCustomStats(instanceId, customAtk, customDef)` 都在，但**没有暴露给模型**。

把这三点摊开之后，那个请求里每一项的失败原因就都很清楚了：

| 创作者要求的操作 | 失败原因 |
| --- | --- |
| 把双方 LP 设为 1000 / 2300 | 无任何工具可写 LP；`lpChange` 只是步骤上的展示字段 |
| 五张怪兽放到指定怪兽区 + 攻/守表示 | 提案无区域、无格子、无表示形式字段 |
| 特拉戈迪亚攻击力 3600 | 卡库里该卡 atk = -1（?），且无自定义攻防的工具入口 |
| 魔陷区盖卡 + 永续魔法【暗黑之扉】 | `SET_SPELL_TRAP` 只是个字符串枚举值，不产生任何放牌行为 |
| 六张手牌归到韩诺名下 | 提案里只有 `actionPlayer: 0 \| 1`，没有 `duelistId` |

还有一个隐藏的连带问题：`DuelStep` 类型本身**是有** `toLocation` / `toSequence` / `instanceId` / `boardAfter` 的，但提案层没暴露这些字段，而且 `addStep` 不生成 `boardAfter`。所以即便退一步只想「生成步骤然后逐步回放」，这条路也是断的——`boardAfter` 为空时 `previewStepBoard` 直接返回。

排查到这一步才真正明白：这不是「给工具加个字段」能解决的，**缺的是一个能真正写 `useDuelStore` 的工具**。

## 定方向：为什么选「可预览待确认」而不是「直接改盘面」

两种做法都能让这句话跑通：一种是 AI 直接改盘面，另一种是 AI 提交一份布局、用户确认后才写。选了后者，理由有三条：

**一是破坏性操作必须有确认点。**布局里带 `clearExisting: true` 时会清空整个盘面。用户根据模型给的预览逐条核对，发现不对可以不点那个按钮。直接改盘面的话，撤销要靠 Ctrl+Z 一步步退，而 AI 一次写入十几张卡意味着十几步撤销。

**二是校验结果需要展示位。**模型填错参数时不应该让整次调用失败——一张牌摆错了，让用户手动删一行重发太麻烦，让 AI 重来一轮更烦。正确做法是「尽力落位 + 把失败原因摊在预览卡上」。这需要一个能承载 warnings 的界面位置，直接改盘面就没有。

**三是符合本项目一贯的取向。**此前把 AI 上下文与对话记录分离时，已经确立过「发给模型的内容」与「展示给用户的内容」必须是两份数据。这里是同一个思路的延伸：AI 产出的是意图，机器翻译成合法状态变更，用户决定要不要执行。

顺带还有个进程层面的天然约束值得利用：`useDuelStore` 是渲染层的 zustand store，主进程的 `agentService` import 不到它。所以工具**物理上就改不了盘面**，它唯一能做的就是发事件。这个限制正好成了设计的第一道保险。

---

## 第一步：先定义提案的数据形状 —— **src/shared/types/ipc.ts**

改动缘由：动手写工具之前先把「AI 能描述什么」定下来。这里有一个关键取舍：**区域与表示形式一律用字符串枚举，而不是 ocgcore 的数字常量。**模型填 `MZONE` 的正确率远高于让它自己输出 `0x04`，填 `FACEUP_DEFENSE` 远高于算 `0x4`。但字符串不能直接写进盘面，得有个映射层——这一步先只定数据形状，映射放到下一步单独抽文件。

另一个决定是把「不知道是哪张的盖卡」写进类型里。创作者原话里「魔法陷阱区域里有一张盖卡」并没有说是哪张，如果 `code` 只允许填真实卡密，这一张会被校验拦掉、整张丢掉，用户看到的场面就少一张牌。所以类型上给它留一个出口。

```diff
+/**
+ * AI 场面布局提案中单张牌的落位描述
+ *
+ * 区域与表示形式一律用**字符串枚举**而非 ocgcore 数字常量：
+ * 模型填 `MZONE` / `FACEUP_DEFENSE` 的正确率远高于让它自己算 0x04 / 0x4，
+ * 主进程收到后再映射成 CardLocation / CardPosition。
+ */
+export interface AgentBoardCardPlacement {
+  /** 8 位卡密；`isUnknown` 为 true 时固定为 0 */
+  code: number
+  /** 卡名快照，仅用于预览展示与人工核对 */
+  cardName?: string
+  /**
+   * 是否是「知道有这张卡、但不知道是哪张」的盖卡。
+   * 用户说「魔陷区有一张盖卡」但没给卡名时置 true：`code` 记 0 不查卡库，
+   * 渲染层显示为无卡名的卡背。
+   */
+  isUnknown?: boolean
+  /** 归属阵营：0 = 我方，1 = 对方 */
+  side: 0 | 1
+  /** 目标区域 */
+  location: AgentBoardZone
+  /** 格子序号：怪兽区/魔陷区 0~4；手牌等堆叠区传 0 由主进程按顺序追加 */
+  sequence: number
+  /** 表示形式；缺省时按区域惯例（魔陷区与手牌默认盖放，怪兽区默认表攻） */
+  position?: AgentBoardCardFacing
+  /**
+   * 目标决斗者名（如「韩诺」）；手牌与堆叠区必填，否则多人模式下会挂到
+   * 当前查看的决斗者名下。传空时按 side 落到该阵营首位。
+   */
+  duelistName?: string
+  /**
+   * 覆盖显示攻击力。用于「特拉戈迪亚攻击力上升手牌数量 X600 → 3600」
+   * 这类动态攻防：卡库里该卡atk 是 -1/?，不覆盖就显示不出真实数值。
+   */
+  customAtk?: number
+  /** 覆盖显示守备力 */
+  customDef?: number
+}
+
+/** AI 可指定的落位区域（不含超量素材与场地魔法专属区，那两处由 UI 操作更合适） */
+export type AgentBoardZone = 'MZONE' | 'SZONE' | 'HAND' | 'GRAVE' | 'DECK' | 'EXTRA' | 'REMOVED'
+
+/** AI 可指定的表示形式 */
+export type AgentBoardCardFacing = 'FACEUP_ATTACK' | 'FACEUP_DEFENSE' | 'FACEDOWN' | 'FACEUP'
+
+/** 单方生命值设定 */
+export interface AgentBoardLpTarget {
+  /** 阵营：0 = 我方，1 = 对方 */
+  side: 0 | 1
+  /** 目标生命值 */
+  lp: number
+  /** 多人模式下指定决斗者名；缺省时按 side 落到该阵营首位（或共享 LP 时全阵营） */
+  duelistName?: string
+}
+
+/**
+ * AI 复盘出的完整场面布局（待用户确认后才写入决斗场）
+ */
+export interface AgentBoardSetupProposal {
+  /** 局面摘要，说明这个布局是什么场合 */
+  summary: string
+  /**
+   * 是否先清空现有盘面再落位。
+   * 「复盘一个全新局面」必须为 true，否则会在原卡片上叠加摆放。
+   */
+  clearExisting: boolean
+  /** 生命值设定；不需要改动的一方可以不传 */
+  lp: AgentBoardLpTarget[]
+  /** 卡片落位列表 */
+  cards: AgentBoardCardPlacement[]
+  /**
+   * 布局合法性问题（卡密查不到、格子序号越界等）。
+   * 空数组代表全部通过；非空时预览卡片会高亮提示，但不阻止用户应用。
+   */
+  warnings: string[]
+}
```

提案的产出方式沿用既有的 `proposals_ready` 模式——`AgentStreamEvent` 新增一个 `board_setup_ready`，`done` 事件与 `AgentSendMessageResult` 都带上可选的 `boardSetup`：

```diff
   /** AI 构思好的决斗推演步骤与角色台词提案已就绪 */
   | { type: 'proposals_ready'; proposals: AgentStepProposal[] }
+  /** AI 复盘出的场面布局已就绪，等待用户确认后写入决斗场 */
+  | { type: 'board_setup_ready'; setup: AgentBoardSetupProposal }
   /** 过程状态提示（自动重试、超时中断、会话重置等非正文信息） */
   | { type: 'status'; message: string }
```

```diff
   /** AI 生成的结构化决斗推演步骤列表，可一键导入对局 */
   proposals?: AgentStepProposal[]
+  /** AI 复盘出的场面布局提案，待用户在预览卡中确认 */
+  boardSetup?: AgentBoardSetupProposal
```

## 第二步：把映射与校验抽成独立的一层 —— **src/shared/engine/boardSetup.ts**（新增）

改动缘由：类型定了，接下来是「怎么把模型填的字符串变成合法数值」。这里做了本改动里一个比较关键的判断：**把映射和校验放在同一层，而不是分开。**

分开放的话，映射就是四张查表，校验散落在调用方的 `if` 里。而校验是这个设计里最要紧的一环——一张牌摆错了要让用户看到原因、其余牌照常落位，这就需要一个统一的「返回 ok=false 加原因」的入口。把它俩放一起，调用方就只需处理一个返回值。

此外 `Type.Boolean` 在本项目的工具 schema 构造器里原本不存在，`clearExisting` 需要它。这里也补上。

```diff
+/**
+ * AI 场面布局提案的区域 / 表示形式映射表
+ *
+ * 模型侧只用字符串枚举（`MZONE` / `FACEUP_DEFENSE`），
+ * 主进程收到后再经这里转成 ocgcore 的数字常量。
+ * 单独抽一层是为了让「模型填错值」在预览阶段就暴露成一条 warning，
+ * 而不是带着垃圾值写进决斗场。
+ */
+
+/** 可落位区域 → CardLocation */
+export const AGENT_BOARD_ZONE_TO_LOCATION: Record<AgentBoardZone, number> = {
+  MZONE: CardLocation.MZONE,
+  SZONE: CardLocation.SZONE,
+  HAND: CardLocation.HAND,
+  GRAVE: CardLocation.GRAVE,
+  DECK: CardLocation.DECK,
+  EXTRA: CardLocation.EXTRA,
+  REMOVED: CardLocation.REMOVED
+}
+
+/** 可落位区域的中文名（预览展示用） */
+export const AGENT_BOARD_ZONE_NAMES: Record<AgentBoardZone, string> = {
+  MZONE: '怪兽区',
+  SZONE: '魔陷区',
+  HAND: '手牌',
+  GRAVE: '墓地',
+  DECK: '主卡组',
+  EXTRA: '额外卡组',
+  REMOVED: '除外区'
+}
+
+/** 表示形式 → CardPosition */
+export const AGENT_BOARD_FACING_TO_POSITION: Record<AgentBoardCardFacing, number> = {
+  FACEUP_ATTACK: CardPosition.FACEUP_ATTACK,
+  FACEUP_DEFENSE: CardPosition.FACEUP_DEFENSE,
+  FACEDOWN: CardPosition.FACEDOWN,
+  FACEUP: CardPosition.FACEUP
+}
```

`isDiscreteAgentZone` 用来区分两类区域：怪兽区与魔陷区是**离散格子**（序号 0~4，一个格子一张牌，同格旧卡被覆盖），手牌与牌堆是**堆叠区**（按已有数量顺序追加）。这个区分同时服务于校验和预览展示。

```diff
+/** 离散格子区域的合法序号上界（含） */
+const DISCRETE_ZONE_MAX_SEQUENCE: Partial<Record<AgentBoardZone, number>> = {
+  MZONE: 4,
+  SZONE: 4
+}
+
+/** 该区域是否为「逐格摆放」的离散区域（其余为按顺序追加的堆叠区） */
+export function isDiscreteAgentZone(zone: AgentBoardZone): boolean {
+  return DISCRETE_ZONE_MAX_SEQUENCE[zone] !== undefined
+}
```

归一化函数是这一层的核心。**注意它对区域名做了 `toUpperCase()`**——模型很可能会输出 `mzone` 或 `Faceup_Attack`，大小写不统一不该被当成非法值拒绝掉，只在完全无法识别时才返回 `ok: false`：

```diff
+export function normalizeAgentBoardPlacement(input: {
+  location?: string
+  sequence?: number
+  position?: string
+}): {
+  ok: boolean
+  zone?: AgentBoardZone
+  sequence?: number
+  facing?: AgentBoardCardFacing
+  reason?: string
+} {
+  const zoneRaw = (input.location ?? '').trim().toUpperCase()
+  if (!zoneRaw) return { ok: false, reason: '缺少区域 location' }
+  if (!(zoneRaw in AGENT_BOARD_ZONE_TO_LOCATION)) {
+    return {
+      ok: false,
+      reason: `无法识别的区域「${input.location}」，可选：${Object.keys(AGENT_BOARD_ZONE_TO_LOCATION).join(' / ')}`
+    }
+  }
+  const zone = zoneRaw as AgentBoardZone
+
+  const maxSeq = DISCRETE_ZONE_MAX_SEQUENCE[zone]
+  const seqRaw = input.sequence
+  const sequence = typeof seqRaw === 'number' && Number.isFinite(seqRaw) ? Math.trunc(seqRaw) : 0
+  if (maxSeq !== undefined && (sequence < 0 || sequence > maxSeq)) {
+    return {
+      ok: false,
+      zone,
+      reason: `${AGENT_BOARD_ZONE_NAMES[zone]}序号越界：${sequence}（合法 0~${maxSeq}）`
+    }
+  }
+
+  let facing: AgentBoardCardFacing | undefined
+  const posRaw = (input.position ?? '').trim().toUpperCase()
+  if (posRaw) {
+    if (!(posRaw in AGENT_BOARD_FACING_TO_POSITION)) {
+      return {
+        ok: false,
+        zone,
+        reason: `无法识别的表示形式「${input.position}」，可选：${Object.keys(AGENT_BOARD_FACING_TO_POSITION).join(' / ')}`
+      }
+    }
+    facing = posRaw as AgentBoardCardFacing
+  }
+
+  return { ok: true, zone, sequence, facing }
+}
```

挂到 shared 的统一出口：

```diff
 export * from './engine/agentModel'
+export * from './engine/boardSetup'
```

## 第三步：写工具，让它只发事件 —— **src/main/services/agentService.ts**

改动缘由：这一步落地工具本体。核心约束是**主进程一行都不碰决斗场**——`useDuelStore` 在渲染层，import 不进来，所以工具想改盘面也改不了。它做的是：查卡库校验卡密、归一化落位参数、把无法落位的项收进 warnings、发出事件。

有几处细节值得单独说：

**`clearExisting` 用 `Type.Boolean` 而不是可选字段。**这是一条语义要求（复盘全新局面必须为 true），做成必填布尔比写进描述里靠模型自觉更可靠。

**卡密查询在主进程做，但只做「校验」不做「补全」。**提案载荷里只留 8 位卡密，`CdbCard`（卡名、攻防、描述、setcode 列表）由渲染层自己去取。

**工具返回给模型的文案要明确说「盘面还没动」。**否则模型会在正文里写「已为你摆好场面」，而实际上用户还没点确认。这个提示不能省。

**`collectedBoardSetup` 随 `sendMessage` 重置，并纳入「无内容/无结论」判定。**否则上一轮的布局提案会残留到下一轮，且当模型只提交布局没写正文时会被误判成「什么都没输出」。

```diff
   /**
-   * 工具 5：调用无头规则引擎校验战术 (validate_with_ocgcore)
+   * 工具 5：复盘场面布局 (propose_board_setup)
+   * 当用户口述了一个具体局面（LP、怪兽区/魔陷区配置、手牌）并要求「摆到决斗场上」时调用。
+   * 只产出**待确认的布局提案**，不直接改盘面 —— 由渲染层弹出预览卡，用户确认后才写入。
+   */
+  const proposeBoardSetupTool = defineTool({
+    name: 'propose_board_setup',
+    label: '复盘场面布局',
+    description:
+      '当用户口述了一个完整局面并要求把它摆到决斗场上时调用，提交一份待确认的布局（双方 LP + 每张牌的区域/格子/表示形式）。只提交提案，不会直接改动盘面，创作者确认后才会生效。复盘全新局面时 clearExisting 必须为 true。',
+    parameters: Type.Object({
+      summary: Type.String({ description: '这个局面的摘要，说明是什么场合、双方各剩什么' }),
+      clearExisting: Type.Boolean({
+        description:
+          '是否先清空现有盘面再摆。复盘一个全新局面必须为 true，否则会在原有卡片上叠加摆放'
+      }),
```

落位参数的 schema 描述是这次改动里被反复打磨的部分，每一条描述都对应一个实际踩到的坑。`sequence` 那条尤其重要——原先写的是「格子序号 0~4（从左到右）」，后来发现**对方场地是镜像渲染的**，详见第八步。

```diff
+        cards: Type.Array(
+          Type.Object({
+            code: Type.Number({ description: '8 位卡密' }),
+            cardName: Type.Optional({ description: '卡名，仅用于人工核对' }),
+            side: Type.Number({ description: '阵营：0 = 我方，1 = 对方' }),
+            location: Type.String({
+              description:
+                '区域: MZONE 怪兽区 / SZONE 魔陷区 / HAND 手牌 / GRAVE 墓地 / DECK 主卡组 / EXTRA 额外卡组 / REMOVED 除外区'
+            }),
+            sequence: Type.Number({
+              description:
+                '格子序号 0~4，恒定按**该方自己视角的左边起数**：seq0 = 该方最左格。对方的格子在屏幕上左右镜像（对方的 seq0 显示在屏幕最右边），但序号本身不变。手牌等堆叠区统一传 0，按顺序追加'
+            }),
+            position: Type.Optional({
+              description:
+                '表示形式: FACEUP_ATTACK 表侧攻击 / FACEUP_DEFENSE 表侧守备 / FACEDOWN 里侧盖放 / FACEUP 表侧表示。缺省时怪兽区按表攻、魔陷区与手牌按盖放'
+            }),
+            duelistName: Type.Optional({
+              description:
+                '目标决斗者名（如「韩诺」）；手牌必填，否则多人模式下会挂错人。可先用 get_current_board 查当前决斗者名单'
+            }),
+            isUnknown: Type.Optional({
+              description:
+                '仅当用户描述了一张「不知道是什么的盖卡」时为 true（如「魔陷区有一张盖卡」）。此时 code 传 0，格子会显示为无卡名的卡背。不要给已知卡设 true'
+            }),
+            customAtk: Type.Optional({
+              description:
+                '覆盖显示攻击力。动态攻防必须填（如「特拉戈迪亚攻击力上升手牌数量 X600，手牌 6 张 → 3600」），因为卡库里该卡atk 是 ?，不填显示不出真实数值'
+            }),
+            customDef: Type.Optional({ description: '覆盖显示守备力' })
+          }),
+          { description: '卡片落位列表' }
+        )
+      }),
```

execute 里对未知盖卡单独分支处理，不进卡库校验；已知卡走「查卡库 → 归一化 → 收进 placements」；任何一环不过就往 `warnings` 推一条继续往下，不中断整批：

```diff
+        const warnings: string[] = []
+        const rawCards = p.cards ?? []
+        const codes = rawCards
+          .filter((c) => !c.isUnknown)
+          .map((c) => c.code)
+          .filter((c) => Number.isFinite(c) && c > 0)
+        const dict = codes.length > 0 ? cdbService.getCardsByIds(codes) : {}
+
+        const placements: AgentBoardCardPlacement[] = []
+        rawCards.forEach((c, idx) => {
+          // 未知盖卡：用户说了「有一张盖卡」但没说是哪张。这类卡不查卡库，
+          // code 记 0 表示「有卡但无卡面数据」，由渲染层显示卡背。
+          if (c.isUnknown) {
+            const norm = normalizeAgentBoardPlacement({
+              location: c.location,
+              sequence: c.sequence,
+              position: c.position
+            })
+            if (!norm.ok || !norm.zone) {
+              warnings.push(`第 ${idx + 1} 张未知盖卡：${norm.reason ?? '落位参数无效'}，已跳过`)
+              return
+            }
+            placements.push({
+              code: 0,
+              cardName: c.cardName?.trim() || '未知盖卡',
+              side: c.side === 1 ? 1 : 0,
+              location: norm.zone,
+              sequence: norm.sequence ?? 0,
+              position: norm.facing ?? 'FACEDOWN',
+              isUnknown: true,
+              duelistName: c.duelistName?.trim() || undefined,
+              customAtk: Number.isFinite(c.customAtk as number) ? c.customAtk : undefined,
+              customDef: Number.isFinite(c.customDef as number) ? c.customDef : undefined
+            })
+            return
+          }
+
+          const label = c.cardName || dict[c.code]?.name || `卡密 ${c.code}`
+          if (!Number.isFinite(c.code) || c.code <= 0 || !dict[c.code]) {
+            warnings.push(`第 ${idx + 1} 张【${label}】的卡密 ${c.code} 在卡库中不存在，已跳过`)
+            return
+          }
```

返回给模型的文本要明确「盘面尚未改动」，避免模型在正文里宣称已经摆好：

```diff
+        const lines: string[] = [
+          `布局提案已提交，等待创作者在预览卡中确认：${placements.length} 张卡、${lpTargets.length} 项生命值。`,
+          '此时盘面尚未改动。请在正文中用一两句话说明这个布局要怎么用，不要重复罗列每张卡。'
+        ]
+        if (warnings.length > 0) {
+          lines.push(`已自动剔除 ${warnings.length} 处无效落位：`)
+          lines.push(...warnings.map((w) => `- ${w}`))
+        }
```

配套的会话状态与工具注册：

```diff
+  /** 本轮已提交的场面布局提案（同一轮内后写的覆盖先写的，与步骤提案同生命周期） */
+  private collectedBoardSetup: AgentBoardSetupProposal | null = null
```

```diff
       this.currentBoardState = params.boardState || null
       this.collectedProposals = []
+      this.collectedBoardSetup = null
```

```diff
       const session = await this.acquireSession(cfg, [
         searchCardsTool,
         getCardInfoTool,
         getCurrentBoardTool,
         proposeStepsTool,
+        proposeBoardSetupTool,
         validateWithOcgcoreTool
       ])
```

## 第四步：让模型知道该填什么 —— **src/main/services/agentService.ts**

改动缘由：工具契约写好了还不够。`sequence` 该数哪个格子、`customAtk` 什么时候必须填、手牌为什么要写名字——这些是**领域知识，不是工具签名能表达的**。不写进系统提示词，模型要么猜、要么不填。

这几条规则每一条都对应一个实际会导致摆错的地方，所以写成硬约束而不是引导语。仍然沿用本项目既定的短 bullet 风格。

```diff
   return `你是一个专业的《游戏王》卡牌决斗剧情创作者，你能调用工具查真实卡片数据、读取当前盘面、把场面布局与推演步骤交给创作者。

   规则：
   - 直接给结论，不要先写「我先查一下」「让我看看」这类过程说明。
   - 需要查多张卡时，把卡密一次性传给 get_card_info；同一个工具不要重复调用同一个目标。
   - 查不到或工具报错时，基于已有信息作答并说明不确定处，不要因此中止或只给免责声明。
   - 不要使用 emoji、表情符号和颜文字。
+  - 用户口述了一个具体局面（生命值、场上怪兽与表示形式、手牌）并要求「摆到决斗场 / 复盘这个场面」时，调用 propose_board_setup 提交布局：
+    - 复盘全新局面必须 clearExisting: true，否则会叠加在原有卡片上。
+    - 动态攻防必须填 customAtk / customDef。卡库里这类卡的攻防是 ?，不填就显示不出真实数值。
+    - 手牌必须填 duelistName，否则多人模式下会挂到错的决斗者名下；名字先用 get_current_board 查。
+    - sequence 是该方自己视角的左边起数（seq0 = 该方最左格）。对方场地左右镜像，但序号不变。
+    - 用户只说「有一张盖卡」而没说是哪张时，code 传 0 并填 isUnknown: true，不要瞎猜卡名。
   - 战术推演完成后，调用 propose_duel_steps 把步骤交给创作者。${
```

`get_current_board` 也要跟着改。原来它只输出 LP 和卡片列表，**完全没有 duelists**——这意味着提示词里「手牌必须填 duelistName」这条要求，模型根本无从知道「韩诺」存不存在，只能瞎填。这是个典型的「要求模型填某个字段，却没给它取值来源」的错。

```diff
         lines.push(`先攻回合方: ${state.turnPlayer === 0 ? '我方(P0)' : '对方(P1)'}`)
+
+        // 决斗者名单：布局提案要按名字把手牌归到具体人，主进程这边不写盘面，
+        // 所以这是模型唯一能拿到「韩诺」这类名字的途径。
+        const duelists = state.duelists || []
+        if (duelists.length > 0) {
+          lines.push(
+            `决斗者名单: ${duelists
+              .map((d) => `${d.name}(${d.team === 0 ? '我方' : '对方'} LP ${d.lp})`)
+              .join('、')}`
+          )
+        }
```

`Type` 构造器补 `Boolean`（`clearExisting` 需要）：

```diff
-   * 提供常用类型（Object, String, Number, Array, Optional）的便捷创建方法
+   * 提供常用类型（Object, String, Number, Boolean, Array, Optional）的便捷创建方法
```

## 第五步：渲染层补全卡面 —— **src/renderer/src/stores/useAgentStore.ts**

改动缘由：这一步解决「载荷只带卡密，但 store 要的是完整 CdbCard」这个落差。

为什么不把 `CdbCard` 放进事件载荷？`CdbCard` 是个胖对象——卡名、攻防、完整效果描述、setcode 列表。十几张卡就是几十 KB 的 IPC 传输，而这些数据在主进程那边**一个字段都用不到**，它只在写盘那一刻才有意义。所以载荷里只留 8 位卡密，渲染层拿到后自己调 `window.api.getCardsByIds` 补全——这条通道本来就存在（右侧卡片检索面板在用），直接复用，不新增 IPC。

`defaultFacingForZone` 处理模型没填表示形式的情况。**这里的取值必须与 `useDuelStore.addCardToZone` 的区域惯例完全一致**，否则同一次布局里「显式填了的卡」和「没填的卡」表现规则会打架。

```diff
+/**
+ * 模型没给表示形式时的区域惯例。
+ *
+ * 与 `useDuelStore.addCardToZone` 的默认值保持一致，避免同一次布局里
+ * 「显式填了的卡」和「没填的卡」表现规则不一致。
+ */
+function defaultFacingForZone(zone: AgentBoardCardPlacement['location']): number {
+  switch (zone) {
+    case 'SZONE':
+    case 'HAND':
+    case 'DECK':
+    case 'EXTRA':
+      return AGENT_BOARD_FACING_TO_POSITION.FACEDOWN
+    case 'GRAVE':
+    case 'REMOVED':
+      return AGENT_BOARD_FACING_TO_POSITION.FACEUP
+    default:
+      return AGENT_BOARD_FACING_TO_POSITION.FACEUP_ATTACK
+  }
+}
```

事件处理与消息状态：

```diff
+  /** AI 复盘出的场面布局提案，待用户在预览卡中确认后才写入决斗场 */
+  boardSetup?: AgentBoardSetupProposal
+  /** 该条布局提案是否已被用户确认应用 */
+  boardSetupApplied?: boolean
```

```diff
+        } else if (event.type === 'board_setup_ready') {
+          set({
+            messages: messages.map((m) =>
+              m.id === lastMsg.id ? { ...m, boardSetup: event.setup, boardSetupApplied: false } : m
+            )
+          })
         } else if (event.type === 'done') {
```

`applyBoardSetup` 里未知盖卡单独构造一个 `code: 0` 的空壳，不走 `getCardsByIds`（查了也查不到）。**卡密列表要先 `filter(p => !p.isUnknown)`**——否则会往 SQL 里塞一个查不到的 0，属于无意义查询。

```diff
+  applyBoardSetup: async (setup) => {
+    const placements: AgentBoardCardPlacement[] = setup.cards ?? []
+    if (placements.length === 0 && (setup.lp ?? []).length === 0) {
+      return { ok: false, error: '该布局提案没有任何可落位的内容' }
+    }
+
+    let dict: Record<number, CdbCard> = {}
+    const knownCodes = placements.filter((p) => !p.isUnknown).map((p) => p.code)
+    if (knownCodes.length > 0) {
+      try {
+        dict = await window.api.getCardsByIds(knownCodes)
+      } catch (err) {
+        console.error('[useAgentStore] applyBoardSetup 解析卡密失败:', err)
+        return { ok: false, error: '卡库查询失败，未能读取卡片数据' }
+      }
+    }
+
+    const resolved = placements
+      .map((p) => {
+        // 未知盖卡：没有卡面数据，构造一个只有 code:0 的空壳交给 store，
+        // 渲染层会按卡背显示。不走 getCardsByIds（查了也查不到）。
+        if (p.isUnknown) {
+          return {
+            card: { id: 0, name: p.cardName || '未知盖卡' } as CdbCard,
+            controller: p.side,
+            location: AGENT_BOARD_ZONE_TO_LOCATION[p.location],
+            sequence: p.sequence ?? 0,
+            position: p.position
+              ? AGENT_BOARD_FACING_TO_POSITION[p.position]
+              : defaultFacingForZone(p.location),
+            duelistName: p.duelistName
+          }
+        }
+        const card = dict[p.code]
+        if (!card) return null
```

`markBoardSetupApplied` 与 `dismissBoardSetup` 是纯 UI 态：前者把按钮切成「已应用」并锁定，后者让用户能放弃这份提案。这两个状态放在 agent store 而不是面板 local state，是因为它们要跟消息绑在一起——消息列表重新渲染时得保住。

## 第六步：store 里一次落盘 —— **src/renderer/src/stores/useDuelStore.ts**

改动缘由：`addCardToZone` 已经能放牌了，但没有复用它，而是新写 `applyBoardSetup`。三个理由：

**一是 temporal 撤销。**`useDuelStore` 包了 `zundo`，每次 `set` 都是一条撤销历史。循环调十二次 `addCardToZone` 就是十二条历史，用户按 Ctrl+Z 要按十二次才回到应用前。布局天然是一次性动作，就该用一次 `set`。

**二是堆叠区序号。**手牌是堆叠区，序号按「当前已有几张」算。`addCardToZone` 每次都从 `prev.state.cards` 重新 filter 一次；循环调用理论上没错，但一旦中间有并发或顺序问题就极难排查。一次算完最稳——边遍历边累积进 `workingCards`，后面的卡自然接上。

**三是清盘必须重置 `initialBoardSnapshot`。**这是最容易漏的坑。这个字段是「上一步 / 下一步」复位的基线，只清 `cards` 不动它的话，用户点复位会回到 AI 落位**之前**的旧场面，卡片凭空消失。

生命值这里有个细节：多人模式下 `players[]` 和 `duelists[]` 是两套数据。先按阵营算（共享 LP 或该阵营仅一位时全阵营同步），再让逐个指定 `duelistName` 的条目覆盖回去。顺序不能反，否则「韩诺 1000」会被阵营级的 8000 冲掉。

```diff
+  /**
+   * 整体写入一份场面布局（AI 复盘 / 批量导入共用）
+   *
+   * 与逐条调用 `addCardToZone` 的区别是**单次 set**：布局天然是一次性动作，
+   * 逐条调用会让中途状态被 temporal 记录成一串撤销步骤，且堆叠区序号要在
+   * 同一次计算里连续分配。这里先算好所有卡再一次性落盘。
+   *
+   * @param params.lp 生命值设定；`duelistName` 命中该阵营决斗者时只改那一位
+   * @param params.cards 已解析出 CdbCard 的落位列表，顺序即堆叠区顺序
+   * @param params.clearExisting 是否先清空盘面
+   */
+  applyBoardSetup: (params: {
+    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
+    cards: Array<{
+      card: CdbCard
+      controller: 0 | 1
+      location: number
+      sequence: number
+      position: number
+      duelistName?: string
+      duelistId?: string
+      customAtk?: number
+      customDef?: number
+    }>
+    clearExisting: boolean
+  }) => void
```

生命值的两段式处理：

```diff
+          // 生命值：指定了决斗者名就只改那一位；共享 LP 或该阵营仅一位时全阵营同步
+          const sharedLp = Boolean(prev.state.matchConfig?.sharedLp)
+          const nextLpBySide = new Map<0 | 1, number>()
+          lp.forEach((t) => {
+            const v = Math.max(0, Math.trunc(t.lp))
+            nextLpBySide.set(t.side, v)
+          })
+          const duelists = baseDuelists.map((d) => {
+            if (!nextLpBySide.has(d.team)) return d
+            const v = nextLpBySide.get(d.team)!
+            const sameTeam = baseDuelists.filter((x) => x.team === d.team)
+            return sharedLp || sameTeam.length <= 1 ? { ...d, lp: v } : d
+          })
+          // 逐个决斗者单独指定时覆盖上一轮按阵营算出的值
+          lp.forEach((t) => {
+            if (!t.duelistName) return
+            const idx = duelists.findIndex((d) => d.name === t.duelistName)
+            if (idx >= 0) {
+              duelists[idx] = { ...duelists[idx], lp: Math.max(0, Math.trunc(t.lp)) }
+            }
+          })
```

落位主循环。堆叠区按已有数量追加序号，离散格子按同格覆盖——后者与 `addCardToZone` 的既有行为保持一致：

```diff
+            if (isPileZone) {
+              const pileSize = workingCards.filter(
+                (x) =>
+                  x.controller === c.controller &&
+                  x.location === location &&
+                  (!isOwnerScopedZone || x.duelistId === newCard.duelistId)
+              ).length
+              newCard.sequence = pileSize
+              workingCards.push(newCard)
+            } else {
+              // 离散格子：同格旧卡被覆盖（与 addCardToZone 行为一致）
+              workingCards = workingCards.filter(
+                (x) =>
+                  !(
+                    x.controller === c.controller &&
+                    x.location === location &&
+                    x.sequence === c.sequence
+                  )
+              )
+              newCard.sequence = c.sequence
+              workingCards.push(newCard)
+            }
```

`customAtk` / `customDef` 直接写进 `FieldCard`，不走 `setCardCustomStats`——因为卡是这一轮刚建的，没有 `instanceId` 可供后续调用。**这一步就是让「特拉戈迪亚 3600」能显示出来的关键**：卡库里那张卡的 atk 是 -1（问号），不覆盖就永远显示不出真实数值。

找不到决斗者名时回落到阵营首位并 `console.warn`，不静默丢弃——挂错人比不挂好排查：

```diff
+          if (unresolvedDuelists.length > 0) {
+            console.warn(
+              '[useDuelStore] applyBoardSetup 未找到决斗者，已回落到阵营首位:',
+              unresolvedDuelists.join(', ')
+            )
+          }
```

清盘时同步重建初始快照：

```diff
+              // 布局即新的开局基线：清空盘面时必须把初始快照也清掉，
+              // 否则「上一步 / 下一步」复位会回到 AI 落位前的旧场面。
+              initialBoardSnapshot: clearExisting
+                ? createLightweightSnapshot(workingCards)
+                : prev.state.initialBoardSnapshot
```

## 第七步：给用户一个能看清再点的预览 —— **src/renderer/src/components/BehindSpirit/BoardSetupPreviewCard.tsx**（新增）、**src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx**

改动缘由：写盘是破坏性的，所以确认前必须让人看清**将要发生什么**。预览卡给三样信息：卡面缩略图（不用回卡库核对）、区域 + 格子序号 + 表示形式（一眼看出「这张应该攻击表示怎么是盖放」）、以及攻守覆盖值（紫色徽章，标明 3600 是手动填的而非卡面读出的）。

`clearExisting` 时顶部那条琥珀色警告是刻意加的——用户点下去之前必须知道这会清空盘面和步骤基线。

预览卡本身是纯受控组件：所有状态由面板传入，交互全部通过 `onApply` / `onDismiss` 回调上抛，不自己发请求也不直接碰 store。

```diff
+  return (
+    <div className="rounded-lg border border-border bg-background/60 p-2.5 space-y-2.5">
+      <div className="flex items-center justify-between gap-1">
+        <span className="font-bold text-foreground flex items-center gap-1 min-w-0">
+          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
+          <span className="truncate">待确认场面布局</span>
+        </span>
+        <div className="flex items-center gap-1 shrink-0">
+          {setup.clearExisting && !applied && (
+            <Button
+              size="xs"
+              variant="ghost"
+              onClick={onDismiss}
+              disabled={applying}
+              title="放弃该布局，不改动决斗场"
+              className="h-6 px-1.5 text-[10px] gap-1"
+            >
+              <X className="w-3 h-3" />
+              <span>放弃</span>
+            </Button>
+          )}
```

「放弃」只在 `clearExisting` 时出现——不破坏盘面的提案，忽略它和点它没有区别，没必要占一个按钮位：

```diff
+          <Button
+            size="xs"
+            onClick={onApply}
+            disabled={applied || applying}
+            className="h-6 px-1.5 text-[10px] gap-1 font-bold"
+          >
+            {applying ? (
+              <>
+                <Loader2 className="w-3 h-3 animate-spin" />
+                <span>应用中</span>
+              </>
+            ) : applied ? (
+              <>
+                <Check className="w-3 h-3" />
+                <span>已应用</span>
+              </>
+            ) : (
+              <>
+                <Eraser className="w-3 h-3" />
+                <span>{setup.clearExisting ? '清空并重建盘面' : '应用到决斗场'}</span>
+              </>
+            )}
+          </Button>
```

warnings 高亮列出被跳过的落位。**不阻止应用**——摆对九张、错一张，比整批推倒重来强：

```diff
+      {setup.warnings.length > 0 && (
+        <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 space-y-0.5">
+          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
+            <AlertTriangle className="w-3 h-3" />
+            <span>已跳过 {setup.warnings.length} 处无效落位</span>
+          </div>
```

单行落位展示。`getCardImageUrl(0)` 天然回落到 `CARD_BACK_IMAGE`，所以未知盖卡不需要额外分支，缩略图直接就是卡背：

```diff
+      <img
+        src={getCardImageUrl(placement.code, true)}
+        alt={placement.cardName ?? String(placement.code)}
+        className="w-6 h-8 object-cover rounded-sm shrink-0 bg-black/10"
+        onError={(e) => {
+          e.currentTarget.src = CARD_BACK_IMAGE
+        }}
+      />
```

面板侧的接入。`applyingSetupMsgId` 只记一个 id 而不是数组——同一时刻只可能有一个提案在被应用，不需要列表：

```diff
+  // 场面布局提案的应用过程：同一时刻只可能有一个提案在应用/报错
+  const [applyingSetupMsgId, setApplyingSetupMsgId] = useState<string | null>(null)
+  const [setupError, setSetupError] = useState<{ msgId: string; text: string } | null>(null)
```

```diff
+  const handleApplySetup = async (messageId: string): Promise<void> => {
+    const msg = useAgentStore.getState().messages.find((m) => m.id === messageId)
+    if (!msg?.boardSetup) return
+    setApplyingSetupMsgId(messageId)
+    setSetupError(null)
+    const res = await applyBoardSetup(msg.boardSetup)
+    setApplyingSetupMsgId(null)
+    if (res.ok) {
+      markBoardSetupApplied(messageId)
+    } else {
+      setSetupError({ msgId: messageId, text: res.error ?? '应用失败' })
+    }
+  }
```

## 第八步：复核——三个会让场面摆错的真实缺口

改动缘由：写完不等于对。回头拿最初那个请求逐条对照渲染层代码，发现三处会**真的摆错**，而且都不是靠推断能发现的，是逐行读 `DuelBoard.tsx` 才看出来的。

**一、对方场地是镜像的，`sequence` 语义原先写错了。**

`DuelBoard.tsx` 里对方怪兽区是 `[4, 3, 2, 1, 0].map(...)`——seq0 渲染在**屏幕最右边**；我方才区是 `[0, 1, 2, 3, 4]`。原先描述写的「从左到右」会让对方那五张怪的顺序整体左右颠倒。已改为按「该方自己视角」计：

```diff
+            sequence: Type.Number({
+              description:
+                '格子序号 0~4，恒定按**该方自己视角的左边起数**：seq0 = 该方最左格。对方的格子在屏幕上左右镜像（对方的 seq0 显示在屏幕最右边），但序号本身不变。手牌等堆叠区统一传 0，按顺序追加'
+            }),
```

**这一条是本次改动里最值得记的教训**：写工具 schema 时，参数的语义必须回到渲染层逐行核实，不能按字面直觉写。「从左到右」这种听起来毫无歧义的描述，在镜像布局里就是错的——对称性假设是文档里最容易被略过的一环。

**二、模型拿不到「韩诺」这个名字。**

第四步已经提过：`get_current_board` 原本完全没有 duelists 输出，提示词却要求「手牌必须填 duelistName」。**要求模型填某个字段之前，必须确认模型能从现有工具里拿到该字段的取值**，否则这条要求等于让它编造。这个错比缺字段更隐蔽——字段缺失会报错，编造的值则会让六张牌悄悄挂到别人名下。

**三、未知盖卡会整张丢掉。**

原先 `code` 是必填 Number 且必须命中卡库，用户那句「魔法陷阱区域里有一张盖卡」没有卡名，这张会被校验拦掉、整个记进 warnings 跳过——用户的场景**会少一张牌**。这也是第一步为什么要在类型里就留 `isUnknown` 出口。

`get_current_board` 的卡片列表也要能显示未知盖卡，否则读回来是一串 `卡密:0`：

```diff
-          const name = c.card?.name || `卡密:${c.code}`
+          const name = c.card?.name || (c.code > 0 ? `卡密:${c.code}` : '未知盖卡')
```

## 第九步：修掉一个比缺失更危险的东西 —— **src/main/services/agentService.ts**

改动缘由：最后回头修 `validate_with_ocgcore`。它原先只要 `getCore()` 不抛错，就固定返回：

> ocgcore 规则引擎 (v1.2.3) 模拟通过：战术操作在官方规则物理体系下合规。

但 `ocgcoreService` **从来没接受过任何局面输入**，它只调了 `getVersion()`。也就是说这句「模拟通过」是凭空来的，而模型会把它当既成事实写进结论，然后基于一个假前提往下推。**返回固定成功文案的工具，比没有这个工具更危险。**

改成如实告知「就绪但没做校验」，并把工具描述也改掉——描述决定了模型会不会把它当依据：

```diff
+    /**
+     * 工具 6：调用无头规则引擎校验战术 (validate_with_ocgcore)
+     * 接入官方 ocgcore 规则引擎 (WebAssembly 沙箱)。
+     *
+     * **当前只做引擎可用性自检**：ocgcoreService 尚未接受局面输入，
+     * 拿不到任何卡与连锁状态，因此不存在真实的战术模拟。
+     * 措辞上必须如实告知模型「无法校验」，绝不能返回「模拟通过」——
+     * 那会让模型把一句空话当成合法性依据写进结论。
+     */
     const validateWithOcgcoreTool = defineTool({
       name: 'validate_with_ocgcore',
       label: '调用无头规则引擎校验战术',
-      description: '调用官方 ocgcore 引擎对战术合法性进行沙箱模拟与时点排雷',
+      description:
+        '可选。检测官方 ocgcore 引擎是否就绪。注意：当前引擎未接入局面输入，只能确认引擎可用性、**无法真正校验战术合法性**。因此不要把它当作合法性结论的依据，仍需基于已查证的卡片数据自行推演；引擎不可用时更不要因此回避作答',
```

```diff
-          const resultMsg = `ocgcore 规则引擎 (v${maj}.${min}) 模拟通过：战术操作在官方规则物理体系下合规。`
+          const resultMsg = `ocgcore 规则引擎 (v${maj}.${min}) 已就绪，但引擎当前未接入局面输入，**本次没有对任何战术做合法性校验**。请不要把这当作「战术合规」的证据，仍需基于已查证的卡片数据自行推演时点与连锁合法性。`
```

`details` 里加 `validated: false` 明确标记这次没做校验，UI 上的 resultSummary 同步改成「未做战术校验」。

---

## 验证过程中发现并修掉的两个小问题

**一、`validate_with_ocgcore` 顶部残留了一段重复注释块。**改那个工具描述时，旧的 JSDoc 没删干净，新旧两段叠在一起。TypeScript 和 ESLint 都不会报错（注释不影响编译），但属于明显的代码卫生问题。已删除旧的那段。

**二、`getCardsByIds` 会收到未知盖卡的 `code: 0`。**`applyBoardSetup` 里查卡密时用了 `placements.map(p => p.code)`，把 `0` 也一起丢进了 `IN (0, ...)`。`getCardsByIds` 查不到就返回空对象所以不会崩，属于无意义查询。已改成先 `filter(p => !p.isUnknown)`。

这一类问题的共同特征是**能跑、不报错、但不对**。所以每次重读自己的代码都会专门找这类地方。

---

## 核心经验

**给 Agent 补写能力时，别让工具直接改状态。**工具只负责产出一份可审阅的提案加校验结果，状态变更由渲染层在用户确认后执行。配套三件事：① 提案 schema 用人类可读的字符串枚举，映射层单独抽出来，让「模型填错」在预览阶段就暴露成一条 warning；② 非法参数降级成 warning 而不是抛异常，让用户看到「哪张没摆上、为什么」；③ 状态写入走 store 的单次 `set`，不要在外层循环调既有的单条 action。

**判断「AI 能不能做 X」不能只看工具有没有，要沿工具 schema → 事件载荷 → store action 三层确认写路径是否闭环。**本项目五个工具全部止步于「生成结构化文案」，缺的是一个真正写 `useDuelStore` 的工具。

**工具的参数语义必须回到渲染层逐行核实。**「sequence 从左到右」在镜像布局里就是错的。对称性假设是文档里最容易被略过的一环。

**要求模型填某个字段之前，先确认模型能从现有工具里拿到该字段的取值。**字段缺失会报错，编造的值则会让操作悄悄作用到错误的对象上。

**返回固定成功文案的工具，比没有这个工具更危险。**模型会把它当既成事实。

**写完代码要拿最初的诉求逐条回查。**本次三个真实缺口——镜像布局的序号语义、模型拿不到决斗者名、未知盖卡被丢弃——全部是逐行读 `DuelBoard.tsx` 和 `get_current_board` 的输出内容才发现的，靠推断发现不了。

## 已知限制

`customAtk` 是一次性写死的覆盖值，不随手牌张数联动。特拉戈迪亚攻击力 = 手牌数 × 600 这类动态效果，模型提交 3600 后如果用户又手动加了牌，显示值不会跟着变。做到自动联动需要知道每张卡的动态效果和触发时点，成本远大于本次收益。

---

## 改动文件一览

| 文件 | 角色 |
| --- | --- |
| **src/shared/types/ipc.ts** | 布局提案的数据形状（`AgentBoardCardPlacement` / `AgentBoardSetupProposal` 等）、`board_setup_ready` 事件、未知盖卡的 `isUnknown` 出口 |
| **src/shared/engine/boardSetup.ts** | 区域与表示形式的双向映射、离散格子与堆叠区的区分、大小写不敏感且带原因返回的归一化校验 |
| **src/shared/index.ts** | 挂载 boardSetup 引擎模块 |
| **src/main/services/agentService.ts** | 新增 `propose_board_setup` 工具（只发事件不碰盘面）、`Type.Boolean`、系统提示词补布局规则、`get_current_board` 输出决斗者名单与未知盖卡、`collectedBoardSetup` 生命周期、`validate_with_ocgcore` 去掉假校验 |
| **src/renderer/src/stores/useAgentStore.ts** | 事件订阅与消息状态、卡密补全与未知盖卡空壳、`defaultFacingForZone` 区域惯例、应用态与放弃动作 |
| **src/renderer/src/stores/useDuelStore.ts** | `applyBoardSetup` 单次 set 落盘、两段式生命值赋值、堆叠区序号一次算完、清盘时重建初始快照 |
| **src/renderer/src/components/BehindSpirit/BoardSetupPreviewCard.tsx** | 待确认布局的只读预览：卡面缩略图、区域与表示形式、攻守覆盖徽章、warnings 高亮、放弃与应用按钮 |
| **src/renderer/src/components/BehindSpirit/BehindSpiritPanel.tsx** | 预览卡挂载、应用态与失败提示 |
