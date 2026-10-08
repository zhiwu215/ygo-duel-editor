# AGENTS.md

> 本文件是 AI 编码代理（Claude Code、Codex、Cursor 等）修改本仓库时必须遵守的工作规范。

YGO Duel Editor：游戏王决斗内容创作桌面应用（Electron + React），可视化摆双方场面并导入/导出符合 ocgcore 标准的 Lua 残局脚本。卡片数据与卡图均来自用户本地游戏目录，仓库不内置。

## 架构边界

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

- 组件统一使用 shadcn/ui（base-ui 版，`components/ui/`）。**禁用原生 `confirm()`/`alert()`/`prompt()` 与裸写 `<select>`/`<input type=file>`**；弹窗走 `useDialogStore`，文件选择走主进程 IPC。
- Renderer 永不直接 import `electron` / `node` / `better-sqlite3`；宿主能力只经 `window.api`。`@shared` 必须平台无关（不引 electron/node/DOM）。

## 命令

- `pnpm dev` 开发模式（electron-vite，带 HMR）
- `pnpm typecheck` 双端类型检查（Node + Web），改动后必须零错误
- `pnpm exec eslint <本次改动的文件>` 只 lint 改动文件（**禁止 `pnpm lint` / `eslint .` 全仓扫描**——会扫到根目录下的参考子仓库，极慢）
- `pnpm exec prettier --write <file>` 格式化单文件（勿全仓 `prettier`）

## 硬性规则

- **禁止 `rm -rf node_modules`、手动 `mv`/`cp` 改写 `node_modules` 下目录**（pnpm 硬链接跨项目共享，会破坏其他项目）。依赖损坏统一 `pnpm install --force --offline`。
- **代码不写注释**（行内/JSDoc 一律不要；仅 `// @ts-ignore`、`// eslint-disable-next-line` 等指令例外）。
- **Lua 引擎改任一侧后必须验证 `generateLuaScript(parse(脚本))` round-trip 语义等价**，否则用户已保存 `.lua` 失效。
- 新 IPC 能力四件套同步：`shared/types/ipc.ts` → `preload/index.ts` → `preload/index.d.ts` → `main/ipc/registerIpc.ts`。
- 改变场面的操作必须走 `useDuelStore` action（保留撤销/重做）；CDB 只读，绝不写用户 `cards.cdb`。

## Ask first（先问再做）

- 引入新 npm 依赖
- 跨域大规模重构 / 改 `DuelPuzzleState` 结构 / 改 Electron 安全配置（sandbox、CSP、`webPreferences` 等）
- 补测试框架 / CI / 新构建脚本

## Git

用户明确要求才提交/push；标题简短中文，参考仓库既有风格；只提交本次任务归属的改动，勿带入他人 WIP。

## 收尾自检

- [ ] `pnpm typecheck` 双端零错误；`pnpm exec eslint <本次改动的文件>` 零错误（禁 `pnpm lint`）
- [ ] 无原生控件/弹窗残留；通用 UI 复用 `components/ui/`
- [ ] 新文件落在正确功能域/共享层；新类型经 `@shared` barrel 导出，新枚举用内置常量而非魔法数字
- [ ] 触及 Lua 引擎 → round-trip 已验证
- [ ] 触及依赖 → `pnpm dev` 完整构建成功，无 `node_modules.*` 事故目录残留
