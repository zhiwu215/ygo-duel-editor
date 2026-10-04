# 游戏王决斗编辑器：快捷键 Del 直接删除卡片与悬停感知

本改动属于一次独立的原子化功能提交，旨在解决编排场面时删除卡片操作繁琐（必须右击呼出上下文菜单、再点击删除菜单项）的交互痛点。通过在全局状态中引入鼠标悬停实例（`hoveredInstanceId`）感知，并建立全局 `Delete` / `Del` 键盘监听机制与输入区保护策略，实现了“鼠标悬停直删”与“点击选中后删除”的双模极速删除体验，且全面兼容 `Ctrl+Z` 撤销恢复。

---

## 开发者思考脉络与代码改动

### 第一步：数据层交互状态扩展与撤销机制联动

- **思考与改动缘由**：
  要实现“鼠标指着某张卡按 Del 直接删除，或者选中某张卡后按 Del 删除”，首先需要在全局状态中心精确获知“当前鼠标究竟正指向哪一张场上卡片的运行时实例”。
  此前 **src/renderer/src/stores/useDuelStore.ts** 中已有点击选中的 `selectedCardId`，以及用于左侧面板呈现的 `hoveredCard`（仅存数据库卡片数据 `CdbCard` 原型，并不包含场上唯一 `instanceId`）。
  因此需要在 `DuelStoreState` 中增加 `hoveredInstanceId: string | null` 及其更新动作 `setHoveredInstanceId`。
  同时，在执行 `removeCard(instanceId)` 移除卡片时，必须联动清理被删卡片的 `selectedCardId` 与 `hoveredInstanceId`，避免残留无效引用。
  由于 `removeCard` 直接变更 `state.cards`，而 store 挂载了 `zundo` 撤销中间件，删除操作天然无缝支持 `Ctrl+Z` 撤销与恢复。

**src/renderer/src/stores/useDuelStore.ts**

```diff
 interface DuelStoreState {
   // 选中与悬停交互
   selectedCardId: string | null
   hoveredCard: CdbCard | null
+  hoveredInstanceId: string | null

   // 动作
   setMasterRule: (rule: MasterRule) => void

   // UI 交互
   setSelectedCardId: (id: string | null) => void
   setHoveredCard: (card: CdbCard | null) => void
+  setHoveredInstanceId: (id: string | null) => void
 }

 export const useDuelStore = create<DuelStoreState>()(
   temporal(
     (set) => ({
       state: createInitialDuelState(5),
       selectedCardId: null,
       hoveredCard: null,
+      hoveredInstanceId: null,

       removeCard: (instanceId) =>
         set((prev) => ({
           state: {
             ...prev.state,
             cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
           },
           selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
+          hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId
         })),

       setSelectedCardId: (id) => set({ selectedCardId: id }),
       setHoveredCard: (card) => set({ hoveredCard: card }),
+      setHoveredInstanceId: (id) => set({ hoveredInstanceId: id })
     }),
```

#### temporal 中间件与状态时间旅行机制解析

`temporal` 是来自开源状态管理库 `zundo` 的一个 Zustand 中间件。其核心作用是为 Zustand Store 提供“时光机”（Time Travel / 撤销与重做）能力，使应用能够以极小的心智负担原生支持 `Ctrl + Z`（撤销）和 `Ctrl + Y`（重做）。

##### 核心作用：给状态拍摄快照

英文单词 _temporal_ 本义为“时间维度的”。在程序运行时，它相当于一个在底层静默工作的历史记录仪：

- 每当通过 action 内部调用 `set(...)` 修改了场面（例如摆放一张卡、移动格子槽位、变更攻守表示形式、或者执行 Del 快捷键删除卡片）；
- `temporal` 就会把变更前的数据快照有序存入历史堆栈（`pastStates`）；
- 当调用其暴露的 `undo()` 方法时，便能将整个决斗场面瞬间“倒带”回退至上一版本；而调用 `redo()` 则重新前进至下一步。

##### 实际绑定位置与全局快捷键

`temporal` 会在 **src/renderer/src/stores/useDuelStore.ts** 创建出的 `useDuelStore` 上自动挂载一个同名子 Store：`useDuelStore.temporal`。

在 **src/renderer/src/components/Header/Header.tsx** 中，顶层状态栏与工具栏通过订阅该子 Store 实现了完整的撤销/重做闭环：

