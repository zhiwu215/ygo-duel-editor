import { app, BrowserWindow, dialog, shell } from 'electron'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'fs'
import { DataDirectoryResult } from '@shared/index'
import { configService } from './configService'
import { broadcastToWindows } from './broadcast'
import { isIsolatedProfile, profileRoot } from './userDataProfile'

const DEFAULT_DIR_NAME = 'ygo-duel-editor-data'
const INSTALLER_APP_DIR = 'ygo-duel-editor'
const INSTALLER_MARKER = 'data-dir.txt'
const DATA_FILES = [
  'ygo_duel_editor_decks.json',
  'card_notes.json',
  'custom_cards.json',
  'custom_setcodes.json'
]
const DATA_DIRS = ['projects', 'texts', 'text-library', 'custom']

function canonicalPath(target: string): string {
  try {
    return realpathSync.native(target)
  } catch {
    return resolve(target)
  }
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export class DataDirService {
  private legacyMigrated = false
  private installerChoiceAdopted = false

  public isInsideInstallDir(target: string): boolean {
    const installRoot = canonicalPath(dirname(app.getPath('exe')))
    return isWithin(installRoot, canonicalPath(target))
  }

  private readInstallerChoice(): string | null {
    if (!app.isPackaged) return null
    try {
      const marker = join(app.getPath('appData'), INSTALLER_APP_DIR, INSTALLER_MARKER)
      if (!existsSync(marker)) return null
      const value = readFileSync(marker, 'utf-8').trim()
      if (!value) return null
      if (this.isInsideInstallDir(value)) return null
      mkdirSync(value, { recursive: true })
      return value
    } catch (err) {
      console.error('[DataDirService] read installer choice failed:', err)
      return null
    }
  }

  private adoptInstallerChoice(): void {
    if (this.installerChoiceAdopted) return
    this.installerChoiceAdopted = true
    if (isIsolatedProfile()) return
    if (!configService.isFirstRun()) return
    if (configService.get().dataDirectory) return
    const chosen = this.readInstallerChoice()
    if (!chosen) return
    const localAppData = process.env['LOCALAPPDATA']
    const fallback = localAppData ? join(localAppData, DEFAULT_DIR_NAME) : app.getPath('userData')
    if (chosen === fallback) return
    configService.save({ dataDirectory: chosen })
  }

  public get defaultDirectory(): string {
    if (isIsolatedProfile()) return this.profileDataDirectory()
    this.adoptInstallerChoice()
    const localAppData = process.env['LOCALAPPDATA']
    const legacy = app.getPath('userData')
    const target = localAppData ? join(localAppData, DEFAULT_DIR_NAME) : legacy
    try {
      if (!existsSync(target)) mkdirSync(target, { recursive: true })
    } catch (err) {
      console.error('[DataDirService] create default directory failed:', target, err)
    }
    if (target !== legacy) this.migrateFromUserData(target)
    return target
  }

  private profileDataDirectory(): string {
    const target = join(profileRoot, 'data')
    try {
      if (!existsSync(target)) mkdirSync(target, { recursive: true })
    } catch (err) {
      console.error('[DataDirService] create profile data directory failed:', target, err)
    }
    return target
  }

  public getDataDirectory(): string {
    this.adoptInstallerChoice()
    const custom = configService.get().dataDirectory
    if (custom && existsSync(custom)) {
      if (!this.isInsideInstallDir(custom)) return custom
      const moved = this.copyData(custom, this.defaultDirectory)
      configService.save({ dataDirectory: undefined })
      console.warn('[DataDirService] moved data out of install directory:', moved.join(', '))
    }
    return this.defaultDirectory
  }

  public resolve(relativePath: string): string {
    return join(this.getDataDirectory(), relativePath)
  }

  public ensureDirectory(relativePath: string): string {
    const dir = this.resolve(relativePath)
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
    if (this.isInsideInstallDir(directory)) {
      return {
        directory,
        migrated: false,
        error: '数据目录不能放在软件安装目录内，升级时会被清空，请选择其他位置'
      }
    }
    if (!this.isWritable(directory)) {
      return { directory, migrated: false, error: '该目录不可写入，请更换位置' }
    }

    const moved = doMigrate ? this.migrate(directory) : []
    configService.save({ dataDirectory: directory })
    broadcastToWindows('data-dir:changed')
    return { directory, migrated: moved.length > 0 }
  }

  public resetToDefault(doMigrate = true): DataDirectoryResult {
    const directory = this.defaultDirectory
    const moved = doMigrate ? this.migrate(directory) : []
    configService.save({ dataDirectory: directory })
    broadcastToWindows('data-dir:changed')
    return { directory, migrated: moved.length > 0 }
  }

  public async openDataDirectory(): Promise<void> {
    try {
      await shell.openPath(this.getDataDirectory())
    } catch (err) {
      console.error('[DataDirService] openDataDirectory failed:', err)
    }
  }
}

export const dataDirService = new DataDirService()
