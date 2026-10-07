# 卡组编辑器顶栏复刻 YGOPro 卡组管理面板

> **需求**：用户要求卡组编辑器顶部「直接完全复刻 ygopro 的前端样式」；本项目特有的多余按钮（导出 YDK、手牌测试、送入决斗盘、新建）放在 ygopro 原本很大的「退出编辑」按钮下面，且该按钮允许调整大小。配色延续项目黑白灰。
> **实现选择**：按源码逐控件复刻 `wDeckEdit` 面板与 `btnLeaveGame` 大按钮的布局与**行为**，把项目原有的「保存到库/新建/导出/手测/送入决斗盘」收纳进大按钮下方 2×2 迷你按钮区；分组选择从描述行上移为面板里的「卡组分类」下拉。
> **参考出处**：`ygopro/ygopro/gframe/game.cpp:683-745`（wDeckEdit 控件几何）、`game.cpp:978`（btnLeaveGame）、`deck_con.cpp:168-302, 1699-1707`（按钮与下拉行为）、`mdpro3/.../zh-CN/strings.conf` 1300-1308/1328/1335/1337/1339/1356（全部文案）。

---

## 第一步：把 ygopro 的行为语义核实清楚（deck_con.cpp）

复刻的不是皮，是操作语义。逐条核对源码后得到如下事实，全部照搬：

- **保存**（`BUTTON_SAVE_DECK`，188-200）：写进「卡组列表」当前选中项；没选中就不动作；成功提示 string 1335「保存成功」。
- **另存**（`BUTTON_SAVE_DECK_AS`，201-228）：取名字框文本，空则不动作；当前分类下**已有同名 → 覆盖那一份**，否则新建并选中。
- **删除**（`BUTTON_DELETE_DECK`，240-253）：删「卡组列表」当前选中项，先弹确认（1337「是否删除这个卡组？」），删完加载相邻卡组。
- **清空**（`BUTTON_CLEAR_DECK`，168-175）：先弹确认（1339「是否清空正在编辑的卡组？」）。
- **打乱**（`BUTTON_SHUFFLE_DECK`，183-187）：**只洗主卡组**，不洗额外/副卡组。
- **切分类**（`ChangeCategory`，1699-1707）：刷新卡组列表后**自动载入该分类第一个卡组**。
- **切分类 / 切卡组 / 管理 / 退出编辑**：`is_modified` 时一律先弹 string 1356「此操作将放弃对当前卡组的修改，是否继续？」（856-863、872-879、292-300、255-262）。
- 控件几何（`game.cpp:683-745`）：大按钮 (205,5,295,80) 即 90×75；面板 (309,5,605,130) 即 296×125，四行行高 25、行距 5：卡组分类+管理 / 卡组列表+保存 / 名字框+另存 / 打乱+排序+清空…（空档）…删除。

## 第二步：本地数据模型到 ygopro 语义的映射（**src/renderer/src/stores/useDeckEditorStore.ts**）

项目没有「文件路径」概念，映射关系是：分类 = `deck.group`（完整路径，未分组 = 空串），卡组列表 = `deckList` 按分类过滤，名字框 = `deck.name`。为补齐语义新增两个 action：

- `shuffleDeck()`：Fisher–Yates 只洗 `deck.main`，对齐 ygopro。
- `saveDeckAsToLibrary(group)`：另存。先在**同分组同名**里找孪生卡组，命中则复用其 `id`（覆盖），否则剥掉 `id` 新建；`saveDeckToLibrary` 主进程按 id upsert（**src/main/services/deckService.ts:152**），所以「给不给 id」就是「覆盖还是新建」的开关。

```diff
+  saveDeckAsToLibrary: async (group): Promise<boolean> => {
+    const { deck, deckList } = get()
+    const name = deck.name.trim()
+    if (!name || !window.api?.saveDeckToLibrary) return false
+    const twin = deckList.find((d) => (d.group ?? '') === group && d.name === name)
+    const copy: DeckData = { ...deck, id: twin?.id, name, group: group || undefined }
```

## 第三步：未保存守卫 is_modified（**src/renderer/src/components/DeckEditor/DeckEditorApp.tsx**）