```tsx
// 1. 响应式订阅 temporal 历史栈
const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)

// 2. 根据历史栈长度，响应式控制顶栏撤销/重做按钮的可用（高亮/置灰）状态
const canUndo = pastStates.length > 0
const canRedo = futureStates.length > 0

// 3. 全局按键监听器中分发命令
if (mod && e.key.toLowerCase() === 'z') {
  if (e.shiftKey) redo()
  else undo()
} else if (mod && e.key.toLowerCase() === 'y') {
  redo()
}
```

##### 关键配置：为什么需要 partialize 过滤

在 **src/renderer/src/stores/useDuelStore.ts** 的 store 底部，包含如下配置：

```ts
    {
      // zundo 撤销历史配置：只追踪 state 的变化
      partialize: (state) => ({ state: state.state }),
      limit: 50
    }
```

- **限制历史上限（limit: 50）**：仅保留最近 50 次操作步长，防止长时间编排时内存无限制增长；
- **状态白名单过滤（partialize）**：
  在 `useDuelStore` 中，除了真正的决斗场面数据 `state`（卡片分布数组、双方 LP、当前规则版本等），还维护着临时交互状态：
  - `selectedCardId`（当前选中的卡片实例 ID）
  - `hoveredCard`（当前鼠标划过的卡片原型信息）
  - `hoveredInstanceId`（当前鼠标正悬停的场上卡片实例 ID）

  如果将这些纯 UI 变量也一并纳入历史追踪，那么用户在屏幕上仅仅划过几张卡片或者点击切换选中项，按下 `Ctrl + Z` 时撤销的就会变成“光标移动”或“选中取消”，这违背了用户的操作直觉。
  因此，通过 `partialize: (state) => ({ state: state.state })` 声明只追踪核心决斗局面，所有悬停与选中状态均不会污染撤销堆栈，确保撤销/重做永远只精准作用于实际的场面变更。

#### 状态更新函数中的 prev 语义与悬停清理机制

##### prev 形参的参照物与时态语义

在 **src/renderer/src/stores/useDuelStore.ts** 中，许多动作都采用 `set((prev) => ({ ... }))` 的函数式更新写法。初看 `prev`（Previous）可能会误以为它指代的是“过去的旧记录”，但实际上**它是以「本次即将发生的修改」作为坐标参照物**的：

- **以实际运行的时间轴而言**：当执行到 `set((prev) => ...)` 回调的瞬间，`prev` 就是此时此刻驻留在内存中的**最新状态快照**；
- **以函数内部面向未来的计算视角而言**：由于该更新函数即将计算并返回一个全新的状态对象（即产生 `nextState`），因此当前进入函数作为计算输入的数据，相对于即将产出的新数据而言，便是“修改前的上一个版本”，因而被约定俗成简写为 `prev`；
- **命名本质**：在语法层面，它仅是一个普通的函数参数名，与写成 `current`（当前状态）或 `state`（目标状态）在执行逻辑上百分之百完全等效。社区普遍习惯命名为 `prev`，核心在于强化 `prev`（输入基准）➔ `next`（输出产物）的明确因果链条。

##### 悬停实例与选中状态的生命周期三态

在删除卡片的方法实现中：

```ts
selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId
```

它完整串联起了一个卡片实例在 Store 中的生命周期演进：

- **初始化空态**：软件启动之初，鼠标尚未悬停在任何卡片上方，初始值赋予 `null`，代表当前无目标指向；
- **悬停感知与选中区分**：
  - **悬停态（Hover）**：鼠标划入卡片范围（触发 `onMouseEnter`）即由组件自动存入 `instanceId`，用户完全无需点击左键即可锁定目标，专为 Del 快捷键即指即删提供低延迟定位；
  - **选中态（Select）**：必须由用户显式左键点击卡片才会设定 `selectedCardId`，用于聚焦高亮或跨区域操作；
- **删除联动清理**：当场上一张卡片被移除时，三元表达式负责严格防御：如果被移除的卡片恰好正处于当前悬停（或选中）状态，则立即重置为 `null`；若被移除的是其他卡片（例如通过脚本或批量命令操作），则保留当前的悬停状态不变，杜绝因卡片消失而造成幽灵 ID 残留。

---

### 第二步：场上与手牌卡片组件的悬停事件感知

