# ygo决斗编辑器（YGO Duel Editor）

> 注意：
>
> 目前项目还没有发布正式版，所以会有很多问题，比如：AI功能没有完善、ui显示会有问题、ocg校验不够适配等
>
> 所以现在只能作为一个拖动卡片布置到场上的编辑器

## 使用场景

- 残局布置
- 同人剧情的决斗编排
- 卡组Combo教学

## 使用说明

### 选择游戏目录

首次启动后到 `设置 → 路径` 选择你的 YGOPro 客户端根目录。只有选了之后卡图与卡密解析才能正常工作。



## 技术栈

| 技术 | 说明 | 官网 |
| --- | --- | --- |
| Electron 39 | 跨平台桌面应用框架 | https://www.electronjs.org/ |
| electron-vite 5 | Electron 项目的 Vite 集成与构建工具 | https://electron-vite.org/ |
| React 19 | UI 框架 | https://react.dev/ |
| TypeScript 5 | JavaScript 的类型化超集 | https://www.typescriptlang.org/ |
| TailwindCSS 4 | 原子化 CSS 框架 | https://tailwindcss.com/ |
| shadcn/ui | 无样式可复制组件库 | https://ui.shadcn.com/                     |
| Zustand 5 | 轻量级状态管理 | https://zustand-demo.pmnd.rs/ |
| zundo | Zustand 的撤销/重做中间件 | https://github.com/charkour/zundo |
| better-sqlite3 | 同步式 SQLite 客户端 | https://github.com/WiseLibs/better-sqlite3 |
| ocgcore-wasm | ocgcore 决斗引擎的 WebAssembly 移植 | https://github.com/mycard/ygopro-core |
| @dnd-kit | React 拖拽交互套件 | https://dndkit.com/ |
| Lucide React | 简洁的开源图标库 | https://lucide.dev/ |
| electron-builder | Electron 应用打包工具 | https://www.electron.build/ |
| Pi Coding Agent | Pi Agent 的 SDK | https://github.com/badlogicstudios/pi-mono |

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

**本项目游戏相关素材取自：**

- [YGOPro](https://github.com/Fluorohydride/ygopro)
- [MDPro3](https://code.moenext.com/sherry_chaos/MDPro3/-/tree/master)
- [EDOPro](https://tieba.baidu.com/p/7454495011)

**AI供应商图标相关素材取自：**

- [ZCode](https://github.com/zai-org/ZCode)

> 本项目仅作学习与创作用途。**如有问题，创作者可联系我删除**
