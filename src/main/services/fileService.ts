import { dialog, BrowserWindow, shell, app } from 'electron'
import { spawn } from 'child_process'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'fs'
import { join, basename, extname } from 'path'
import {
  DuelPuzzleState,
  DuelProjectMeta,
  normalizeDuelState,
  generateLuaScript,
  parseLuaScript,
  generateScreenplayMarkdown,
  EngineExportReplayParams,
  EngineExportReplayResult
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'
import { dataDirService } from './dataDirService'
import { ruleCheckService } from './ruleCheckService'
import { buildYrpSingleFile, DUEL_PSEUDO_SHUFFLE } from './yrpWriter'

function sanitizeProjectFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned || '未命名对局'
}

export class FileService {
  private get projectsDir(): string {
    return dataDirService.ensureDirectory('projects')
  }

  /**
   * 获取当前生效的工程存储目录 (优先使用用户自定义目录)
   */
  public getProjectsDirectory(): string {
    const customDir = configService.get().projectsDirectory
    if (customDir && existsSync(customDir)) {
      return customDir
    }
    return this.projectsDir
  }

  /**
   * 确保工程专属目录存在
   */
  public ensureProjectsDirectory(): string {
    const dir = this.getProjectsDirectory()
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    } catch (err) {
      console.error('[FileService] Failed to ensure projects directory:', err)
    }
    return dir
  }

  /**
   * 记录最近打开或保存的工程路径
   */
  private recordRecentProject(filePath: string): void {
    try {
      const cfg = configService.get()
      const recents = (cfg.recentProjectPaths || []).filter((p) => p !== filePath)
      recents.unshift(filePath)
      configService.save({ recentProjectPaths: recents.slice(0, 50) })
    } catch (err) {
      console.error('[FileService] Failed to record recent project:', err)
    }
  }
  /**
   * 选择 YGO 游戏根目录 (内含 ygopro.exe 与 cards.cdb)
   */
  public async selectGameDirectory(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择 YGO 游戏主目录 (即 ygopro.exe 所在的文件夹，选择后自动读取其中的 cards.cdb)',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  /**
   * 选择附加卡库文件 (.cdb)
   */
  public async selectExtraCdb(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择附加卡库 (.cdb，例如动漫卡库)',
      properties: ['openFile'],
      filters: [{ name: '卡库文件', extensions: ['cdb'] }]
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  /**
   * 在 YGO 根目录下定位 cards.cdb (根目录或 expansions 子目录)
   */
  public locateCardsCdb(gameDir: string): string | null {
    const candidates = [join(gameDir, 'cards.cdb'), join(gameDir, 'expansions', 'cards.cdb')]
    for (const p of candidates) {
      if (existsSync(p)) {
        return p
      }
    }
    return null
  }

  /**
   * 如果缺少 card 属性，从 cdb 补全
   */
  private completeCardDetails(state: DuelPuzzleState): void {
    const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
    if (missingCardCodes.length > 0 && cdbService.isReady()) {
      const cardMap = cdbService.getCardsByIds(missingCardCodes)
      for (const c of state.cards) {
        if (!c.card && cardMap[c.code]) {
          c.card = cardMap[c.code]
        }
      }
    }
  }

  /**
   * 在游戏根目录下定位 ygopro.exe (兼容各发行版命名：ygopro / KoishiPro / EDOPro 等)
   */
  private locateYgoproExe(gameDir: string): string | null {
    const candidates = [join(gameDir, 'ygopro.exe'), join(gameDir, 'ygopro')]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    try {
      for (const file of readdirSync(gameDir)) {
        if (/(ygo|gopro|pro)\.exe$/i.test(file)) {
          return join(gameDir, file)
        }
      }
    } catch {
      return null
    }
    return null
  }

  /**
   * 生成当前局面的 Lua 脚本，写入本地临时目录并调用 ygo 的单人残局模式直接测试
   */
  public testInYgo(state: DuelPuzzleState): {
    success: boolean
    exePath?: string
    scriptPath?: string
    errorCode?: 'no-game-directory' | 'ygopro-not-found'
    error?: string
  } {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }

    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'ygopro-not-found', error: gameDir }
    }

    try {
      this.completeCardDetails(state)
      const luaContent = generateLuaScript(state)

      const dir = join(app.getPath('userData'), 'ygo-test')
      mkdirSync(dir, { recursive: true })
      const name = state.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'puzzle'
      const scriptPath = join(dir, `${name}.lua`)
      writeFileSync(scriptPath, luaContent, 'utf-8')

      const child = spawn(exePath, ['-s', scriptPath], {
        cwd: gameDir,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      console.log(`[FileService] Launched ${exePath} -s ${scriptPath}`)
      return { success: true, exePath, scriptPath }
    } catch (err) {
      console.error('[FileService] Test in ygo failed:', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * 导出 Lua 脚本文件
   */
  public async exportLuaFile(
    state: DuelPuzzleState,
    targetPath?: string,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      let finalPath = targetPath

      if (!finalPath) {
        const defaultName = `${state.title.replace(/[\\/:*?"<>|]/g, '_') || 'custom_puzzle'}.lua`
        const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
          title: '导出游戏王残局 Lua 脚本',
          defaultPath: defaultName,
          filters: [
            { name: 'Lua Script', extensions: ['lua'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (res.canceled || !res.filePath) {
          return { success: false }
        }
        finalPath = res.filePath
      }

      this.completeCardDetails(state)

      const luaContent = generateLuaScript(state)
      writeFileSync(finalPath, luaContent, 'utf-8')
      console.log(`[FileService] Exported lua to ${finalPath}`)
      return { success: true, filePath: finalPath }
    } catch (err) {
      console.error('[FileService] Export lua failed:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMsg }
    }
  }

  public async exportReplay(params: EngineExportReplayParams): Promise<EngineExportReplayResult> {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'ygopro-not-found', error: gameDir }
    }
    if (params.entries.length === 0) {
      return {
        success: false,
        errorCode: 'no-actions',
        error: '还没有任何经过引擎的操作记录，无法进行录像导出'
      }
    }
    try {
      const gen = await ruleCheckService.exportReplay(params)
      if ('error' in gen) {
        return { success: false, errorCode: 'replay-failed', error: gen.error }
      }
      this.completeCardDetails(gen.engineState)
      const luaContent = generateLuaScript(gen.engineState, { forReplay: true })
      const name = sanitizeProjectFileName(params.state.title || '未命名对局')

      const singleDir = join(gameDir, 'single')
      const replayDir = join(gameDir, 'replay')
      mkdirSync(singleDir, { recursive: true })
      mkdirSync(replayDir, { recursive: true })
      const luaPath = join(singleDir, `${name}.lua`)
      const yrpPath = join(replayDir, `${name}.yrp`)
      writeFileSync(luaPath, luaContent, 'utf-8')

      const turnPlayer = (gen.engineState.turnPlayer ?? 0) as 0 | 1
      const duelists = gen.engineState.duelists ?? []
      const names: [string, string] = [
        duelists.find((d) => d.team === turnPlayer)?.name || `Player ${turnPlayer + 1}`,
        duelists.find((d) => d.team === ((1 - turnPlayer) as 0 | 1))?.name ||
          `Player ${2 - turnPlayer}`
      ]
      const yrpBytes = buildYrpSingleFile({
        names,
        startLp: Number(gen.engineState.players[0]?.lp ?? 8000),
        startHand: Number(gen.engineState.players[0]?.startHand ?? 0),
        drawCount: Number(gen.engineState.players[0]?.maxHand ?? 0),
        opt: DUEL_PSEUDO_SHUFFLE,
        scriptFile: `./single/${name}.lua`,
        responses: gen.responses
      })
      writeFileSync(yrpPath, Buffer.from(yrpBytes))

      let launched = false
      if (params.launch !== false) {
        const child = spawn(exePath, ['-r', yrpPath], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        launched = true
      }
      console.log(`[FileService] Exported replay to ${yrpPath}`)
      return { success: true, luaPath, yrpPath, launched }
    } catch (err) {
      console.error('[FileService] Export replay failed:', err)
      return {
        success: false,
        errorCode: 'replay-failed',
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * 导入并解析已有的 Lua 脚本文件
   */
  public async importLuaFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导入已有游戏王残局 Lua 脚本',
        filters: [
          { name: 'Lua Script', extensions: ['lua'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false }
      }

      const filePath = res.filePaths[0]
      const content = readFileSync(filePath, 'utf-8')
      const state = parseLuaScript(content)

      // 提取文件名作为默认标题
      const fileName = filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.lua$/i, '')
      if (fileName) {
        state.title = fileName
      }

      // 自动补齐已解析卡片的卡片详情
      const codes = state.cards.map((c) => c.code)
      if (codes.length > 0 && cdbService.isReady()) {
        const cardMap = cdbService.getCardsByIds(codes)
        for (const card of state.cards) {
          if (cardMap[card.code]) {
            card.card = cardMap[card.code]
          }
        }
      }

      return { success: true, state }
    } catch (err) {
      console.error('[FileService] Import lua failed:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 保存编辑器专属工程 (.ygoduel JSON)
   */
  public async saveProjectFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string }> {
    try {
      const defaultDir = this.ensureProjectsDirectory()
      const defaultName = `${state.title || 'project'}.ygoduel`
      const defaultPath = join(defaultDir, defaultName)

      const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '保存决斗编辑器工程文件',
        defaultPath,
        filters: [
          { name: 'YGO Duel Project', extensions: ['ygoduel', 'json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (res.canceled || !res.filePath) {
        return { success: false }
      }

      writeFileSync(res.filePath, JSON.stringify(state, null, 2), 'utf-8')
      this.recordRecentProject(res.filePath)
      return { success: true, filePath: res.filePath }
    } catch (err) {
      console.error('[FileService] Save project failed:', err)
      return { success: false }
    }
  }

  /**
   * 静默覆盖到已知路径，不弹对话框
   *
   * 用于 Ctrl+S：渲染层记着「当前在编辑哪个文件」，第二次保存时直接写入。
   * 路径无效（被删/被移走）会让 caller 决定是 fallback 到 dialog 还是报错。
   */
  public saveProjectToPath(
    filePath: string,
    state: DuelPuzzleState
  ): { success: boolean; filePath?: string; error?: string } {
    try {
      if (!filePath) {
        return { success: false, error: '保存路径为空' }
      }
      writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
      this.recordRecentProject(filePath)
      return { success: true, filePath }
    } catch (err) {
      console.error('[FileService] Save project to path failed:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : '写入工程文件失败'
      }
    }
  }

  /**
   * 直接存入工程库（不弹保存对话框）
   *
   * 与 `saveProjectFile` 的区别是**文件名自动决定**：同名则覆盖，不同名则新建。
   * 用于「从小说提取对局」这类程序化建档 —— 背后灵刚转写完的对局不应该
   * 还要用户再点一次另存为。
   */
  public saveProjectToLibrary(state: DuelPuzzleState): {
    success: boolean
    filePath?: string
    error?: string
  } {
    try {
      const dir = this.ensureProjectsDirectory()
      const rawTitle = (state.title || '').trim() || '未命名对局'
      const base = sanitizeProjectFileName(rawTitle)
      let filePath = join(dir, `${base}.ygoduel`)
      // 同名加序号，避免默默覆盖用户已有对局
      let n = 2
      while (existsSync(filePath)) {
        filePath = join(dir, `${base}_${n}.ygoduel`)
        n += 1
      }
      writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
      this.recordRecentProject(filePath)
      return { success: true, filePath }
    } catch (err) {
      console.error('[FileService] Save project to library failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '存入工程库失败' }
    }
  }

  /**
   * 打开编辑器专属工程 (.ygoduel JSON)
   */
  public async loadProjectFile(
    window?: BrowserWindow
  ): Promise<{ success: boolean; state?: DuelPuzzleState; filePath?: string }> {
    try {
      const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '打开决斗编辑器工程文件',
        filters: [
          { name: 'YGO Duel Project', extensions: ['ygoduel', 'json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false }
      }

      const filePath = res.filePaths[0]
      const content = readFileSync(filePath, 'utf-8')
      const rawState = JSON.parse(content) as DuelPuzzleState
      const state = normalizeDuelState(rawState)
      this.recordRecentProject(filePath)
      return { success: true, state, filePath }
    } catch (err) {
      console.error('[FileService] Load project failed:', err)
      return { success: false }
    }
  }

  /**
   * 获取所有对局档案列表 (扫描 projects 目录与最近工程历史)
   */
  public async getProjectList(): Promise<DuelProjectMeta[]> {
    this.ensureProjectsDirectory()
    const metaMap = new Map<string, DuelProjectMeta>()

    const tryAddFile = (filePath: string): void => {
      try {
        if (!existsSync(filePath)) return
        const stat = statSync(filePath)
        if (!stat.isFile()) return

        const content = readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content) as DuelPuzzleState
        if (!data || typeof data !== 'object') return

        const ext = extname(filePath)
        const nameWithoutExt = basename(filePath, ext)
        const title = data.title || nameWithoutExt || '未命名对局'
        const duelType = data.duelType || 'full'
        const series = typeof data.series === 'string' ? data.series : ''
        const sourceRef =
          data.sourceRef && data.sourceRef.textId && Array.isArray(data.sourceRef.chapterIds)
            ? {
                textId: data.sourceRef.textId,
                textTitle: data.sourceRef.textTitle || '',
                chapterIds: data.sourceRef.chapterIds
              }
            : undefined
        const hint = data.hint || ''
        const masterRule = data.masterRule || 5
        const cardCount = Array.isArray(data.cards) ? data.cards.length : 0
        const stepCount = Array.isArray(data.steps) ? data.steps.length : 0

        metaMap.set(filePath, {
          id: filePath,
          filePath,
          title,
          duelType,
          series,
          sourceRef,
          hint,
          masterRule,
          cardCount,
          stepCount,
          updatedAt: stat.mtimeMs
        })
      } catch (err) {
        console.warn('[FileService] Failed to read project meta:', filePath, err)
      }
    }

    // 1. 扫描当前配置的工程目录
    const currentDir = this.ensureProjectsDirectory()
    try {
      if (existsSync(currentDir)) {
        const files = readdirSync(currentDir)
        for (const file of files) {
          if (file.endsWith('.ygoduel') || file.endsWith('.json')) {
            tryAddFile(join(currentDir, file))
          }
        }
      }
    } catch (err) {
      console.error('[FileService] Error scanning projects directory:', err)
    }

    // 2. 补充最近打开的历史工程 (若存在且未失效)
    const recents = configService.get().recentProjectPaths || []
    for (const p of recents) {
      if (!metaMap.has(p)) {
        tryAddFile(p)
      }
    }

    // 3. 按最后修改时间倒序排列
    return Array.from(metaMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 按绝对路径读取对局档案
   */
  public async loadProjectByPath(
    filePath: string
  ): Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }> {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: '文件不存在或已被移除' }
      }
      const content = readFileSync(filePath, 'utf-8')
      const rawState = JSON.parse(content) as DuelPuzzleState
      const state = normalizeDuelState(rawState)
      this.recordRecentProject(filePath)
      return { success: true, state }
    } catch (err) {
      console.error('[FileService] loadProjectByPath failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '读取工程文件失败' }
    }
  }

  /**
   * 删除对局档案文件
   */
  public async deleteProjectFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      // 从最近工程中移除
      const cfg = configService.get()
      const recents = (cfg.recentProjectPaths || []).filter((p) => p !== filePath)
      configService.save({ recentProjectPaths: recents })
      return { success: true }
    } catch (err) {
      console.error('[FileService] deleteProjectFile failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '删除失败' }
    }
  }

  /**
   * 复制创建对局档案副本
   */
  public async duplicateProjectFile(
    filePath: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: '原文件不存在' }
      }
      const content = readFileSync(filePath, 'utf-8')
      const state = JSON.parse(content) as DuelPuzzleState
      state.title = `${state.title || '对局'} (副本)`

      const baseDir = this.ensureProjectsDirectory()
      let newFilename = `${state.title.replace(/[\\/:*?"<>|]/g, '_')}.ygoduel`
      let newPath = join(baseDir, newFilename)

      if (existsSync(newPath)) {
        newFilename = `${state.title.replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.ygoduel`
        newPath = join(baseDir, newFilename)
      }

      writeFileSync(newPath, JSON.stringify(state, null, 2), 'utf-8')
      this.recordRecentProject(newPath)
      return { success: true, newPath }
    } catch (err) {
      console.error('[FileService] duplicateProjectFile failed:', err)
      return { success: false, error: err instanceof Error ? err.message : '创建副本失败' }
    }
  }

  /**
   * 在操作系统的资源管理器中高亮定位文件
   */
  public async revealFileInFolder(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        shell.showItemInFolder(filePath)
      }
    } catch (err) {
      console.error('[FileService] revealFileInFolder failed:', err)
    }
  }

  /**
   * 当前生效目录下所有工程文件路径（含最近打开的历史工程）
   */
  private listProjectFilePaths(): string[] {
    const paths: string[] = []
    const dir = this.getProjectsDirectory()
    try {
      if (existsSync(dir)) {
        for (const file of readdirSync(dir)) {
          if (file.endsWith('.ygoduel') || file.endsWith('.json')) {
            paths.push(join(dir, file))
          }
        }
      }
    } catch (err) {
      console.error('[FileService] Error listing projects directory:', err)
    }

    for (const p of configService.get().recentProjectPaths || []) {
      if (!paths.includes(p)) paths.push(p)
    }
    return paths
  }

  private readSeriesList(): string[] {
    const list = configService.get().projectSeries
    return Array.isArray(list) ? [...list] : []
  }

  private writeSeriesList(list: string[]): void {
    configService.save({ projectSeries: list })
  }

  /**
   * 改写单个工程文件的作品分类
   *
   * `transform` 返回 null 表示「不改动这个文件」。
   */
  private rewriteSeries(filePath: string, transform: (current: string) => string | null): boolean {
    try {
      if (!existsSync(filePath)) return false
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DuelPuzzleState
      if (!data || typeof data !== 'object') return false

      const current = typeof data.series === 'string' ? data.series : ''
      const next = transform(current)
      if (next === null || next === current) return true

      if (next) data.series = next
      else delete data.series

      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.warn('[FileService] Failed to rewrite series:', filePath, err)
      return false
    }
  }

  /**
   * 新建作品分类（只是登记一个名字，不触碰任何工程文件）
   */
  public createProjectSeries(name: string): { success: boolean; error?: string } {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: '分类名不能为空' }
    const list = this.readSeriesList()
    if (list.includes(trimmed)) return { success: false, error: '已存在同名分类' }
    this.writeSeriesList([...list, trimmed])
    return { success: true }
  }

  /**
   * 重命名作品分类：同步改写其下所有工程文件
   */
  public renameProjectSeries(
    oldName: string,
    newName: string
  ): { success: boolean; error?: string } {
    const from = oldName.trim()
    const to = newName.trim()
    if (!from) return { success: false, error: '原分类名为空' }
    if (!to) return { success: false, error: '分类名不能为空' }

    const list = this.readSeriesList()
    if (to !== from && list.includes(to)) return { success: false, error: '已存在同名分类' }

    for (const filePath of this.listProjectFilePaths()) {
      this.rewriteSeries(filePath, (current) => (current === from ? to : null))
    }

    const nextList = list.map((n) => (n === from ? to : n))
    if (!nextList.includes(to)) nextList.push(to)
    this.writeSeriesList(nextList)
    return { success: true }
  }

  /**
   * 删除作品分类：其下对局退回「未归类」，不删文件
   */
  public deleteProjectSeries(name: string): { success: boolean; error?: string } {
    const target = name.trim()
    if (!target) return { success: false, error: '分类名为空' }

    for (const filePath of this.listProjectFilePaths()) {
      this.rewriteSeries(filePath, (current) => (current === target ? '' : null))
    }
    this.writeSeriesList(this.readSeriesList().filter((n) => n !== target))
    return { success: true }
  }

  /**
   * 把单个对局档案归入（或移出）某个作品分类
   */
  public setProjectSeries(
    filePath: string,
    series: string | null
  ): { success: boolean; error?: string } {
    if (!existsSync(filePath)) return { success: false, error: '文件不存在或已被移除' }
    const next = (series || '').trim()

    if (!this.rewriteSeries(filePath, () => next)) {
      return { success: false, error: '写入工程文件失败' }
    }

    if (next) {
      const list = this.readSeriesList()
      if (!list.includes(next)) this.writeSeriesList([...list, next])
    }
    return { success: true }
  }

  /**
   * 打开选择工程存储目录对话框并保存设置
   */
  public async selectProjectsDirectory(window?: BrowserWindow): Promise<string | null> {
    const currentDir = this.getProjectsDirectory()
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择决斗工程默认保存与归档目录',
      defaultPath: currentDir,
      properties: ['openDirectory', 'createDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    const selectedDir = res.filePaths[0]
    configService.save({ projectsDirectory: selectedDir })
    this.ensureProjectsDirectory()
    return selectedDir
  }

  /**
   * 打开工程存储目录
   */
  public async openProjectsDirectory(): Promise<void> {
    try {
      const dir = this.ensureProjectsDirectory()
      await shell.openPath(dir)
    } catch (err) {
      console.error('[FileService] openProjectsDirectory failed:', err)
    }
  }

  /**
   * 导出同人决斗台本 Markdown 文档 (.md)
   */
  public async exportScreenplayFile(
    state: DuelPuzzleState,
    window?: BrowserWindow
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const defaultName = `${state.title.replace(/[\\/:*?"<>|]/g, '_') || 'duel_screenplay'}.md`
      const res = await dialog.showSaveDialog(window || BrowserWindow.getFocusedWindow()!, {
        title: '导出同人决斗剧本台本 Markdown 文档',
        defaultPath: defaultName,
        filters: [
          { name: 'Markdown Document', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (res.canceled || !res.filePath) {
        return { success: false }
      }

      const mdContent = generateScreenplayMarkdown(state)
      writeFileSync(res.filePath, mdContent, 'utf-8')

      return { success: true, filePath: res.filePath }
    } catch (err: unknown) {
      console.error('[FileService] exportScreenplayFile error:', err)
      return { success: false, error: err instanceof Error ? err.message : '导出台本失败' }
    }
  }
}

export const fileService = new FileService()