- **思考与改动缘由**：
  在数据层有了 `setHoveredInstanceId` 之后，需要让视图层的卡片组件能够捕获鼠标划过动作并同步状态。
  在决斗面板中，我方与对方的主怪兽区、魔陷区、灵摆区、场地魔法区以及手牌托盘中的卡片均统一由 **src/renderer/src/components/Board/CardItem.tsx** 渲染。
  在卡片外层容器的 `onMouseEnter` 事件中，不仅提取卡片信息展示于详情栏，同时将该卡片的 `card.instanceId` 赋给 `setHoveredInstanceId`；
  在 `onMouseLeave` 事件中，为了防止用户鼠标在紧密排列的卡片间快速划动时产生的时序交叉（后一张卡片的 mouseEnter 偶发先于前一张卡片的 mouseLeave 触发），增加一层实例 ID 校验，仅当离开的卡片确实等于当前记录的悬停卡片时才置为 `null`，确保悬停状态流转稳定精准。

**src/renderer/src/components/Board/CardItem.tsx**

```diff
 export const CardItem: React.FC<CardItemProps> = ({ card, squareCell = false }) => {
-  const { selectedCardId, setSelectedCardId, setHoveredCard } = useDuelStore()
+  const { selectedCardId, setSelectedCardId, setHoveredCard, setHoveredInstanceId } = useDuelStore()
   const { openMenu } = useContextMenuStore()

       onClick={(e) => {
         e.stopPropagation()
         setSelectedCardId(card.instanceId)
         if (card.card) setHoveredCard(card.card)
       }}
       onMouseEnter={() => {
+        setHoveredInstanceId(card.instanceId)
         if (card.card) setHoveredCard(card.card)
       }}
+      onMouseLeave={() => {
+        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
+          setHoveredInstanceId(null)
+        }
+      }}
       onContextMenu={(e) => {
```

---

### 第三步：堆叠卡组列表弹窗中的悬停同步与关闭清理

- **思考与改动缘由**：
  在决斗编排与残局制作过程中，作者常常需要双击打开额外卡组、主卡组、墓地或除外区弹窗（**src/renderer/src/components/Board/PileListModal.tsx**）来剔除废卡或调整卡组构筑。
  因此删除快捷键绝不能只局限于中央棋盘，也必须支持在列表弹窗内指卡直删。
  弹窗内的每张卡片采用自绘的横向卡轨卡片项展示，同样在卡片项上绑定 `onMouseEnter` 登记 `card.instanceId` 与 `onMouseLeave` 安全释放。
  同时，在弹窗因按下 `Escape` 或点击关闭按钮销毁时，在 `useEffect` 的卸载清理阶段执行 `setHoveredInstanceId(null)`，杜绝弹窗关闭后残留失效悬停引用的潜在隐患。

**src/renderer/src/components/Board/PileListModal.tsx**

```diff
   const {
     state,
     setHoveredCard,
+    setHoveredInstanceId,
     setSelectedCardId,
     removeCard,

-  // 监听 Esc 键关闭弹窗
+  // 监听 Esc 键关闭弹窗并在关闭时清理卡片悬停状态
   useEffect(() => {
     if (!target) return
     const handleKeyDown = (e: KeyboardEvent): void => {
       if (e.key === 'Escape') {
         closePile()
       }
     }
     window.addEventListener('keydown', handleKeyDown)
-    return () => window.removeEventListener('keydown', handleKeyDown)
-  }, [target, closePile])
+    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      setHoveredInstanceId(null)
    }
  }, [target, closePile, setHoveredInstanceId])

                       onMouseEnter={() => {
+                        setHoveredInstanceId(card.instanceId)
                         if (card.card) setHoveredCard(card.card)
                       }}
+                      onMouseLeave={() => {
+                        if (useDuelStore.getState().hoveredInstanceId === card.instanceId) {
+                          setHoveredInstanceId(null)
+                        }
+                      }}
                       onClick={() => {
```

---

### 第四步：全局键盘拦截、文本输入保护与级联清理

