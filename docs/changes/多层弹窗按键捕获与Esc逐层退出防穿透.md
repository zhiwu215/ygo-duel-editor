# 游戏王决斗编辑器：多层弹窗按键捕获与 Esc 逐层退出防穿透

本改动属于一次独立的原子化修复与交互优化提交，旨在解决应用内多层弹窗（卡图大图 Lightbox、右键上下文菜单、堆叠列表弹窗）在按下 `Escape` 键时同层级穿透、导致底层弹窗被意外一并关闭的交互缺陷。通过引入 DOM 事件捕获阶段拦截（Capture Phase）与 `stopImmediatePropagation()` 阻断机制，构建了严格按层级逐层退出的弹窗栈体验。

---

## 改动缘由与核心设计目标

- **消除 Esc 连带误关的穿透痛点**：
  - 当编排者打开堆叠列表弹窗（`PileListModal`）检视卡片时，左侧详情面板（`CardDetailPanel`）常驻清晰呈现当前悬停卡片；
  - 若编排者点击左侧卡图放大进入高清预览大图（Lightbox 弹窗），此时按下 `Esc` 键希望退出大图时，底层的列表弹窗会被连带一并关闭；
  - 同样，在列表弹窗内呼出右键上下文菜单时，按下 `Esc` 也会导致列表连带退出。
- **DOM 全局键盘监听的传播陷阱分析**：
  - 多个独立组件均通过 `window.addEventListener('keydown', ...)` 监听按键；
  - 由于所有监听器都注册在同一个顶层 `window` 目标上，常规的 `e.stopPropagation()` 仅能阻止 DOM 节点树的父子冒泡，无法阻止挂载在同一 `window` 上的同级监听器执行；
  - 因此当 `Escape` 按下时，大图弹窗和列表弹窗的监听器都会被调用，导致两个弹窗同时关闭。
- **捕获阶段优先截断与逐层退出设计**：
  - 顶层覆盖物（卡图大图 Lightbox 处于 `z-[70]`、右键上下文菜单处于 `z-[60]`）在注册键盘监听时声明 `{ capture: true }`，使按键事件在 DOM 捕获阶段最先由顶层弹窗接收；
  - 顶层弹窗在处理 `Escape` 逻辑后，立即调用 `e.stopImmediatePropagation()` 与 `e.stopPropagation()`，彻底终止事件向下传播及在 `window` 同级冒泡；
  - 从而确保按下一次 `Esc` 时仅关闭最顶层视图，再次按下 `Esc` 时才关闭下一层视图。

---

## 前端设计思考与样式体系

### 弹窗层级（Z-Index）清晰规范

- **卡图放大预览 Lightbox**：
  `fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in`
  - 层级设定为 `z-[70]`，超越全局右键菜单（`z-[60]`）与列表弹窗（`z-40` / `z-50`），居于全屏最高层级。
- **右键上下文菜单**：
  `fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none`
  - 层级设定为 `z-[60]`，浮于列表弹窗之上但位于大图 Lightbox 之下。
- **堆叠列表弹窗**：
  - 局域遮罩位于 `z-40`，对话框位于 `z-50`。

### 事件捕获模式与 stopImmediatePropagation 机制解析

#### DOM 事件传播的双向流动模型

当用户在键盘上按下 `Escape` 键时，浏览器的事件流并不直接交由目标元素，而是历经两个完整阶段：

- **捕获阶段（从外向内）**：事件从最顶层的全局宿主沿 DOM 树自上而下逐级向下分发：`window` ➔ `document` ➔ 容器 ➔ 聚焦元素；
- **冒泡阶段（从内向外）**：事件到达目标后反向逐级向上回弹：聚焦元素 ➔ 容器 ➔ `document` ➔ `window`；
- **默认监听机制**：常规的 `addEventListener` 默认只在回弹的**冒泡阶段**生效。

#### 全局 window 监听器的连带执行陷阱

在多层弹窗并存的场景下，容易出现同级误触发缺陷：

