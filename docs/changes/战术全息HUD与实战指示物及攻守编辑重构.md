# 战术全息HUD与实战指示物及攻守编辑重构

本改动属于一次独立的原子化功能演进，聚焦于对局编排与残局创作场景下的实战状态感知与快捷编辑能力：

- 严格还原游戏实战质感，构建 YGOPro 风格的半透明战场全息 HUD；
- 引入「Tab 键全局战术透视」与「鼠标即滑即显」双重感知机制，彻底解决“全屏一直显示太乱、逐个悬停查看太累”的交互矛盾；
- 在左侧详情栏集成专属于场上选中卡片的「实战属性与指示物检查器」，支持直观修改攻守数值与挂载/拔除全量指示物；
- 实现 ocgcore 标准下的 `c:add_counter` 脚本双向生成与逆向解析闭环。

---

## 思考与改动明细（按开发推导顺序）

### 1. 标准指示物字典建设与常量映射

- **改动文件**：**src/shared/constants/counters.ts**、**src/shared/index.ts**
- **开发思考与缘由**：
  游戏王 ocgcore 原生引擎中，各类指示物均有专属的 16 进制代码（如魔力指示物 `0x1`、捕食指示物 `0x1041`、武士道指示物 `0x3` 等）。
  为了避免在业务代码中散落魔法数字，从官方 `strings.conf` 提炼建立全量 114 类指示物映射表，并梳理出「常用高频指示物」列表，供下拉选择器置顶优先推荐。

**src/shared/constants/counters.ts**

```ts
export interface CounterDefinition {
  id: number
  hex: string
  name: string
}

export const COUNTER_DEFINITIONS: CounterDefinition[] = [
  { id: 1, hex: '0x1', name: '魔力指示物' },
  { id: 4161, hex: '0x1041', name: '捕食指示物' }
  // ... 全量 114 类指示物
]

export const COUNTER_MAP: Record<number, string> = Object.fromEntries(
  COUNTER_DEFINITIONS.map((c) => [c.id, c.name])
)

export const COMMON_COUNTER_IDS = [
  0x1, // 魔力指示物
  0x1041, // 捕食指示物
  0x1002, // 楔指示物
  0x3, // 武士道指示物
  0x1009, // 毒指示物
  0x100e, // A指示物
  0x1015, // 冰指示物
  0x1019, // 雾指示物
  0x1b, // 时计指示物
  0x104c, // 信号指示物
  0x1055, // 歪曲指示物
  0x1001 // 通用指示物
]
```

---

### 2. 状态机扩展（战术透视全息视图与实战属性/指示物操作）

- **改动文件**：**src/renderer/src/stores/useDuelStore.ts**
- **开发思考与缘由**：
  为满足响应式透视与实战数据调控需求：
  - 在 Store 顶层增加 `tacticalView` 布尔状态（由于 `zundo` 的 `partialize` 只追踪 `state.state`，顶层 UI 开关不污染对局撤销/重做历史）；
  - 增加 `setCardCounter`、`removeCardCounter`、`clearCardCounters`、`setCardCustomStats` 等动作，严格在 `state.state.cards` 内部执行函数式变更，天然享受完整的 `Ctrl+Z` 历史撤销保障。

**src/renderer/src/stores/useDuelStore.ts**

```diff
   // 选中与悬停交互
   selectedCardId: string | null
   hoveredCard: CdbCard | null
   hoveredInstanceId: string | null
+  tacticalView: boolean

+  // 实战属性与指示物操作
+  setCardCounter: (instanceId: string, counterType: number, count: number) => void
+  removeCardCounter: (instanceId: string, counterType: number) => void
+  clearCardCounters: (instanceId: string) => void
+  setCardCustomStats: (instanceId: string, customAtk?: number, customDef?: number) => void
+
+  toggleTacticalView: () => void
+  setTacticalView: (enabled: boolean) => void
```

---

### 3. YGOPro 经典质感战术全息 HUD（CardHudOverlay）与悬停/透视双重激活

