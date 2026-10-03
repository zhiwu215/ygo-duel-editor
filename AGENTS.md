# YGO Duel Editor — 项目规范与 AI Agent 指引

> 本文件是 AI Agent（Claude Code、Gemini Antigravity、Cursor 等）在修改本项目代码时**必须遵守**的规范。

---

## 项目简介

**YGO Duel Editor** 是一个用于可视化编辑游戏王 (Yu-Gi-Oh!) 残局 / 剧情决斗脚本的桌面应用。用户通过拖拽卡片到决斗场地上、配置双方手牌和生命值，最终导出符合 ocgcore 标准的 Lua 残局脚本。

---

## 技术栈

| 层        | 技术                            | 版本要求                                     |
| --------- | ------------------------------- | -------------------------------------------- |
| 框架      | Electron + electron-vite        | Electron 39+, electron-vite 5+               |
| 前端      | React + TypeScript              | React 19+, TS 5.7+                           |
| 样式      | TailwindCSS v4 (Vite 插件模式)  | `@tailwindcss/vite`                          |
| 状态管理  | Zustand + Zundo (撤销/重做)     | Zustand 5+, Zundo 2+                         |
| 动画      | Framer Motion                   | v13+                                         |
| 图标      | Lucide React                    | —                                            |
| UI 组件库 | shadcn/ui (手动管理)            | —                                            |
| 数据库    | better-sqlite3 (读取 cards.cdb) | —                                            |
| 包管理    | pnpm                            | —                                            |
| 代码风格  | Prettier + ESLint               | 见 `.prettierrc.yaml` 和 `eslint.config.mjs` |

---

## 目录结构与职责

```
src/
├── main/                       # Electron 主进程 (Node.js 运行时)
│   ├── index.ts                #   应用入口：窗口创建、生命周期管理
│   ├── db/                     #   数据库层（SQLite / cards.cdb 操作）
│   │   └── cdbService.ts       #     CDB 数据库服务（单例模式）
│   ├── ipc/                    #   IPC 通信层（注册所有主进程处理器）
│   │   └── registerIpc.ts      #     统一注册所有 ipcMain.handle
│   └── services/               #   业务服务层
│       ├── configService.ts    #     应用配置持久化服务
│       └── fileService.ts      #     文件导入 / 导出服务（Lua 读写）
│
├── preload/                    # 预加载脚本（安全暴露 API 到渲染进程）
│   ├── index.ts                #   contextBridge 暴露的 API 实现
│   └── index.d.ts              #   window.api 的 TypeScript 类型声明
│
├── renderer/src/               # 渲染进程 (React SPA)
│   ├── main.tsx                #   ReactDOM 入口 + ErrorBoundary
│   ├── App.tsx                 #   顶层布局组合（Header + 三栏面板）
│   ├── assets/                 #   静态资源
│   │   ├── globals.css         #     全局 CSS（Tailwind 基础层、CSS 变量）
│   │   └── textures/           #     本地纹理图片（卡背、场地背景等）
│   ├── components/             #   React 组件（按业务功能域分目录）
│   │   ├── Board/              #     决斗场地核心组件
│   │   ├── CardDetail/         #     卡片详情面板
│   │   ├── CardSearch/         #     卡片搜索面板
│   │   ├── Header/             #     顶部工具栏
│   │   └── ui/                 #     shadcn/ui 基础 UI 组件（勿手动修改）
│   ├── stores/                 #   Zustand 状态管理
│   │   ├── useDuelStore.ts     #     决斗场面状态（核心）
│   │   ├── useConfigStore.ts   #     应用配置状态
│   │   ├── useCardSearchStore.ts #   卡片搜索状态
│   │   └── useContextMenuStore.ts #  右键菜单状态
│   ├── lib/                    #   工具函数库
│   │   └── utils.ts            #     cn() 工具函数（来自 'cn' 包）
│   └── utils/                  #   业务工具函数
│       └── cardImage.ts        #     卡图 URL 生成、卡背图引用
│
└── shared/                     # 跨进程共享代码（主进程 + 渲染进程通用）
    ├── index.ts                #   统一 barrel export（所有 shared 的对外接口）
    ├── types/                  #   TypeScript 类型定义
    │   ├── card.ts             #     CdbCard、CardType、CardUtils 等
    │   ├── duel.ts             #     FieldCard、DuelPuzzleState 等
    │   ├── rules.ts            #     MasterRule、MASTER_RULES 规则配置
    │   └── ipc.ts              #     IPC 通信参数 / 返回值类型
    ├── constants/              #   常量定义
    │   ├── locations.ts        #     CardLocation 枚举
    │   └── positions.ts        #     CardPosition 枚举
    └── engine/                 #   Lua 脚本引擎
        ├── luaGenerator.ts     #     DuelPuzzleState → Lua 脚本生成
        └── luaParser.ts        #     Lua 脚本 → DuelPuzzleState 解析
```

