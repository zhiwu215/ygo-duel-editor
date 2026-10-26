# ygo决斗编辑器（YGO Duel Editor）

## 使用场景

- 残局布置
- 同人剧情的决斗编排

## 使用说明

1. [安装和基本界面](docs/使用教程/01安装和基本界面.md)
2. [界面与核心概念](docs/使用教程/02界面与核心概念.md)
3. [布置盘面](docs/使用教程/03布置盘面.md)
4. [台本文本与文本库](docs/使用教程/04台本文本与文本库.md)
5. [卡片图鉴与自定义卡片](docs/使用教程/05卡片图鉴与自定义卡片.md)
6. [游戏测试与回放](docs/使用教程/06游戏测试与回放.md)
7. [背后灵](docs/使用教程/07背后灵.md)

## 技术栈

| 技术              | 说明                                       | 官网                                                |
| ----------------- | ------------------------------------------ | --------------------------------------------------- |
| Electron 39       | 跨平台桌面应用框架                         | https://www.electronjs.org/                         |
| electron-vite 5   | Electron 项目的 Vite 集成与构建工具        | https://electron-vite.org/                          |
| React 19          | UI 框架                                    | https://react.dev/                                  |
| TypeScript 5      | JavaScript 的类型化超集                    | https://www.typescriptlang.org/                     |
| TailwindCSS 4     | 原子化 CSS 框架                            | https://tailwindcss.com/                            |
| shadcn/ui         | 无样式可复制组件库                         | https://ui.shadcn.com/                              |
| Base UI           | React 无头组件原语库（shadcn/ui 底层依赖） | https://base-ui.com/                                |
| Radix UI          | React 无头组件原语库（shadcn/ui 的另一底层依赖） | https://www.radix-ui.com/                       |
| Zustand 5         | 轻量级状态管理                             | https://zustand-demo.pmnd.rs/                       |
| zundo             | Zustand 的撤销/重做中间件                  | https://github.com/charkour/zundo                   |
| better-sqlite3    | 同步式 SQLite 客户端                       | https://github.com/WiseLibs/better-sqlite3          |
| sql.js            | 纯 WASM 的 SQLite 实现（前端/只读场景）     | https://github.com/sql-js/sql.js                    |
| koishipro-core.js | YGOPro 决斗核心（ocgcore）的 WASM 封装     | https://github.com/purerosefallen/koishipro-core.js |
| ygopro-msg-encode | YGOPro 决斗协议编解码库                    | https://github.com/purerosefallen/ygopro-msg-encode |
| ygopro-yrp-encode | YGOPro 对局录像（YRP）文件编解码库         | https://www.npmjs.com/package/ygopro-yrp-encode     |
| ygopro-yrp3d-encode | YGOPro 3D 录像（YRP3D）文件编解码库       | https://www.npmjs.com/package/ygopro-yrp3d-encode   |
| ygopro-cdb-encode | YGOPro 卡库（CDB）文件编解码库              | https://www.npmjs.com/package/ygopro-cdb-encode     |
| @cjser/lzma1      | 纯 JS 的 LZMA 压缩/解压（YRP 文件体压缩）  | https://www.npmjs.com/package/@cjser/lzma1          |
| framer-motion     | React 动画库                               | https://motion.dev/                                 |
| @dnd-kit          | React 拖拽交互套件                         | https://dndkit.com/                                 |
| react-markdown    | Markdown 渲染组件（配合 remark-gfm）       | https://github.com/remarkjs/react-markdown          |
| remark-cjk-friendly | Markdown 的 CJK 友好分词插件              | https://www.npmjs.com/package/remark-cjk-friendly    |
| Lucide React      | 简洁的开源图标库                           | https://lucide.dev/                                 |
| electron-builder  | Electron 应用打包工具                      | https://www.electron.build/                         |
| Pi Coding Agent   | Pi Agent 的 SDK                            | https://pi.dev/docs/latest/sdk                      |

## 开发

```bash
# 安装依赖
pnpm install

# 运行
pnpm dev
```

## 交流群

QQ 交流群：**1126832557**

## 支持作者

如果这个项目对你的创作有帮助，欢迎通过爱发电支持作者：

**<https://afdian.com/a/zhiwu215>**

> 爱发电仅用于自愿支持，**不影响任何功能**。本项目全部功能对所有用户完整开放，不存在付费解锁、阉割版或功能限制。支持与否完全由你决定，不支持也完全不影响使用。

## 素材致谢

**灵感来源：**

本项目灵感源自这个[帖子](https://tieba.baidu.com/p/5058837572?fr=undefined)，我找到了吧友囧囧·D·路飞的 PuzzleEditor，项目并无源码，所以直接参考功能点开发，同时进行额外拓展

**本项目素材或代码灵感来自：**

- [ygopro](https://github.com/Fluorohydride/ygopro)
- [MDPro3](https://code.moenext.com/sherry_chaos/MDPro3/-/tree/master)
- [EDOPro](https://github.com/knight00/KCGEdopro)，具体是这个[贴子](https://tieba.baidu.com/p/7454495011)
- [neos-ts](https://github.com/DarkNeos/neos-ts)
- [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)

> 本项目仅作学习与创作用途。**素材引用如有侵权，创作者可联系我删除**
