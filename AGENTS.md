# AGENTS.md — YGO Duel Editor

> 本文件是 AI 编码代理（Claude Code、Codex、Cursor、OpenCode 等）在修改本仓库时**必须遵守**的工作规范。
> 写法参照 [agents.md](https://agents.md) 开放格式与 [apache/airflow](https://github.com/apache/airflow/blob/main/AGENTS.md) 的实践：指令式、边界明确、命令可执行。
> 冲突时优先级：用户当前对话的明确指示 > 本文件 > 其他文档。若本文件与代码现实不符，**以代码为准**，并在同一个改动里顺手修正本文件。

---

## 1. 项目定位与创作场景

**YGO Duel Editor** 是一个用于游戏王 (Yu-Gi-Oh!) 决斗内容创作的桌面应用：可视化摆好双方场面，导出/导入符合 ocgcore 标准的 Lua 残局脚本。

产品目标是服务**三类创作场景**，新增功能与设计决策应优先兼容它们：

| 场景                 | 说明                                       | 数据形态                          |
| -------------------- | ------------------------------------------ | --------------------------------- |
| **残局布场**         | 摆出残局/教程局面的双方场地、手牌、生命值  | `DuelPuzzleState`（当前已实现）   |
| **同人剧情对局编排** | 编排多段剧情：开场白、事件触发、多回合推演 | 需要序列/章节等状态扩展（规划中） |
| **卡组 Combo 教学**  | 演示卡组起手与做场路线，分步骤讲解         | 需要步骤/回放等状态扩展（规划中） |

**当前实现范围**： MR2~MR5 场地编辑、拖拽摆卡、卡片检索（读取用户游戏目录的 `cards.cdb`）、Lua 脚本导入/导出、项目文件保存/加载、撤销/重做。

**明确的非目标**： 本项目排布的 Lua 脚本没有实现引擎内的真实对局逻辑，也不内置任何卡表/卡图数据（均来自用户本地的游戏客户端，通过用户选择路径读取）。

> 设计提示：三类场景的本质都是「初始局面 + 叙事/步骤说明」。涉及数据建模时不要把 `DuelPuzzleState` 假设成「只有一副残局」，为未来的多场景、多步骤结构预留可扩展性（如版本号迁移、状态嵌套），但**不要过度设计**未实现的功能。

---

## 2. 环境与常用命令

```bash
pnpm install              # 安装依赖（postinstall 会自动对 better-sqlite3 执行 electron-builder install-app-deps）
pnpm dev                  # 开发模式（electron-vite dev，带 HMR）
pnpm typecheck            # 双端类型检查 = typecheck:node + typecheck:web（Node 侧 + Web 侧）
pnpm typecheck:node       #   仅检查 main / preload / shared（tsconfig.node.json）
pnpm typecheck:web        #   仅检查 renderer（tsconfig.web.json）
pnpm lint                 # ESLint（带 --cache）
pnpm format               # Prettier 全仓格式化；单文件用 pnpm exec prettier --write <file>
pnpm build                # 先 typecheck 再 electron-vite build
pnpm build:win            # Windows 打包（另有 build:mac / build:linux / build:unpack）
```

**工作流硬性要求**：

- **每次逻辑改完，必须跑 `pnpm typecheck` 且双端零错误**，再跑 `pnpm lint`。这是当前项目唯一的自动化质量门禁——**本项目暂无测试框架**，不要杜撰 `pnpm test` 命令；如果认为需要补测试框架，先询问用户。
- `better-sqlite3` 是原生模块。若安装依赖后出现 `NODE_MODULE_VERSION` 不匹配报错，重新执行 `pnpm install`（依赖 postinstall 自动 rebuild），不要手工改动构建配置。
- 主流程开发环境为 **Windows**。主进程代码不硬编码路径分隔符或绝对路径，统一用 Node 的 `path` 模块和 IPC 拿到的用户目录。

---

## 3. 术语约定（写代码与注释时统一措辞）

| 术语          | 约定                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 卡密          | 数据字段统一叫 `code`（`CdbCard.id` 是例外，它是数据库主键，等价于卡密）                                                                        |
| 场上实例      | `instanceId`（每张卡在场地上的唯一 ID），不要与卡密 `code` 混淆                                                                                 |
| 控制者        | `controller: 0` = 我方，`controller: 1` = 对方。这是 ocgcore 硬约定，**任何地方都不得颠倒**                                                     |
| 归属者        | `owner: 0 \| 1` = 卡牌原型归属（洗回卡组时用它），通常与 controller 相同                                                                        |
| 规则版本      | 代码中 `MasterRule` 的取值是 `2 \| 3 \| 4 \| 5`，其中 `2` 覆盖 MR1/MR2（同为经典 5+5 布局）。文案写 MR1~MR5，代码守这个联合类型                 |
| 区域/表示形式 | 一律引用 `CardLocation` / `CardPosition` 常量（详见第 7 节），禁止裸写魔法数字                                                                  |
| Lua 常量映射  | `CardLocation.DECK → 'LOCATION_DECK'`、`CardPosition.FACEUP_DEFENSE → 'POS_FACEUP_DEFENSE'`，映射表集中在 `luaGenerator.ts` / `luaParser.ts` 内 |

---

## 4. 架构边界（进程模型）

```
┌──────────────────────────┐        ┌─────────────────────────────┐
│  Renderer (React SPA)    │        │  Main (Node.js 主进程)      │
│  stores + components     │  IPC   │  cdbService / fileService   │
│  不接触 Node API / 数据库 │ ─────► │  configService / imageService│
└──────────────────────────┘        └─────────────────────────────┘
        │  仅经 window.api（contextBridge）          │
┌────────▼──────────────────┐        ┌──────────────┴──────────────┐
│  Preload (contextBridge)  │        │  shared (@shared)           │
│  类型完备的 IPC 桥接层     │        │  类型 / 常量 / Lua 引擎      │
└───────────────────────────┘        └─────────────────────────────┘
```

**硬性边界**（违反即架构破坏，评审会打回）：

1. **Renderer 永远不直接 import Electron / Node / better-sqlite3**。一切宿主能力只能通过 preload 暴露的 `window.api` 调用。
2. **Preload 只做桥接，不写业务逻辑**。它实现在 `src/preload/index.ts`，类型声明在 `src/preload/index.d.ts`，形态是「与组件无关的函数签名 + `ipcRenderer.invoke` 转发」。
3. **主进程与渲染进程互相不 import 对方代码**。两者唯一共享层是 `src/shared`（`@shared`）。
4. **`@shared` 必须保持平台无关**：不 import `electron`、Node 内置模块或任何 DOM API，因为它同时被打进两个进程。`shared/engine` 下的 luaGenerator/luaParser 尤其要保持纯函数。
5. **Lua 生成与解析必须双向闭环**：修改 `luaGenerator.ts` 或 `luaParser.ts` 任一侧后，必须验证「`generateLuaScript(parse(脚本))` round-trip 语义等价」，否则用户已保存的 `.lua` 项目会失效。
6. **卡片数据与图片来自用户游戏目录**：CDB 只有只读连接 (`readonly: true`)，绝不能写入用户的 cards.cdb 或游戏目录。

---

## 5. IPC 通信（新增能力时四件套同步）

所有宿主能力新增都必须同步四处，缺一即为不完整改动：

| 步骤                  | 文件                          | 动作                                                               |
| --------------------- | ----------------------------- | ------------------------------------------------------------------ |
| ① 定义参数/返回值类型 | `src/shared/types/ipc.ts`     | 新增 XxxParams/XxxResult，并加入 `IpcApi` 接口                     |
| ② 渲染端调用入口声明  | `src/preload/index.ts`        | 在 `api` 对象里加 `xxx: () => ipcRenderer.invoke('<域>:<动作>')`   |
| ③ Preload 类型声明    | `src/preload/index.d.ts`      | 同步 `window.api` 的类型                                           |
| ④ 注册主进程 handler  | `src/main/ipc/registerIpc.ts` | `ipcMain.handle('<域>:<动作>', ...)`，业务逻辑尽量交给 services 层 |

- Channel 命名格式：`<域>:<动作>`，如 `cdb:search`、`file:export-lua`、`config:get`、`image:get-path`。域与 `services/` 目录一一对应。
- 业务逻辑写在 `src/main/services/*`，`registerIpc.ts` 只做参数校验与转发。

---

## 6. 目录结构与职责

```
src/
├── main/                       # 主进程 (Node.js)
│   ├── index.ts                #   应用入口：窗口创建、生命周期
│   ├── db/cdbService.ts        #   cards.cdb 只读访问（模块级单实例，export const cdbService）
│   ├── ipc/registerIpc.ts      #   所有 ipcMain.handle 集中注册地
│   └── services/               #   业务服务（configStore/fileService/imageService）
├── preload/                    # 安全桥接层
│   ├── index.ts                #   contextBridge 实现 IpcApi
│   └── index.d.ts              #   window.api 类型声明
├── renderer/src/               # 渲染进程 (React SPA)
│   ├── main.tsx / App.tsx      #   入口与顶层布局（Header + 三栏）
│   ├── components/             #   按功能域分目录（Board/CardDetail/CardSearch/Header/ui）
│   ├── stores/                 #   Zustand store，每个文件一个业务关注点
│   ├── lib/utils.ts            #   cn() 工具
│   └── utils/cardImage.ts      #   卡图 URL / 卡背
└── shared/                     # 双进程共享层（@shared），平台无关
    ├── types/                  #   card.ts / duel.ts / rules.ts / ipc.ts
    ├── constants/              #   locations.ts / positions.ts（ocgcore 位掩码）
    └── engine/                 #   luaGenerator.ts / luaParser.ts（Lua 双向引擎）
```

**新代码放在哪里**（不确定时按此路由，动笔前先看同域文件）：

- 新功能域组件 → `components/<域>/`，目录内平铺；仅服务单组件的子组件才进 `<域>/components/`
- 新跨进程类型 → `shared/types/`，并从 `shared/index.ts` barrel 导入（统一 `from '@shared/index'`，不要深路径）
- 新决斗业务常量/枚举 → `shared/constants/`；纯渲染层常量可放组件同文件
- 新宿主能力 → 按 第 5 节 四件套
- 新 store → `stores/useXxxStore.ts`（一个业务关注点一个文件）
- 新工具函数 → 渲染层通用放 `renderer/src/utils/`；双进程通用放 `shared/`

> 本目录树需随改动同步维护。若发现与实际代码有出入——如在分支中新增了文件——以 `ls`/读取实际文件的结果为准，并顺手更新此树。

---

## 7. 业务领域知识（Yu-Gi-Oh! / ocgcore）

### 7.1 MasterRule 与场地布局

| `masterRule` | 名称       | 场地特征                                                                                  |
| ------------ | ---------- | ----------------------------------------------------------------------------------------- |
| `2`          | MR1/2 经典 | 无 EMZ、无灵摆区，5 主怪兽区 + 5 魔陷区，额外怪兽直接进主怪兽区                           |
| `3`          | MR3 灵摆   | 同上 + 2 个**独立**灵摆区（`CardLocation.PZONE`，序号 0/1）                               |
| `4`          | MR4 新大师 | 新增 2 个 **EMZ**（MZONE 序号 5/6）；灵摆区**合并**入魔陷区 0/4 号位（`pendulumInSZone`） |
| `5`          | MR5 现行   | 同 MR4，现行规则（默认值）                                                                |

布局差异全部由 `shared/types/rules.ts` 的 `MASTER_RULES` 信息表驱动（`hasEMZ` / `hasIndependentPZones` / `pendulumInSZone` 等布尔位）。**不要在 Board 组件里写死「MR 等级 → 布局」的 if 分支，一切从信息表推导。**

### 7.2 CardLocation（区域，ocgcore 位掩码）

`0x01` DECK / `0x02` HAND / `0x04` MZONE（0~4 主怪兽区，5/6 EMZ）/ `0x08` SZONE（0~4 魔陷区，MR1-3 另有 5 号场地魔法区）/ `0x10` GRAVE / `0x20` REMOVED / `0x40` EXTRA / `0x80` OVERLAY / `0x100` FZONE / `0x200` PZONE（MR3 独立灵摆区）

### 7.3 CardPosition（表示形式）

`0x1` FACEUP_ATTACK / `0x2` FACEDOWN_ATTACK / `0x4` FACEUP_DEFENSE / `0x8` FACEDOWN_DEFENSE / `0x5` FACEUP（0x1|0x4）/ `0xa` FACEDOWN（0x2|0x8）

注意组合位：`FACEUP` 与 `FACEDOWN` 是**叠加位掩码**而非新值；`isDefense` 与 `isFacedown` 是两个独立维度（`POSITION_INFOS` 已给出每种表示形式的守备/盖伏与渲染旋转角度）。

### 7.4 关键数据结构

- `FieldCard` — 场上一张卡的运行时状态：`instanceId`（场上唯一）、`code`（卡密）、`card?`（检索到的 CdbCard 缓存，可缺省）、`controller` / `owner`、`location` + `sequence`（区域 + 格子序号）、`position`、`overlayMaterials`（超量素材存**卡密数组**）、counters / customAtk / customDef。
- `DuelPuzzleState` — 整个决斗局面快照：`version`（数据迁移用，必须随结构变更递增）、`title` / `hint`、`masterRule`、`players`（`lp/maxHand/startHand`）、`turnPlayer`、`firstTurnAttack`、`cards[]`。空局面用工厂函数 `createInitialDuelState(masterRule = 5)` 创建，不要手写对象字面量。

---

## 8. 渲染层代码规范

### 8.1 文件组织：Feature-Based 模块化

- 组件**按业务功能域**组织，不按技术角色（hooks/types/styles）拍平。功能域目录内平铺，只有**仅服务某单个组件**的私有子组件才进 `components/` 子目录：

```
Board/
├── DuelBoard.tsx
├── ZoneSlot.tsx
├── CardItem.tsx
├── CardContextMenu.tsx
└── components/          # 仅内部使用
    └── HandTray.tsx
```

- 单文件职责边界以**语义**判断：一个组件内部出现可独立复用或自成体系的片段就拆出去；一个职责单一的长组件（如 `DuelBoard.tsx`）不要为凑行数拆碎。
- 常量配置对象（如 `VARIANT_CONFIGS`）可与组件同文件。
- **严禁**为 Tailwind 类名建立独立 `.ts` 主题文件（如 `ZoneSlotTheme.ts`）。

### 8.2 命名

| 类别           | 约定                        | 示例                                       |
| -------------- | --------------------------- | ------------------------------------------ |
| React 组件文件 | PascalCase `.tsx`，具名导出 | `DuelBoard.tsx` → `export const DuelBoard` |
| 工具/常量文件  | camelCase `.ts`             | `cardImage.ts`                             |
| Store          | `use[Name]Store.ts`         | `useDuelStore.ts`                          |
| 常量导出       | UPPER_SNAKE_CASE            | `CARD_BACK_IMAGE`                          |
| 类型/接口      | PascalCase                  | `FieldCard`                                |
| CSS 变量       | kebab-case                  | `--background`                             |

### 8.3 导入导出

- 具名导出优先。不再新增 `export default`（`App.tsx` 是历史遗留，别模仿它）。
- 导入顺序：React/第三方 → `@shared/` → 本模块（stores → components → utils）。
- `@renderer` → `src/renderer/src`，`@shared` → `src/shared`。

### 8.4 样式（TailwindCSS v4, Vite 插件模式）

- 无 `tailwind.config.ts`；全局变量定义在 `src/renderer/src/assets/globals.css`（`@theme` 指令）。
- 类名**内联写在 JSX**，多条件合并用 `cn()`（`renderer/src/lib/utils.ts`）。
- `components/ui/` 下的 shadcn/ui 组件由 CLI 生成，**不要修改内部实现**，定制一律从外部 `className` 覆盖。

### 8.5 状态管理（Zustand）

- 每个 store 单一业务关注点：`useDuelStore`（场面核心，挂 `zundo` temporal 撤销/重做，`partialize: (state) => ({ state: state.state })` 只追踪局面字段）、`useConfigStore`、`useCardSearchStore`、`useContextMenuStore`。
- **业务逻辑全部放 store 的 action 内**，组件只读状态、调 action，不在 JSX/事件处理里堆业务规则。
- 会改变场面的新操作**必须走 useDuelStore 的 action**，否则无法被撤销/重做。
- 需要评估变更后局面的逻辑（如可解性检查、displays 统计）写成独立纯函数，而不是塞进 store 或组件。

---

## 9. 代码风格（由工具强制，不要手工维护规则）

Prettier（`.prettierrc.yaml`）与 ESLint（`eslint.config.mjs`）已强制：无分号、单引号、行宽 100、无尾逗号。**提交前跑 `pnpm format`，风格问题不要手工争论。**

需要人工遵守、工具管不着的：

- TypeScript `strict` 模式，所有函数（包括组件）显式返回类型。
- 注释记录**非显而易见的约束与理由**（如「为什么只读打开 cdb」「为什么 partialize 只追踪 state.state」），不写"复述代码"式注释。

---

## 10. 行为边界（Agent 执行约束）

### Ask first（先询问，再动手）

- 引入任何新的 npm 依赖（每个依赖都会进 Electron 产物体积与安全面）。
- 跨功能域的大规模重构、移动/重命名共享类型或 `DuelPuzzleState` 结构变更。
- 修改 Electron 安全相关配置（`sandbox`、`contextIsolation`、`webPreferences`、CSP、window.open 行为）。
- 补测试框架、CI 流程或新的构建脚本。

### Never（禁止）

- 修改 `src/renderer/src/components/ui/` 内任何文件（shadcn/ui CLI 产物）。
- **硬编码卡密/卡表/卡图数据**进仓库，或将用户的 `cards.cdb` / 游戏目录路径写入任何文件（一切路径来自 configService 的用户配置）。
- 让 `shared/` 引入 electron / node / DOM 依赖，或在 renderer 直接读文件/数据库。
- 跳过 store 直接改局面状态，绕开 `temporal` 中间件。
- 生成/修改 Lua 引擎后不验证 round-trip 就提交。
- 编造 `pnpm test` 等不存在的命令；提交时将 typecheck/lint 错误归咎为「本来就存在」而不报备。
- 提交 secrets、token 或任何凭证。

---

## 11. 变更检查清单（收尾自检）

- [ ] `pnpm typecheck` 双端零错误，`pnpm lint` 无本次改动引入的错误
- [ ] 新文件落在正确的功能域/共享层目录（对照第 6 节路由）
- [ ] 新增 IPC 能力四件套齐全（第 5 节 ①②③④）
- [ ] 新类型放 `shared/types/` 并经 `@shared` barrel 导出；新枚举用内置常量而非魔法数字
- [ ] 场面相关操作封装为 store action，撤销/重做正常
- [ ] 触及 Lua 引擎 → 已验证 generate ↔ parse round-trip
- [ ] 触及 `MASTER_RULES` / 场地结构 → MR2~MR5 各状态在 dev 窗口实际切过一遍
- [ ] 目录结构注释、存在的注释与文档未被意外删除；如架构变化，同步更新本文件