- **思考与改动缘由**：
  有了精确的卡片实例定位能力后，需要在决斗舞台核心 **src/renderer/src/components/Board/DuelBoard.tsx** 中挂载键盘监听器统一捕获 `Delete` 与 `Del` 按键：
  - **输入框安全保护**：检测事件触发源对象 `e.target`。若用户正在右侧卡片检索栏、顶部生命值输入框或任何 `<input>`、`<textarea>`、`contentEditable` 元素内输入文本，此时按下 `Delete` 应作为文本编辑的原生删除键处理，坚决予以放行，绝不误删场上卡片；
  - **指向优先与选中兜底机制**：若非输入场景，优先获取当前鼠标悬停指向的卡片 `hoveredInstanceId`（实现免点击、鼠标指哪删哪的极速修场）；若鼠标移到了空白区域，则退行判断当前是否有选中的卡片 `selectedCardId`（兼顾先点击选中再删除的经典操作惯性）；
  - **级联关闭菜单**：一旦确认要执行删除，调用 `e.preventDefault()` 截断事件，执行 `removeCard(targetId)`，并联动调用 `useContextMenuStore.getState().closeMenu()` 顺带关闭此前可能已展开的右键菜单。

**src/renderer/src/components/Board/DuelBoard.tsx**

```diff
-import React from 'react'
+import React, { useEffect } from 'react'
 import { useDuelStore } from '../../stores/useDuelStore'
+import { useContextMenuStore } from '../../stores/useContextMenuStore'
 import { CardLocation, MASTER_RULES, FieldCard } from '@shared/index'
 import { ZoneSlot } from './ZoneSlot'

 export const DuelBoard: React.FC = () => {
   const { state } = useDuelStore()
   const ruleInfo = MASTER_RULES[state.masterRule]

+  // 全局快捷键：Del / Delete 键直接删除当前鼠标指向或选中的卡片
+  useEffect(() => {
+    const handleKeyDown = (e: KeyboardEvent): void => {
+      if (e.key !== 'Delete' && e.key !== 'Del') return
+
+      const target = e.target as HTMLElement | null
+      const isInput =
+        target &&
+        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
+      if (isInput) return
+
+      const duelStore = useDuelStore.getState()
+      const targetId = duelStore.hoveredInstanceId || duelStore.selectedCardId
+      if (targetId) {
+        e.preventDefault()
+        duelStore.removeCard(targetId)
+        useContextMenuStore.getState().closeMenu()
+      }
+    }
+
+    window.addEventListener('keydown', handleKeyDown)
+    return () => window.removeEventListener('keydown', handleKeyDown)
+  }, [])
+
   // 辅助查找对应格子的卡片
```

#### 全局按键生命周期与输入安全防护机制解析

##### 挂载单次执行与事件持续监听的本质区分

在 **src/renderer/src/components/Board/DuelBoard.tsx** 中，全局快捷键监听通过 `useEffect` 注册在 `window` 对象上：

```ts
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

初看此处空的依赖项数组 `[]`，容易产生疑惑：“既然说只在组件初次挂载时执行一次，那为什么后续无论什么时候按 Del 键，卡片都能随时被删除？”

其本质在于区分了**“部署哨兵”**与**“哨兵执勤响应”**两个完全不同的阶段：

- **初次挂载（Mount）的真实含义**：当应用启动、中央决斗盘 `DuelBoard` 组件首次被 React 构建并绘制到屏幕 DOM 树上时，即为初次挂载；
- **部署哨兵只做一次**：`useEffect` 回调函数在挂载时执行且仅执行这一次，它的任务仅仅是向全局窗口下发指令 `window.addEventListener('keydown', handleKeyDown)`，相当于在系统大门口派驻了一名全天候 24 小时待命的“按键哨兵”。派驻哨兵这一部署动作，开局完成一次即可，绝不需要反复重复部署；
- **哨兵执勤响应任意多次**：哨兵一旦完成派驻，就会持续静默倾听全局键盘动向。用户在 1 分钟后按下 `Delete`，哨兵立刻唤醒并执行一次 `handleKeyDown`；用户在 1 小时后再次按下 `Delete`，哨兵依旧忠实执行。因此删除动作何时按都有效；
- **反向推演：若不限制单次执行的灾难**：如果去掉了 `[]` 限制，那么页面每次发生微小状态变化（如鼠标滑过、调整生命值）引发重新渲染时，都会盲目往系统里增派一名重复的哨兵。当界面渲染几十次后，用户按一次 `Delete` 就会有几十个监听器并发执行，不仅造成严重的内存泄露，还会导致一次按键连环误删多张卡片。

##### 输入框安全保护锁：防止误删场上卡片

```ts
const target = e.target as HTMLElement | null
const isInput =
  target &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
