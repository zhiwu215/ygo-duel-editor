import { dialog, BrowserWindow, app, shell } from 'electron'
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
  generateScreenplayMarkdown
} from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'

/**
 * 合法化工程文件名：去掉 Windows 非法字符与结尾的点
 *
 * 对局标题常取自小说章节名或角色名，可能带 ` / : * ? " < > |`。
 * 注意**保留中文**——工程名基本都是中文标题，转写成拼音反而更难认。
 */
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
  private projectsDir: string

  constructor() {
    this.projectsDir = join(app.getPath('userData'), 'projects')
    this.ensureProjectsDirectory()
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

      // 如果缺少 card 属性，尝试补全
      const missingCardCodes = state.cards.filter((c) => !c.card).map((c) => c.code)
      if (missingCardCodes.length > 0 && cdbService.isReady()) {
        const cardMap = cdbService.getCardsByIds(missingCardCodes)
        for (const c of state.cards) {
          if (!c.card && cardMap[c.code]) {
            c.card = cardMap[c.code]
          }
        }
      }

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
  ): Promise<{ success: boolean; state?: DuelPuzzleState }> {
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
      return { success: true, state }
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
        const hint = data.hint || ''
        const masterRule = data.masterRule || 5
        const cardCount = Array.isArray(data.cards) ? data.cards.length : 0
        const stepCount = Array.isArray(data.steps) ? data.steps.length : 0

        metaMap.set(filePath, {
          id: filePath,
          filePath,
          title,
          duelType,
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