- **改动文件**：**src/renderer/src/components/Board/components/CardHudOverlay.tsx**、**src/renderer/src/components/Board/CardItem.tsx**
- **开发思考与缘由**：
  为兼顾战场画面的纯粹美感与编排时的高效感知：
  - 彻底摒弃杂乱的花哨 AI 色块标签，采用高对比度的半透明亚克力深黑质感（`bg-black/85 backdrop-blur-xs border border-white/20 shadow-2xl`），文字清晰锐利；
  - 内部严格展现官方全称明细：卡名、攻守数值（变动自动呈现绿色上升与红色下降差值）、星阶/种族/属性以及全称指示物列表（如 `[魔力指示物]: 2`）；
  - 浮层具备 `pointer-events-none` 穿透防护，完全不抢鼠标焦点，不干扰拖拽与选卡；
  - 触发判定：只有真正存在指示物或自定义攻守变动的卡片才会在透视模式或鼠标悬停时激活浮层，其余 90% 正常卡片保持 100% 干净，杜绝视觉垃圾。

**src/renderer/src/components/Board/components/CardHudOverlay.tsx**

```tsx
export const CardHudOverlay: React.FC<CardHudOverlayProps> = ({ card }) => {
  // ... 攻守计算与指示物解析
  return (
    <div className="absolute z-40 pointer-events-none select-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] min-w-[110px] max-w-[124px] bg-black/85 backdrop-blur-xs border border-white/20 rounded shadow-2xl p-1.5 flex flex-col gap-0.5 text-[10px] leading-tight text-white font-sans animate-in fade-in zoom-in-95 duration-100">
      <div className="font-bold text-center truncate text-[11px] text-white/95" title={cardName}>
        {cardName}
      </div>
      {/* 攻守数值行 (变动差值色彩高亮) */}
      {/* 星阶与种族属性 */}
      {/* 指示物全称逐行清单 */}
    </div>
  )
}
```

**src/renderer/src/components/Board/CardItem.tsx**

```diff
+  // 状态判定：存在指示物或自定义攻守变动
+  const hasCounters = !!(card.counters && Object.values(card.counters).some((v) => v > 0))
+  const hasCustomAtkDef = card.customAtk !== undefined || card.customDef !== undefined
+  // 战术全息浮层触发：处于全场战术透视模式，或鼠标正悬停在有状态的卡片上
+  const showHud = (tacticalView || isHovered) && (hasCounters || hasCustomAtkDef)
...
-      {/* 指示物标识 (旧版静态红点) */}
-      {card.counters && Object.values(card.counters).some((v) => v > 0) && (
-        ...
-      )}
+      {/* 战术全息状态 HUD (Tab 战术透视或鼠标悬停有状态卡片时显示) */}
+      {showHud && <CardHudOverlay card={card} />}
```

---

### 4. 顶栏战术透视开关与 Tab 全局热键拦截

- **改动文件**：**src/renderer/src/components/Header/Header.tsx**、**src/renderer/src/components/Header/MenuBar.tsx**
- **开发思考与缘由**：
  为便于创作者以最轻量的方式唤出全场透视：
  - 在顶栏工具栏挂载 `[透视]` 切换按钮，状态激活时带有主题强调色高亮；
  - 注册全局 `Tab` 快捷键，输入框聚焦打字时自动放行原生 Tab 行为，非输入框聚焦时按下立即 `preventDefault()` 并切换战术透视状态；
  - 快捷键帮助弹窗同步补充说明。

**src/renderer/src/components/Header/Header.tsx**

```diff
+      // Tab 键切换全场战术透视 (非输入框聚焦时有效)
+      if (e.key === 'Tab') {
+        if (!isInput) {
+          e.preventDefault()
+          toggleTacticalView()
+        }
+      }
...
+          {/* 战术透视开关 */}
+          <Button
+            variant={tacticalView ? 'secondary' : 'ghost'}
+            size="xs"
+            onClick={toggleTacticalView}
+            title="战术透视 (Tab)：全局显示/隐藏所有卡片的指示物与攻守状态浮层"
+          >
+            {tacticalView ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
+            <span>透视</span>
+          </Button>
```

---

### 5. 棋盘就地浮动调整卡（CardStatPopover）与全场指示物智能推断