if (isInput) return
```

这一段逻辑是核心的**输入安全防线**。

在实际操作中，用户可能会在右侧检索栏搜索卡片名，或者在顶栏生命值区域手动输入数值。若在输入文字过程中手滑打错了字，本能会按下键盘上的 `Delete` 键去清除光标后的错别字；而此时用户的鼠标指针恰巧可能正悬停在决斗场上的某张关键怪兽上方。

如果没有这层拦截防护：

- 系统就会在用户试图删除输入框错别字的同时，判定当前存在 `hoveredInstanceId`；
- 从而导致输入框文字未按预期处理，场上辛辛苦苦做好的怪兽反而被意外抹除。

通过判断事件源 `e.target` 是否隶属于 `<input>`、`<textarea>` 或 `contentEditable` 可编辑节点：

- 一旦确认用户当前正在输入文本，立即提前 `return`；
- 将 `Delete` 按键完整归还给浏览器原生文本编辑器去删字，彻底杜绝场面误删事故。

##### preventDefault 行为接管与悬空右键菜单级联关闭

```ts
if (targetId) {
  e.preventDefault()
  duelStore.removeCard(targetId)
  useContextMenuStore.getState().closeMenu()
}
```

- **接管浏览器默认行为（preventDefault）**：向宿主环境声明本次按键事件已被决斗编辑器的专属删除逻辑所接管，阻断系统可能存在的默认操作（如焦点跳转或历史导航）；
- **联动清理悬浮菜单（closeMenu）**：覆盖了“用户先在卡片上右击弹出了上下文菜单，随后决定改按键盘快捷键 Del 删除”的操作场景。若不主动调用 `closeMenu()`，卡片被删除后，原本针对该卡片弹出的右键菜单仍会突兀地悬空停留在界面正中；加入此调用可在卡片消逝的瞬间同步销毁菜单，使交互闭环干净利落。

##### 纯前端 DOM 事件模型与 Electron 架构边界

在桌面应用架构中，键盘按键的捕获与响应需要清晰遵循进程分工：

- **纯前端内部极速流转**：`window.addEventListener` 属于渲染进程内置 Chromium 内核的原生 DOM API，决斗盘卡片数组存在于渲染端的 Zustand 内存中。因此，摆卡、移动、改攻守与 Del 快捷键删除卡片完全在前端单进程内部毫秒级闭环，无需经由 IPC 桥接层与主进程往返通信，保障了零输入延迟；
- **主进程 IPC 边界**：仅当涉及到宿主操作系统的底层特权调用时（例如调起操作系统的文件保存/打开原生窗口、直接读写本地磁盘中的 `cards.cdb` SQLite 数据库或读取物理卡图文件），才需要发起 IPC 通信。业务操作留在渲染层，使整体架构既轻快又边界分明。

---

### 第五步：帮助系统与快捷键提示同步呈现

- **思考与改动缘由**：
  在业务逻辑与防护机制闭环后，最后一步是在桌面端菜单栏 **src/renderer/src/components/Header/MenuBar.tsx** 的「帮助 ➔ 快捷键参考」弹窗中登记该功能。
  这不仅为使用者提供了显式的发现渠道，也清晰解释了“指向卡片或选中卡片时均可直删，且支持撤销”的规则，使新特性具备完备的自解释性。

**src/renderer/src/components/Header/MenuBar.tsx**

```diff
                 ['撤销', 'Ctrl + Z'],
                 ['重做', 'Ctrl + Y / Ctrl + Shift + Z'],
+                ['删除卡片', 'Delete / Del']
               ].map(([name, key]) => (
                 <div key={name} className="flex justify-between py-1 border-b border-border/40">
                   <span className="text-muted-foreground">{name}</span>

             <div className="space-y-1 text-xs pt-1">
+              <div className="flex justify-between py-1">
+                <span className="text-muted-foreground">删除卡片</span>
+                <span>鼠标指向卡片或选中卡片时按 Delete / Del 直接删除（可撤销）</span>
+              </div>
               <div className="flex justify-between py-1">
                 <span className="text-muted-foreground">摆卡 / 移动</span>
                 <span>从搜索列表拖拽至格；场上卡拖到另一格即移动</span>
```
