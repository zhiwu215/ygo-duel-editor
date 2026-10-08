# YGO Duel Editor

面向三类创作场景：



| 场景                 | 说明                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **残局布场**         | 摆出残局/教程局面的双方场地、手牌与生命值，一键导出可直接在 YGOPro 系客户端运行的对局脚本 |
| **同人剧情对局编排** | 编排多段剧情：开场白、事件触发、多回合推演（开发中）                                      |
| **卡组 Combo 教学**  | 演示卡组起手与做场路线，分步骤讲解（规划中）                                              |

## 素材致谢

本项目灵感源自这个[帖子](https://tieba.baidu.com/p/5058837572?fr=undefined)，我找到了吧友囧囧·D·路飞的PuzzleEditor，项目并无源码，所以直接参考功能点开发，同时进行跨额外拓展

本项目游戏相关素材取自以下项目：

- [YGOPro](https://github.com/Fluorohydride/ygopro)
- [MDPro3](https://code.moenext.com/sherry_chaos/MDPro3/-/tree/master)
- [EDOPro](https://tieba.baidu.com/p/7454495011)

> 本项目仅作学习与创作用途。**如有问题，创作者可联系我删除**

## 开发

```bash
# 安装依赖
$ pnpm install

# 开发模式（Electron + HMR）
$ pnpm dev

# 类型检查（Node 侧 + Web 侧）
$ pnpm typecheck

# 代码检查与格式化
$ pnpm lint
$ pnpm format

# 打包
$ pnpm build:win    # Windows
$ pnpm build:mac    # macOS
$ pnpm build:linux  # Linux
```

## 技术栈

Electron 39 + electron-vite 5 · React 19 + TypeScript · TailwindCSS v4 · Zustand 5 + zundo（撤销/重做）· better-sqlite3（cards.cdb 只读）

## 支持作者

如果这个项目对你的创作有帮助，欢迎通过爱发电支持作者：

**<https://afdian.com/a/zhiwu215>**

> 爱发电仅用于自愿支持，**不影响任何功能**。本项目全部功能对所有用户完整开放，不存在付费解锁、阉割版或功能限制。支持与否完全由你决定，不支持也完全不影响使用。