- **改动文件**：**src/renderer/src/utils/counterDeduce.ts**、**src/renderer/src/components/Board/components/CardStatPopover.tsx**、**src/renderer/src/components/Board/CardItem.tsx**、**src/renderer/src/components/CardDetail/CardDetailPanel.tsx**
- **开发思考与缘由**：
  在实机测试与反馈中发现两个关键痛点：
  - **左侧栏交互违和**：左侧栏原本是纯粹的卡片大图与效果展示区，强行塞入表单打乱了排版美感，且迫使创作者在棋盘与屏幕左侧之间频繁来回摆动手腕；
  - **单卡智能推断局限**：在游戏王实战中，绝大多数指示物（如捕食指示物、A指示物、雾指示物）是我方怪兽或魔陷**施加给对方怪兽**的。如果只检索当前选中的卡，当创作者点击对方的普通怪兽时，对方卡片文本根本不包含“捕食植物”，导致推断彻底失效。

  针对上述问题进行了针对性重构：
  - **左侧栏回归 100% 纯净**：移除所有突兀的实战属性表单，还原本色卡片图鉴与完整效果文本展示；
  - **全场指示物智能感知（deduceSuggestedCounters）**：扫描整场决斗中双方所有卡片（场上、手牌、额外、墓地）的卡名、描述以及已挂载的指示物。只要场上存在「捕食植物」等体系，无论选中哪张卡（包括对方怪兽），顶部均直接展示一键药丸按钮：`[+ 捕食指示物]`，一秒点击即完成放置；
  - **棋盘就地浮卡（CardStatPopover）**：选中场上卡片时直接在卡旁就地浮现紧凑的半透明毛玻璃调整卡，配备攻守快速档位（`+300` / `+500` / `+1000`）、指示物步进增减与一键重置，改完点空白处即收起。

**src/renderer/src/utils/counterDeduce.ts**

```ts
export function deduceSuggestedCounters(state: DuelPuzzleState): CounterDefinition[] {
  const suggestedMap = new Map<number, CounterDefinition>()
  // 1. 扫描全场所有卡片上已经存在的指示物
  // 2. 收集全场所有卡片文本 (卡名 + 效果描述)
  // 3. 匹配所有已知指示物名称并汇总推荐
  return Array.from(suggestedMap.values())
}
```

**src/renderer/src/components/Board/CardItem.tsx**

```diff
       {/* 战术全息状态 HUD (Tab 战术透视或鼠标悬停有状态卡片时显示) */}
       {showHud && <CardHudOverlay card={card} />}
+
+      {/* 棋盘就地实战属性与指示物浮动微调卡 (选中场上卡片时在卡侧就地浮现) */}
+      {isSelected &&
+        (card.location === CardLocation.MZONE ||
+          card.location === CardLocation.SZONE ||
+          card.location === CardLocation.FZONE ||
+          card.location === CardLocation.PZONE) && <CardStatPopover card={card} />}
     </div>
```

---

### 6. Lua 残局引擎双向闭环（c:add_counter 生成与反向解析）

- **改动文件**：**src/shared/engine/luaGenerator.ts**、**src/shared/engine/luaParser.ts**
- **开发思考与缘由**：
  在 ocgcore 残局标准中，指示物必须通过返回的卡片对象调用 `c:add_counter(type, count)` 接口添加：
  - `luaGenerator.ts`：若卡片带有指示物，将卡片生成语句升级为 `local c = Debug.AddCard(...)`，随后逐行生成 `c:add_counter(0x1, 3) -- 放置3个魔力指示物`；
  - `luaParser.ts`：增加对 `c:add_counter` 的正则模式匹配，并将解析到的类型与数量自动归集到对应的场上卡片实例中，达成双向 round-trip 语义等价。

**src/shared/engine/luaGenerator.ts**

```diff
+        const hasCounters =
+          card.counters && Object.values(card.counters).some((v) => v > 0)
+
+        if (hasCounters) {
+          lines.push(
+            `local c = Debug.AddCard(${card.code}, ${card.owner}, ${card.controller}, ${locName}, ${card.sequence}, ${posName})${cardNameComment}`
+          )
+          for (const [typeIdStr, count] of Object.entries(card.counters!)) {
+            const countNum = Number(count)
+            const typeNum = Number(typeIdStr)
+            if (countNum > 0) {
+              const hexStr = `0x${typeNum.toString(16)}`
+              const counterName = getCounterName(typeNum)
+              lines.push(`c:add_counter(${hexStr}, ${countNum}) -- 放置${countNum}个${counterName}`)
+            }
+          }
+        } else {
           lines.push(
             `Debug.AddCard(${card.code}, ${card.owner}, ${card.controller}, ${locName}, ${card.sequence}, ${posName})${cardNameComment}`
           )
+        }
```

**src/shared/engine/luaParser.ts**

