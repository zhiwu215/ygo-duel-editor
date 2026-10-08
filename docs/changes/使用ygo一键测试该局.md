# 游戏王决斗编辑器：使用 ygo 一键测试该局（Ctrl+T）

> **需求**：参考项目 PuzzleEditor（作者：解夏）拥有「使用默认ygo测试该局 Ctrl+T」能力——摆好局面后一键拉起 YGOPro 直接进入对局测试。本项目此前只能「导出 Lua 脚本 → 手动导入游戏」两步走，链路断裂。
> **实现选择**：不写游戏插件、不往游戏目录塞文件，走 **ygopro 原生命令行入口** `-s <脚本路径>`；脚本落在编辑器应用数据目录的临时位置，游戏以分离子进程启动。
> **参考出处**：ygopro 完整源码（`D:\Codes\ygopro\ygopro`）`gframe.cpp` 命令行解析与 `single_mode.cpp` 单人模式加载逻辑。
> **为什么不能照搬 PuzzleEditor**：它是独立外部工具，需要在自身菜单里另设「默认 ygo 路径」，且实现细节不可见；本项目设置里已有 **gameDirectory**（ygopro.exe 所在游戏根目录，卡库/卡图都依赖它），直接复用即可，无需新增任何配置项。

---

## 原理：ygopro 本身就预留了命令行直达入口

查证源码得到两个关键事实：

**其一**，`gframe.cpp:167-177` 解析命令行，遇到 `-s` 时等价于替玩家点了两下按钮——先点主菜单的「单人模式」（btnSingleMode），再点「载入单人剧本」（btnLoadSinglePlay）：

```diff
 } else if(!std::wcscmp(wargv[i], L"-s")) { // Single
     ygo::mainGame->exit_on_return = !keep_on_return;
     ++i;
     if(i < wargc) {
         ygo::mainGame->open_file = true;
         BufferIO::CopyWideString(wargv[i], ygo::mainGame->open_file_name);
     }
     ClickButton(ygo::mainGame->btnSingleMode);
     if(ygo::mainGame->open_file)
         ClickButton(ygo::mainGame->btnLoadSinglePlay);
 }
```

**其二**，`single_mode.cpp:71-80` 加载脚本时**先原样尝试传入路径（绝对路径天然可用）**，失败才回落 `./single/<名>`：

```diff
 if(mainGame->open_file) {
     mainGame->open_file = false;
     slen = BufferIO::EncodeUTF8(mainGame->open_file_name, filename);
     if(!preload_script(pduel, filename)) {
         wchar_t fname[256]{};
         myswprintf(fname, L"./single/%ls", mainGame->open_file_name);
         slen = BufferIO::EncodeUTF8(fname, filename);
         if(!preload_script(pduel, filename))
             slen = 0;
     }
```

结论：脚本可以放在**任意位置**（不必写进游戏目录污染卡池列表），只要进程工作目录是游戏根目录（保证游戏的相对资源如 `script/`、`cards.cdb` 正常加载），`ygopro.exe -s <绝对路径>` 即可一步进对局。

## 开发者思考脉络与代码改动

### 第一步：主进程启动能力（**src/main/services/fileService.ts**）

- **思考与改动缘由**：
  生成 Lua 前需要给缺少 `card` 详情的场上卡补全 cdb 数据——这段逻辑与 exportLuaFile 内联的那段完全重复，于是抽成私有方法 completeCardDetails 供两处复用。
  exe 定位不能写死 ygopro.exe：各发行版（KoishiPro、EDOPro 等）可执行文件名不同，先试惯例名，再对根目录做一层文件名兜底扫描（匹配 ygo/gopro/pro 结尾的 exe）。
  脚本落盘用**固定目录 + 标题命名 + 覆盖式写入**：反复测试同一局面不会堆积文件；进程用 detached + stdio ignore + unref，编辑器不持有子进程句柄，编辑器关闭也不影响游戏。

**src/main/services/fileService.ts**

```diff
-import { dialog, BrowserWindow, shell } from 'electron'
+import { dialog, BrowserWindow, shell, app } from 'electron'
+import { spawn } from 'child_process'
```