ygopro 的 `is_modified` 用快照 ref 复刻：`savedSnapshotRef` 存 `JSON.stringify(deck)`，在 `deck.id` 变化（加载/新建/另存成功）时经 effect 重置基线，保存成功后手动 `markDeckClean()`。切换动作前 `confirmDiscard()` 比较 current 与基线，不同则弹 1356 的原生 confirm。

卡组分类下拉的选中值要跟随当前卡组的分组（ygopro `load_current_deck` 会联动分类框），这里用**渲染期调整 state**（prevDeckId 比对）而不是 effect 里 setState——`react-hooks/set-state-in-effect` 是 error 级，先例是 `DeckDetailCard` 的交叉淡入。

`base-ui Select` 的 `onValueChange` 参数类型是 `string | null`，handler 签名必须写 `(value: string | null)`，靠开头 `if (!value) return` 归一化——typecheck 报过一次 TS2322。

## 第四步：布局落地（**src/renderer/src/components/DeckEditor/DeckEditorApp.tsx**）

- 顶栏改成一条 `items-stretch` 横带（约 140px 高）：左列 `w-[124px]` = 「退出编辑」大按钮（`flex-1`，约 56px 高，即「调整大小」后的 btnLeaveGame）+ 下方 2×2 `MiniButton`（导出 YDK / 新建 / 手牌测试 / 送入决斗盘，图标+小字纵向排布，「送入决斗盘」用 primary 弱高亮当 CTA）。
- 面板 `w-[430px]` 四行 `h-6` 行高、`gap-1`、`p-2`，总高约 124px，与 ygopro 125px 等比；行内标签宽 `w-14`（「卡组分类：」5 字 11px 恰好放下），右侧按钮统一 `w-[58px]` 的 `PanelButton`（outline + xs）。
- 底行保留 ygopro 的空档：打乱/排序/清空 + `flex-1` 占位 + 删除右对齐。
- 原标题栏职责并入横带：根容器 `[-webkit-app-region:drag]`，左列与面板 `no-drag`，`WindowControls` 绝对定位到右侧空白区右上角。描述行保留但只留描述输入（分组选择已上移）+ 保存/删除 toast。
- 分组的「新建分组…」入口从下拉里移除（ygopro 的分类下拉也没有），建分组走「管理」→ 卡组库视图。

## 第五步：筛选面板并入顶行，消除右侧空白（2026-10-07 追加）

用户反馈「右侧还有一堆空的区域」。根因是布局层级不对：ygopro 的顶行是**三块并排占满整行**——`btnLeaveGame`(205-295) + `wDeckEdit`(309-605) + `wFilter`(610-1020)，三者的 y 都是 5-130，**同处一行**；上一版把 wFilter 单独放到了下一行，于是顶行只剩两块、右侧留白。

- `FilterDrawer` band 模式不再自带整条横带外观（去掉 `border-b bg-card/75` 与外层 `px-3 py-1.5`），改为与「卡组管理面板」同款的独立面板：`rounded-md border border-border bg-muted/20 p-2`，根容器接 `className`，行高全部走 `controlH = 'h-6'`（含 `NumericRow` 的 `inputClassName`、连接标记按钮、关键字输入、清空/搜索按钮）。
- `DeckEditorApp` 顶行结构改为 `[退出编辑 + 2×2 迷你按钮] [卡组管理面板 430px] [筛选面板 flex-1] [窗口控件 92px 窄列]`；原内容区的 `<FilterDrawer variant="band" />` 删除，卡组网格与搜索列直接吃掉腾出的高度。
- 管理面板加 `justify-between`：筛选面板 5 行、管理面板 4 行，靠 `items-stretch` 拉到同高后由 `justify-between` 分配行距，避免 4 行面板底部空一截。

## 验证

`typecheck:web` 0 错误；`typecheck:node` 的 5 条报错来自未跟踪的在途文件 `src/main/services/customCardService.ts`（`CUSTOM_CARD_ID_MIN/MAX` 未定义）与 `src/preload/index.ts`（尚未接 `listCustomCards` 等 5 个 API），与本次改动无关；eslint 两个改动文件 0 输出；`electron-vite build` 三段 built successfully。布局观感与手感待用户本机 `pnpm dev` 确认。
