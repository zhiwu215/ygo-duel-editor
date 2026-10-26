import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { UpdateState } from '@shared/index'
import { broadcastToWindows } from './broadcast'

const AUTO_CHECK_DELAY_MS = 6000

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
  if (!notes) return undefined
  const text = typeof notes === 'string' ? notes : notes.map((item) => item.note ?? '').join('\n\n')
  const trimmed = text.trim()
  return trimmed || undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

class UpdateService {
  private initialized = false
  private state: UpdateState = {
    phase: 'idle',
    supported: false,
    currentVersion: ''
  }

  public get currentState(): UpdateState {
    return this.state
  }

  public init(): void {
    if (this.initialized) return
    this.initialized = true

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      this.patch({ phase: 'checking', error: undefined })
    })
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.patch({
        phase: 'available',
        availableVersion: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        error: undefined
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.patch({
        phase: 'up-to-date',
        availableVersion: undefined,
        releaseNotes: undefined,
        progress: undefined,
        error: undefined
      })
    })
    autoUpdater.on('download-progress', (info: ProgressInfo) => {
      this.patch({
        phase: 'downloading',
        progress: {
          percent: Math.min(100, Math.max(0, info.percent)),
          transferred: info.transferred,
          total: info.total,
          bytesPerSecond: info.bytesPerSecond
        }
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.patch({
        phase: 'ready',
        availableVersion: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        progress: undefined,
        error: undefined
      })
    })
    autoUpdater.on('error', (err: Error) => {
      this.patch({ phase: 'error', error: errorMessage(err) })
    })

    this.state = {
      ...this.state,
      supported: app.isPackaged,
      currentVersion: app.getVersion()
    }
  }

  public async check(): Promise<UpdateState> {
    this.init()
    if (!this.state.supported) {
      return this.patch({ phase: 'error', error: '开发运行不支持自动更新，请使用安装版' })
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.patch({ phase: 'error', error: errorMessage(err) })
    }
    return this.state
  }

  public async download(): Promise<UpdateState> {
    this.init()
    if (!this.state.supported || !this.state.availableVersion) return this.state
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') return this.state
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.patch({ phase: 'error', error: errorMessage(err) })
    }
    return this.state
  }

  public install(): void {
    if (this.state.phase !== 'ready') return
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  }

  public startAutoCheck(): void {
    this.init()
    if (!this.state.supported) return
    setTimeout(() => {
      void this.check()
    }, AUTO_CHECK_DELAY_MS)
  }

  private patch(next: Partial<UpdateState>): UpdateState {
    this.state = { ...this.state, ...next }
    broadcastToWindows('update:state', this.state)
    return this.state
  }
}

export const updateService = new UpdateService()