---

## 核心开发规范

### 1. 文件组织：Feature-Based 模块化

- **按业务功能域（feature）组织组件**，而非按技术角色（如 `hooks/`、`types/`、`styles/`）拍平。
- 每个功能域对应 `components/` 下的一个目录（如 `Board/`、`CardSearch/`）。
- 功能域目录内的文件直接平铺在目录根部。仅当出现**仅服务于该域内某个组件的子组件**时，才放入 `components/` 子目录。
  ```
  Board/
  ├── DuelBoard.tsx          # 主组件
  ├── ZoneSlot.tsx            # 域内核心组件（平铺）
  ├── CardItem.tsx            # 域内核心组件（平铺）
  ├── CardContextMenu.tsx     # 域内核心组件（平铺）
  └── components/             # 仅内部使用的子组件
      └── HandTray.tsx
  ```

### 2. 单文件职责与长度

- 拆分文件的依据是**语义边界与单一职责**，而非硬性行数限制。一个文件只做一件事：一个组件、一组紧密相关的常量、一个 store。
- 如果一个组件内部出现了**可独立复用的 UI 片段**或**逻辑上自成体系的子功能**，即使行数不多也应该拆分出去。
- 反之，如果一个文件虽然较长但逻辑连贯、职责单一（如 `DuelBoard.tsx` 渲染完整场地布局），则不必强行拆分。
- 常量配置对象（如 `VARIANT_CONFIGS`）**可以与组件放在同一文件中**，只要它们服务于该组件。
- **不要创建独立的样式主题文件**（如 `ZoneSlotTheme.ts`）来存放 Tailwind 类名字符串。Tailwind 类应**始终写在使用它们的组件 JSX 中**，与组件内联共置。

### 3. 命名规范

| 类别                | 约定                       | 示例                              |
| ------------------- | -------------------------- | --------------------------------- |
| React 组件文件      | PascalCase `.tsx`          | `DuelBoard.tsx`, `ZoneSlot.tsx`   |
| 工具函数 / 常量文件 | camelCase `.ts`            | `cardImage.ts`, `utils.ts`        |
| Zustand Store       | `use[Name]Store.ts`        | `useDuelStore.ts`                 |
| 类型定义文件        | camelCase `.ts`            | `card.ts`, `duel.ts`              |
| React 组件导出      | 具名导出，PascalCase       | `export const DuelBoard`          |
| 工具函数导出        | 具名导出，camelCase        | `export function getCardImageUrl` |
| 常量导出            | 具名导出，UPPER_SNAKE_CASE | `export const CARD_BACK_IMAGE`    |
| 类型 / 接口         | PascalCase                 | `FieldCard`, `CdbCard`            |
| CSS 变量            | kebab-case                 | `--background`, `--card`          |

### 4. 导入导出约定

- **具名导出优先**，避免 `export default`（`App.tsx` 的默认导出是历史原因，不再增加新的默认导出）。
- `@shared/index.ts` 作为 shared 层的 **barrel export**，渲染进程和主进程统一通过 `from '@shared/index'` 导入。
- 路径别名：
  - `@shared` → `src/shared`
  - `@renderer` → `src/renderer/src`
- 导入顺序：
  1. React / 第三方库
  2. `@shared/` 共享模块
  3. 相对路径的本项目模块（stores → 组件 → utils）

### 5. 样式约定（TailwindCSS v4）

- 本项目使用 **TailwindCSS v4 Vite 插件模式**（`@tailwindcss/vite`），**不使用 `tailwind.config.ts`**。
- 全局 CSS 变量定义在 `src/renderer/src/assets/globals.css` 中（使用 `@theme` 指令）。
- **类名内联书写**，条件合并使用 `cn()` 函数（来自 `src/renderer/src/lib/utils.ts`，底层为 `cn` npm 包）。
- **严禁**将 Tailwind 类名提取到独立 `.ts` 主题文件中。
- `components/ui/` 下的组件来自 **shadcn/ui**，由 CLI 生成，**不要手动修改其内部实现**。如需定制，通过 `className` 属性从外部覆盖。

