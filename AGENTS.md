# AGENTS.md

> 本文件是 AI 编码代理（Claude Code、Codex、Cursor 等）修改本仓库时必须遵守的工作规范。

YGO Duel Editor：游戏王决斗内容创作桌面应用（Electron + React），可视化摆双方场面并导入/导出符合 ocgcore 标准的 Lua 残局脚本。卡片数据与卡图均来自用户本地游戏目录，仓库不内置。

## 架构边界

- 组件统一使用 shadcn/ui，没有相关组件就去官方寻找使用
- 交互设计严格遵循 [`design-invariants.md`](docs/rules/design-invariants.md)，每次更新都需确保这些交互和设计正常

## 命令

- `pnpm dev` 开发模式
- `pnpm typecheck` 双端类型检查（Node + Web），改动后必须零错误
- `pnpm exec eslint <本次改动的文件>` 只 lint 改动文件（**禁止 `pnpm lint` / `eslint .` 全仓扫描**——会扫到根目录下的参考子仓库，极慢）
- `pnpm exec prettier --write <file>` 格式化单文件（勿全仓 `prettier`）

## 硬性规则

- **代码不写注释**（行内/JSDoc 一律不要；仅 `// @ts-ignore`、`// eslint-disable-next-line` 等指令例外）。
- **交互改动必须符合 [`design-invariants.md`](docs/rules/design-invariants.md)**：严禁破坏既有交互设计。
- 新 IPC 能力四件套同步：`shared/types/ipc.ts` → `preload/index.ts` → `preload/index.d.ts` → `main/ipc/registerIpc.ts`。

## Ask first（先问再做）

- 引入新 npm 依赖
- 跨域大规模重构 / 改 `DuelPuzzleState` 结构 / 改 Electron 安全配置（sandbox、CSP、`webPreferences` 等）
- 补测试框架 / CI / 新构建脚本

## Git

用户明确要求才提交/push；标题简短中文，参考仓库既有风格；只提交本次任务归属的改动，勿带入他人 WIP。

## 收尾自检

- [ ] `pnpm typecheck` 双端零错误；`pnpm exec eslint <本次改动的文件>` 零错误（禁 `pnpm lint`）
- [ ] 交互对照 [`design-invariants.md`](docs/rules/design-invariants.md) 防退化清单
- [ ] 无原生控件/弹窗残留；通用 UI 复用 `components/ui/`
- [ ] 新文件落在正确功能域/共享层；新类型经 `@shared` barrel 导出，新枚举用内置常量而非魔法数字
- [ ] 触及 Lua 引擎 → round-trip 已验证
- [ ] 触及依赖 → `pnpm dev` 完整构建成功，无 `node_modules.*` 事故目录残留