```diff
+    // 匹配 c:add_counter
+    const counterMatch = trimmed.match(addCounterRegex)
+    if (counterMatch && lastAddedCard) {
+      const typeStr = counterMatch[1].trim()
+      const typeNum =
+        typeStr.startsWith('0x') || typeStr.startsWith('0X')
+          ? parseInt(typeStr, 16)
+          : parseInt(typeStr, 10)
+      const count = parseInt(counterMatch[2], 10)
+      if (!lastAddedCard.counters) {
+        lastAddedCard.counters = {}
+      }
+      lastAddedCard.counters[typeNum] = (lastAddedCard.counters[typeNum] || 0) + count
+      continue
+    }
```

---

### 7. 自由拖拽面板、Shift+左键唤出与加减乘除四则运算优化

- **改动文件**：**src/renderer/src/components/Board/components/CardStatPopover.tsx**、**src/renderer/src/components/Board/CardItem.tsx**、**src/renderer/src/components/Board/CardContextMenu.tsx**、**src/renderer/src/stores/useDuelStore.ts**
- **开发思考与缘由**：
  1. **面板自由拖动与杜绝卡牌跟随拖动**：
     - 在操作面板根元素显式标记 `draggable={false}`，并拦截 `onDragStart` 与 `onMouseDown` 事件冒泡，杜绝父级 `CardItem` 的原生 HTML5 拖拽机制被意外触发；
     - 头部标题栏支持鼠标左键按住拖动（监听全局 `mousemove` 与 `mouseup`），维护 `dragOffset` 坐标位移，用户可随心所欲将该浮层拖至屏幕任意方便操作的空白位置。
  2. **唤出快捷键解耦（Shift + 鼠标左键点击）**：
     - 将场上卡片的常规选中状态（`selectedCardId`）与微调面板的激活状态（`activeStatPopoverCardId`）彻底解耦；
     - 常规单击左键仅选中卡片并在左侧图鉴呈现大图，绝不跳出弹窗打扰视野；
     - 仅当用户使用 **`Shift + 鼠标左键点击`** 场上卡片时，才唤出或关闭该微调操作面板；并在右键上下文菜单中提供同等入口。
  3. **精简指示物候选栏目（只展示本局相关指示物）**：
     - 移除面板中间冗余的“智能推荐（本局相关）”药丸展示区；
     - 将本场卡片效果智能推导出的指示物直接填充至底部的候选 `<Select>` 下拉框中，全场未提及指示物时仅回退展示少数高频常用项，彻底移除 114 个冗余项的冗长列表。
  4. **攻守数值全面支持加减乘除四则运算与一键复原**：
     - 接入与生命值一致的算式解析引擎（`parseLpExpression` / `switchOperator`）；
     - ATK/DEF 均支持在输入框内直接输入任意算式（如 `+500`、`/2`、`*2`、`-300`、`1700+300`），实时预览计算结果，回车或失焦即刻应用；
     - 聚焦时展开加减乘除运算模式切换条（`- 减`、`+ 加`、`÷ 除`、`× 乘`、`= 改`）；
     - 保留纯图标刷新按钮（`RotateCcw`），单项独立复原，避免重叠挤压；
     - 彻底解耦卡片移动与面板位置，采用顶层全局独立浮窗与 GPU 硬件加速流畅拖拽。
  5. **战术全息透视（Tab）按需分层展示策略**：
     - 取消了鼠标悬停自动弹出 HUD 的逻辑，避免鼠标划过卡片时遮挡卡面；
     - 当按下键盘 **`Tab` 键**（或点击顶栏战术透视开关）时：
       - **怪兽卡**：全场场上怪兽默认全部展示如同游戏王实战游戏般的核心数据全息浮层（卡名、攻守数值、星阶/阶级/连接与种族/属性、指示物），极大方便掌握场面与做场推演；
       - **魔法/陷阱卡**：平时不展示浮层，保持魔陷区视野干净整洁；仅当魔法陷阱卡真正被赋予了指示物（如场地魔法/永续魔陷挂载指示物）时，才在按下 `Tab` 键时亮起提示指示物数据；
     - 再次按下 `Tab` 键即刻隐藏全部浮层，还原清爽棋盘。
  6. **菜单栏帮助系统同步收录**：
     - 在顶部菜单栏「帮助 ➔ 快捷键参考」（**src/renderer/src/components/Header/MenuBar.tsx**）弹窗中，正式收录 `Shift + 点击`（唤出攻守与指示物微调面板）以及 `Tab`（全局战术透视）的操作说明，使用户随时可查阅。