### 6. 状态管理（Zustand）

- 每个 store 文件对应一个独立的业务关注点：
  - `useDuelStore` — 决斗场面核心状态 + 卡片操作 action
  - `useConfigStore` — 应用配置（cdb 路径、游戏目录等）
  - `useCardSearchStore` — 搜索关键字、过滤条件、搜索结果
  - `useContextMenuStore` — 右键菜单坐标 + 目标卡片
- **所有 action 在 store 内部定义**，组件只调用 `store.actionName()`，不在组件内写业务逻辑。
- `useDuelStore` 使用 `zundo` 的 `temporal` 中间件实现撤销/重做，`partialize` 只追踪 `state` 字段变化。

### 7. Electron IPC 通信

- 所有 IPC handler 集中注册在 `src/main/ipc/registerIpc.ts`。
- 渲染进程通过 `window.api.xxx()` 调用，类型声明在 `src/preload/index.d.ts`。
- IPC 参数和返回值类型定义在 `src/shared/types/ipc.ts`。

### 8. 代码风格

- **不使用分号**（Prettier `semi: false`）。
- **使用单引号**（Prettier `singleQuote: true`）。
- **行宽 100 字符**（Prettier `printWidth: 100`）。
- **不使用尾逗号**（Prettier `trailingComma: none`）。
- 函数组件统一使用 `React.FC<Props>` 或箭头函数 + 显式返回类型。
- TypeScript 严格模式（`strict: true`），所有函数应有显式返回类型声明。

---

## 业务领域知识（Yu-Gi-Oh! 决斗）

### 关键概念

| 术语                | 说明                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **MasterRule (MR)** | 游戏规则版本（1~5），决定场地布局和灵摆区域机制                                                                   |
| **CardLocation**    | 卡片所在区域枚举：MZONE(怪兽区)、SZONE(魔陷区)、HAND(手牌)、DECK(卡组)、GRAVE(墓地)、EXTRA(额外)、REMOVED(除外)等 |
| **CardPosition**    | 卡片表示形式：FACEUP_ATTACK(表攻)、FACEUP_DEFENSE(表守)、FACEDOWN_DEFENSE(里守)、FACEDOWN(盖放)                   |
| **EMZ**             | 额外怪兽区 (Extra Monster Zone)，仅 MR4/MR5 存在，序号 5 和 6                                                     |
| **灵摆区**          | MR3 有独立灵摆区 (PZONE)；MR4/MR5 的灵摆区复用魔陷区 0 号和 4 号位                                                |
| **CDB**             | `cards.cdb`，SQLite 格式的卡片数据库（包含卡名、效果、攻防等）                                                    |
| **FieldCard**       | 场上一张卡的完整运行时状态（卡密、控制者、位置、表示形式、超量素材等）                                            |
| **DuelPuzzleState** | 整个残局局面的快照（双方生命值、所有卡片、规则版本等）                                                            |

### 场地布局规则

- **MR1/MR2** — 5 主怪兽区 + 5 魔陷区 + 场地魔法 + 卡组 + 墓地 + 额外卡组。无 EMZ、无灵摆区。
- **MR3** — 同上 + 2 个**独立灵摆区** (`CardLocation.PZONE`, 序号 0/1)。
- **MR4** — 同 MR1 + 2 个 **EMZ** (序号 5/6)。灵摆区复用魔陷区 0/4 号位。
- **MR5** — 同 MR4（现行规则）。

### 控制者 (controller)

- `0` = 我方 (玩家)
- `1` = 对方 (AI / 剧情对手)

---

## 变更检查清单

在提交任何代码修改前，确认以下事项：

- [ ] 新文件是否放在了正确的功能域目录下？
- [ ] 文件职责是否单一？是否存在可以独立复用的子组件或逻辑应当拆分？
- [ ] 是否使用了具名导出？是否有不必要的 `export default`？
- [ ] Tailwind 类名是否直接写在组件 JSX 内？（不要提取到独立 `.ts` 主题文件中）
- [ ] 是否修改了 `components/ui/` 下的 shadcn/ui 组件源码？（不应修改）
- [ ] 新增的类型是否放在了 `src/shared/types/` 中？
- [ ] 新增的 IPC handler 是否在 `registerIpc.ts` 中注册？
- [ ] `pnpm typecheck` 是否通过（Node + Web 双端零错误）？
- [ ] 现有注释和文档是否被意外删除？