- 顶层的右键菜单（`CardContextMenu`）与底层的列表弹窗（`PileListModal`）都在全局顶层对象 `window` 上注册了 `keydown` 监听器；
- 在默认的冒泡阶段，按键事件回弹至 `window` 时，浏览器会按注册顺序依次调用挂载在 `window` 上的所有监听回调；
- 此时常规的 `e.stopPropagation()` 只能阻止事件向父级节点继续冒泡，但由于所有监听器均位于同一个 `window` 对象本身，它**无法阻止挂载在同一对象上的同级兄弟监听器**执行，导致按一次 `Esc` 键时，菜单与底层列表被连带同时关闭。

#### capture 捕获模式抢占最高优先权

通过为顶层组件的键盘监听配置 `{ capture: true }`，彻底逆转了执行时机：

- 该监听器直接被提升至最前端的**捕获阶段**执行；
- 当 `Escape` 按下的瞬间，事件刚从顶层 `window` 起步分发，底层的列表弹窗还在末端的冒泡阶段排队等待；
- 处于视觉最顶层的菜单或大图预览由此获得了**最高优先级的事件拦截权**。

#### stopImmediatePropagation 就地剥夺执行权

在捕获阶段截获事件后，调用 `e.stopImmediatePropagation()` 达成绝对阻断：

- 相比普通的 `stopPropagation()`，该方法具备更高强度的控制力；
- 它不仅阻断事件向后续子节点下发，而且**立即剥夺挂载在当前节点上的所有剩余同级监听器的执行权**；
- 事件在当前监听器执行完毕后即刻就地销毁，底层的列表弹窗监听器完全不会接收到任何按键通知。

#### 逐层退出弹窗栈的实际运行流程

该组合机制构建了标准、平滑的现代桌面弹窗交互体验：

- **第一次按下 Esc**：最顶层覆盖物（大图预览或右键菜单）在捕获阶段抢先响应关闭，并调用 `stopImmediatePropagation()` 彻底掐断传播，底层卡组列表弹窗保持打开；
- **第二次按下 Esc**：由于顶层覆盖物已关闭且监听器已注销，按键事件正常流动至底层列表弹窗的回调函数中，从容关闭列表弹窗。

---

## 各模块代码改动明细与 Diff

### **src/renderer/src/components/CardDetail/CardDetailPanel.tsx**

- **改动缘由**：
  - 将大图预览弹窗提升至 `z-[70]`；
  - 监听 `Escape` 键改用 `{ capture: true }` 捕获模式，并调用 `e.stopImmediatePropagation()` 彻底阻断事件穿透至底层。

```diff
-  // 监听 Esc 键关闭大图弹窗
+  // 监听 Esc 键关闭大图弹窗 (捕获阶段拦截，阻止冒泡到列表弹窗等底层组件)
   useEffect(() => {
     if (!showImageModal) return
     const handleKeyDown = (e: KeyboardEvent): void => {
       if (e.key === 'Escape') {
+        e.preventDefault()
+        e.stopPropagation()
+        e.stopImmediatePropagation()
         setShowImageModal(false)
       }
     }
-    window.addEventListener('keydown', handleKeyDown)
-    return () => window.removeEventListener('keydown', handleKeyDown)
+    window.addEventListener('keydown', handleKeyDown, { capture: true })
+    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
   }, [showImageModal])

        {/* 卡图放大查看 Lightbox 弹窗 */}
        {showImageModal && (
          <div
-          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in"
+          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in"
            onClick={() => setShowImageModal(false)}
          >
```

### **src/renderer/src/components/Board/CardContextMenu.tsx**

- **改动缘由**：
  - 右键上下文菜单层级提升至 `z-[60]`；
  - 监听 `Escape` 改用捕获模式 `{ capture: true }` 并调用 `e.stopImmediatePropagation()`，防止关闭右键菜单时连带关闭列表。

```diff
     const handleKeyDown = (e: KeyboardEvent): void => {
-      if (e.key === 'Escape') closeMenu()
+      if (e.key === 'Escape') {
+        e.preventDefault()
+        e.stopPropagation()
+        e.stopImmediatePropagation()
+        closeMenu()
+      }
     }

-    window.addEventListener('keydown', handleKeyDown)
+    window.addEventListener('keydown', handleKeyDown, { capture: true })
-    return () => window.removeEventListener('keydown', handleKeyDown)
+    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })

-      className="fixed z-50 min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
+      className="fixed z-[60] min-w-44 bg-popover/95 backdrop-blur-md text-popover-foreground border border-border rounded-lg shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
```
