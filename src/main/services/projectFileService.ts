import { dialog, BrowserWindow, shell } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join, basename, extname } from 'path'
import { DuelPuzzleState, DuelProjectMeta, normalizeDuelState } from '@shared/index'
import { configService } from './configService'
import { dataDirService } from './dataDirService'
import { sanitizeFileName, sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessageOr } from '../utils/errors'

export class ProjectFileService {
  private get projectsDir(): string {
    return dataDirService.ensureDirectory('projects')
  }

  public getProjectsDirectory(): string {
    return this.projectsDir
  }

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
        error: toErrorMessageOr(err, '写入工程文件失败')
      }
    }
  }

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
      return { success: false, error: toErrorMessageOr(err, '存入工程库失败') }
    }
  }

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

    const recents = configService.get().recentProjectPaths || []
    for (const p of recents) {
      if (!metaMap.has(p)) {
        tryAddFile(p)
      }
    }

    return Array.from(metaMap.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

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
      return { success: false, error: toErrorMessageOr(err, '读取工程文件失败') }
    }
  }

  public async deleteProjectFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      const cfg = configService.get()
      const recents = (cfg.recentProjectPaths || []).filter((p) => p !== filePath)
      configService.save({ recentProjectPaths: recents })
      return { success: true }
    } catch (err) {
      console.error('[FileService] deleteProjectFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '删除失败') }
    }
  }

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
      let newFilename = `${sanitizeFileName(state.title)}.ygoduel`
      let newPath = join(baseDir, newFilename)

      if (existsSync(newPath)) {
        newFilename = `${sanitizeFileName(state.title)}_${Date.now()}.ygoduel`
        newPath = join(baseDir, newFilename)
      }

      writeFileSync(newPath, JSON.stringify(state, null, 2), 'utf-8')
      this.recordRecentProject(newPath)
      return { success: true, newPath }
    } catch (err) {
      console.error('[FileService] duplicateProjectFile failed:', err)
      return { success: false, error: toErrorMessageOr(err, '创建副本失败') }
    }
  }

  public async revealFileInFolder(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        shell.showItemInFolder(filePath)
      }
    } catch (err) {
      console.error('[FileService] revealFileInFolder failed:', err)
    }
  }

  public async openProjectsDirectory(): Promise<void> {
    try {
      const dir = this.ensureProjectsDirectory()
      await shell.openPath(dir)
    } catch (err) {
      console.error('[FileService] openProjectsDirectory failed:', err)
    }
  }
}

export const projectFileService = new ProjectFileService()
