import { app, BrowserWindow, dialog, shell } from 'electron'
import { dirname, join } from 'path'
import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
import { DataDirectoryResult } from '@shared/index'
import { configService } from './configService'

const DATA_FILES = ['ygo_duel_editor_decks.json', 'card_notes.json', 'custom_cards.json']
const DATA_DIRS = ['pics/custom', 'projects', 'texts']

let installDataDirectory: string | null | undefined

function readInstallerChoice(): string | null {
  if (!app.isPackaged) return null
  try {
    const marker = join(dirname(app.getPath('exe')), 'data-dir.txt')
    if (!existsSync(marker)) return null
    const value = readFileSync(marker, 'utf-8').trim()
    if (!value) return null
    mkdirSync(value, { recursive: true })
    return value
  } catch {
    return null
  }
}

function resolveInstallDataDirectory(): string | null {
  if (!app.isPackaged) return null
  const chosen = readInstallerChoice()
  if (chosen) return chosen
  const localAppData = process.env['LOCALAPPDATA']
  if (!localAppData) return null
  try {
    const fallback = join(localAppData, 'ygo-duel-editor-data')
    mkdirSync(fallback, { recursive: true })
    return fallback
  } catch {
    return null
  }
}

export class DataDirService {
  public get installDataDirectory(): string | null {
    if (installDataDirectory === undefined) installDataDirectory = resolveInstallDataDirectory()
    return installDataDirectory
  }

  public get defaultDirectory(): string {
    const target = this.installDataDirectory
    if (target) {
      this.migrateFromUserData(target)
      return target
    }
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

  private copyData(from: string, to: string): string[] {
    const moved: string[] = []
    for (const name of DATA_FILES) {
      const src = join(from, name)
      const dest = join(to, name)
      if (!existsSync(src) || existsSync(dest)) continue
      copyFileSync(src, dest)
      moved.push(name)
    }
    for (const rel of DATA_DIRS) {
      const src = join(from, rel)
      const dest = join(to, rel)
      if (!existsSync(src) || existsSync(dest)) continue
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(src, dest, { recursive: true })
      moved.push(rel)
    }
    return moved
  }

  public migrate(target: string): string[] {
    const from = this.getDataDirectory()
    if (from === target) return []
    try {
      if (!existsSync(target)) mkdirSync(target, { recursive: true })
      return this.copyData(from, target)
    } catch (err) {
      console.error('[DataDirService] migrate failed:', err)
      return []
    }
  }

  private legacyMigrated = false

  private migrateFromUserData(target: string): void {
    if (this.legacyMigrated) return
    this.legacyMigrated = true
    if (configService.get().dataDirectory) return
    const legacy = app.getPath('userData')
    if (legacy === target) return
    const hasData =
      DATA_FILES.some((name) => existsSync(join(legacy, name))) ||
      DATA_DIRS.some((rel) => existsSync(join(legacy, rel)))
    if (!hasData) return
    try {
      mkdirSync(target, { recursive: true })
      const moved = this.copyData(legacy, target)
      if (moved.length) console.log('[DataDirService] migrated from userData:', moved.join(', '))
    } catch (err) {
      console.error('[DataDirService] migrateFromUserData failed:', err)
    }
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