```diff
+  private completeCardDetails(state: DuelPuzzleState): void {
+    const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
+    if (missingCardCodes.length > 0 && cdbService.isReady()) {
+      const cardMap = cdbService.getCardsByIds(missingCardCodes)
+      for (const c of state.cards) {
+        if (!c.card && cardMap[c.code]) {
+          c.card = cardMap[c.code]
+        }
+      }
+    }
+  }
+
+  private locateYgoproExe(gameDir: string): string | null {
+    const candidates = [join(gameDir, 'ygopro.exe'), join(gameDir, 'ygopro')]
+    for (const p of candidates) {
+      if (existsSync(p)) return p
+    }
+    try {
+      for (const file of readdirSync(gameDir)) {
+        if (/(ygo|gopro|pro)\.exe$/i.test(file)) {
+          return join(gameDir, file)
+        }
+      }
+    } catch {
+      return null
+    }
+    return null
+  }
+
+  public testInYgo(state: DuelPuzzleState): {
+    success: boolean
+    exePath?: string
+    scriptPath?: string
+    errorCode?: 'no-game-directory' | 'ygopro-not-found'
+    error?: string
+  } {
+    const gameDir = configService.get().gameDirectory
+    if (!gameDir) {
+      return { success: false, errorCode: 'no-game-directory' }
+    }
+
+    const exePath = this.locateYgoproExe(gameDir)
+    if (!exePath) {
+      return { success: false, errorCode: 'ygopro-not-found', error: gameDir }
+    }
+
+    try {
+      this.completeCardDetails(state)
+      const luaContent = generateLuaScript(state)
+
+      const dir = join(app.getPath('userData'), 'ygo-test')
+      mkdirSync(dir, { recursive: true })
+      const name = state.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'puzzle'
+      const scriptPath = join(dir, `${name}.lua`)
+      writeFileSync(scriptPath, luaContent, 'utf-8')
+
+      const child = spawn(exePath, ['-s', scriptPath], {
+        cwd: gameDir,
+        detached: true,
+        stdio: 'ignore'
+      })
+      child.unref()
+
+      console.log(`[FileService] Launched ${exePath} -s ${scriptPath}`)
+      return { success: true, exePath, scriptPath }
+    } catch (err) {
+      console.error('[FileService] Test in ygo failed:', err)
+      return { success: false, error: err instanceof Error ? err.message : String(err) }
+    }
+  }
```

exportLuaFile 原地瘦身为复用补全方法：

```diff
-      const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
-      if (missingCardCodes.length > 0 && cdbService.isReady()) {
-        const cardMap = cdbService.getCardsByIds(missingCardCodes)
-        for (const c of state.cards) {
-          if (!c.card && cardMap[c.code]) {
-            c.card = cardMap[c.code]
-          }
-        }
-      }
+      this.completeCardDetails(state)
```

### 第二步：IPC 三层接线（**src/shared/types/ipc.ts** / **src/main/ipc/registerIpc.ts** / **src/preload/index.ts**）

- **思考与改动缘由**：
  失败原因必须让渲染端可区分，否则「没配置目录」与「目录里没有 exe」只能弹同一句无指向的报错。故返回值带 errorCode 枚举，渲染端据此分别引导去设置页或提示检查目录。同步 handler 直接返回值，无需 async。

**src/shared/types/ipc.ts**

```diff
   exportLuaFile: (
     state: DuelPuzzleState,
     targetPath?: string
   ) => Promise<{ success: boolean; filePath?: string; error?: string }>
+  testInYgo: (
+    state: DuelPuzzleState
+  ) => Promise<{
+    success: boolean
+    exePath?: string
+    scriptPath?: string
+    errorCode?: 'no-game-directory' | 'ygopro-not-found'
+    error?: string
+  }>
```

**src/main/ipc/registerIpc.ts**

```diff
   ipcMain.handle('file:export-lua', async (_, state: DuelPuzzleState, targetPath?: string) => {
     return fileService.exportLuaFile(state, targetPath)
   })
 
+  ipcMain.handle('file:test-in-ygo', (_, state: DuelPuzzleState) => {
+    return fileService.testInYgo(state)
+  })
```

**src/preload/index.ts**

```diff
   exportLuaFile: (state: DuelPuzzleState, targetPath?: string) =>
     ipcRenderer.invoke('file:export-lua', state, targetPath),
+  testInYgo: (state: DuelPuzzleState) => ipcRenderer.invoke('file:test-in-ygo', state),
```

