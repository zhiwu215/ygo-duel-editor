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
  statSync,
  writeFileSync
} from 'fs'
import { AppConfig, DataDirectoryResult } from '@shared/index'
import { configService } from './configService'
import { broadcastToWindows } from './broadcast'
import { isIsolatedProfile, portableDataRoot, profileRoot } from './userDataProfile'
import { remapWorkspaceSettings, resetWorkspaceSettings } from './workspaceSettings'

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

function samePath(left: string, right: string): boolean {
  return canonicalPath(left).toLowerCase() === canonicalPath(right).toLowerCase()
}

export class DataDirService {
  private legacyMigrated = false
  private installerChoiceAdopted = false

  public isInsideInstallDir(target: string): boolean {
    const installRoot = canonicalPath(dirname(app.getPath('exe')))
    return isWithin(installRoot, canonicalPath(target))
  }

  private get installerMarkerPath(): string {
    return join(app.getPath('appData'), INSTALLER_APP_DIR, INSTALLER_MARKER)
  }

  private readInstallerChoice(): string | null {
    if (!app.isPackaged) return null
    try {
      const marker = this.installerMarkerPath
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

  private writeInstallerChoice(directory: string): void {
    if (!app.isPackaged || isIsolatedProfile()) return
    try {
      mkdirSync(dirname(this.installerMarkerPath), { recursive: true })
      writeFileSync(this.installerMarkerPath, directory, 'utf-8')
    } catch (err) {
      console.error('[DataDirService] write installer choice failed:', err)
    }
  }

  private hasData(directory: string): boolean {
    return (
      DATA_FILES.some((name) => existsSync(join(directory, name))) ||
      DATA_DIRS.some((rel) => existsSync(join(directory, rel)))
    )
  }

  private installerMarkerTime(): number {
    try {
      return statSync(this.installerMarkerPath).mtimeMs
    } catch {
      return 0
    }
  }

  private confirmAdoption(previous: string, next: string): boolean {
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      title: '数据保存目录已变更',
      message: '安装时选择了新的数据保存目录',
      detail: `新目录：${next}\n旧目录：${previous}\n\n「复制并沿用」会把旧目录里的卡组、图鉴、台本、文本、自定义卡复制到新目录，并保留游戏主程序目录等设置；「从新开始」会清空游戏主程序目录、附加卡库等设置，旧目录里的文件不会被删除。`,
      buttons: ['复制并沿用', '从新开始'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    return choice === 0
  }

  private adoptInstallerChoice(): void {
    if (this.installerChoiceAdopted) return
    this.installerChoiceAdopted = true
    if (isIsolatedProfile()) return
    const chosen = this.readInstallerChoice()
    if (!chosen) return
    const previous = configService.get().dataDirectory
    if (!previous) {
      configService.save({ dataDirectory: chosen })
      return
    }
    if (samePath(previous, chosen)) return
    if (configService.modifiedAt() >= this.installerMarkerTime()) {
      this.writeInstallerChoice(previous)
      return
    }
    let patch: Partial<AppConfig> = {}
    if (this.hasData(previous)) {
      if (this.confirmAdoption(previous, chosen)) {
        this.copyData(previous, chosen)
        patch = remapWorkspaceSettings(configService.get(), previous, chosen)
      } else {
        patch = resetWorkspaceSettings()
      }
    }
    configService.save({ dataDirectory: chosen, ...patch })
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
    const target = portableDataRoot ?? join(profileRoot, 'data')
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
    if (!this.hasData(legacy)) return
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
    this.writeInstallerChoice(directory)
    broadcastToWindows('data-dir:changed')
    return { directory, migrated: moved.length > 0 }
  }

  public resetToDefault(doMigrate = true): DataDirectoryResult {
    const directory = this.defaultDirectory
    const moved = doMigrate ? this.migrate(directory) : []
    configService.save({ dataDirectory: directory })
    this.writeInstallerChoice(directory)
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
