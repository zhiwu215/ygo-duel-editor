import { app, BrowserWindow, dialog, shell } from 'electron'
import { dirname, join } from 'path'
import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { DataDirectoryResult } from '@shared/index'
import { configService } from './configService'

const DATA_FILES = ['ygo_duel_editor_decks.json', 'card_notes.json', 'custom_cards.json']
const DATA_DIRS = ['pics/custom', 'projects', 'novels']

export class DataDirService {
  public get defaultDirectory(): string {
    return app.getPath('userData')
  }

  public getDataDirectory(): string {
    const custom = configService.get().dataDirectory
    if (custom && existsSync(custom)) return custom
    return this.defaultDirectory
  }

  public resolve(relative: string): string {
    return join(this.getDataDirectory(), relative)
  }

  public ensureDirectory(relative: string): string {
    const dir = this.resolve(relative)
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    } catch (err) {
      console.error('[DataDirService] ensureDirectory failed:', dir, err)
    }
    return dir
  }

  public isWritable(dir: string): boolean {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      accessSync(dir, constants.W_OK)
      const probe = join(dir, '.write-test')
      writeFileSync(probe, '1', 'utf-8')
      rmSync(probe, { force: true })
      return true
    } catch {
      return false
    }
  }

  public migrate(target: string): string[] {
    const from = this.getDataDirectory()
    if (from === target) return []
    const moved: string[] = []
    try {
      if (!existsSync(target)) mkdirSync(target, { recursive: true })
      for (const name of DATA_FILES) {
        const src = join(from, name)
        const dest = join(target, name)
        if (!existsSync(src) || existsSync(dest)) continue
        copyFileSync(src, dest)
        moved.push(name)
      }
      for (const rel of DATA_DIRS) {
        const src = join(from, rel)
        const dest = join(target, rel)
        if (!existsSync(src) || existsSync(dest)) continue
        mkdirSync(dirname(dest), { recursive: true })
        cpSync(src, dest, { recursive: true })
        moved.push(rel)
      }
    } catch (err) {
      console.error('[DataDirService] migrate failed:', err)
    }
    return moved
  }

  public async selectDataDirectory(
    window?: BrowserWindow,
    doMigrate = true
  ): Promise<DataDirectoryResult | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择数据保存目录',
      defaultPath: this.getDataDirectory(),
      properties: ['openDirectory', 'createDirectory']
    })

    if (res.canceled || !res.filePaths[0]) return null

    const directory = res.filePaths[0]
    if (!this.isWritable(directory)) {
      return { directory, migrated: false, error: '该目录不可写入，请更换位置' }
    }

    const moved = doMigrate ? this.migrate(directory) : []
    configService.save({ dataDirectory: directory })
    this.broadcast()
    return { directory, migrated: moved.length > 0 }
  }

  public resetToDefault(doMigrate = true): DataDirectoryResult {
    const directory = this.defaultDirectory
    const moved = doMigrate ? this.migrate(directory) : []
    configService.save({ dataDirectory: undefined })
    this.broadcast()
    return { directory, migrated: moved.length > 0 }
  }

  public async openDataDirectory(): Promise<void> {
    try {
      await shell.openPath(this.getDataDirectory())
    } catch (err) {
      console.error('[DataDirService] openDataDirectory failed:', err)
    }
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('data-dir:changed')
    }
  }
}

export const dataDirService = new DataDirService()