### 第三步：渲染端入口与快捷键（**src/renderer/src/components/Header/Header.tsx**）

- **思考与改动缘由**：
  与导出共用同一道 isExportableMatch 门槛——剧情编排对阵（非 1v1/2v2）物理上无法生成可运行的残局，提前拦截并说明。
  错误分支按 errorCode 分流：未配置目录时用 confirmDialog（确认按钮文案「打开设置」）直达 openSettingsWindow('paths')；找不到 exe 时把当前目录展示出来方便排查。
  启动成功**刻意不弹窗**：游戏窗口自己冒出来就是最强反馈，每次都弹「已启动」反而是打扰。

**src/renderer/src/components/Header/Header.tsx**

```diff
+  const handleTestInYgo = React.useCallback(async (): Promise<void> => {
+    if (!isExportableMatch(state.matchConfig)) {
+      const t0 = state.matchConfig?.team0Count ?? 1
+      const t1 = state.matchConfig?.team1Count ?? 1
+      void alertDialog(
+        `无法测试对局\n\n当前对阵 (${t0}v${t1}) 仅用于剧情编排，暂无法生成 Lua。\nocgcore 单机引擎物理上仅支持 1v1 与 2v2 双打导出。请在对阵选择器中切换至 1v1 或 2v2 后再进行测试。`
+      )
+      return
+    }
+    const res = await window.api.testInYgo(state)
+    if (res.success) return
+    if (res.errorCode === 'no-game-directory') {
+      void confirmDialog({
+        title: '尚未设置 ygo 游戏目录',
+        description:
+          '使用 ygo 测试对局前，需要先在 设置 → 路径 中选择 ygopro.exe 所在的游戏根目录。',
+        confirmText: '打开设置'
+      }).then((ok) => {
+        if (ok) void window.api.openSettingsWindow('paths')
+      })
+    } else if (res.errorCode === 'ygopro-not-found') {
+      void alertDialog(
+        `未在游戏目录中找到 ygopro.exe\n\n当前游戏目录: ${res.error}\n请确认目录正确，或到 设置 → 路径 中重新选择。`
+      )
+    } else if (res.error) {
+      void alertDialog(`启动 ygo 测试失败: ${res.error}`)
+    }
+  }, [state])
```

```diff
       } else if (mod && e.key.toLowerCase() === 'e') {
         e.preventDefault()
         handleExportLua()
+      } else if (mod && e.key.toLowerCase() === 't') {
+        e.preventDefault()
+        handleTestInYgo()
       } else if (mod && e.key.toLowerCase() === 'i') {
```

### 第四步：菜单项与快捷键参考（**src/renderer/src/components/Header/MenuBar.tsx**）

- **思考与改动缘由**：
  菜单项命名与摆放对齐参考项目的语义——「使用 ygo 测试该局」放在导入/导出 Lua 之前（它是导出链路的快捷态，逻辑上更前置），快捷键 Ctrl+T 与 PuzzleEditor 一致（Ctrl+N/O/S/I/E 均未占用）。

**src/renderer/src/components/Header/MenuBar.tsx**

```diff
         { label: '', separator: true },
+        {
+          label: '使用 ygo 测试该局',
+          icon: Play,
+          shortcut: 'Ctrl+T',
+          action: onTestInYgo
+        },
         {
           label: '导入 Lua 脚本',
```

```diff
                 ['超量叠放', 'Alt + 拖放'],
                 ['战术透视', 'Tab'],
+                ['使用 ygo 测试该局', 'Ctrl + T'],
                 ['攻守与指示物', 'Shift + 鼠标左键'],
```

---

## 使用前置条件与已知边界

- 设置 → 路径 中需已配置 **ygo 游戏根目录**（ygopro.exe 所在文件夹）——与卡库检索共用同一配置，正常用过卡库的用户零配置。
- 测试用的 Lua 与「导出 Lua 脚本」产物**完全一致**，因此导出能跑的局面测试就能跑；反之若脚本引用了游戏端不存在的卡（如未装动漫卡库的动画卡），报错来自游戏端弹窗，编辑器不感知。
- 脚本按标题命名覆盖写入 `%APPDATA%\ygo-duel-editor\ygo-test\`，同标题不同局面以最后一次为准。
