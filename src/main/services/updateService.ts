import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateCheckResult,
  type UpdateInfo
} from 'electron-updater'
import type { UpdateFailureOperation, UpdateState } from '@shared/index'
import { broadcastToWindows } from './broadcast'
import { isPortableProfile } from './userDataProfile'

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
  private checkOperation: Promise<UpdateState> | undefined
  private downloadOperation: Promise<UpdateState> | undefined
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
    autoUpdater.allowDowngrade = false

    autoUpdater.on('download-progress', (info: ProgressInfo) => {
      this.patch({
        phase: 'downloading',
        progress: {
          percent: Math.min(100, Math.max(0, info.percent)),
          transferred: info.transferred,
          total: info.total,
          bytesPerSecond: info.bytesPerSecond
        },
        error: undefined,
        failedOperation: undefined
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.patch({
        phase: 'ready',
        availableVersion: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? this.state.releaseNotes,
        progress: undefined,
        error: undefined,
        failedOperation: undefined
      })
    })
    autoUpdater.on('error', (err: Error) => {
      if (this.state.phase !== 'ready') return
      this.fail(errorMessage(err), 'install')
    })

    this.state = {
      ...this.state,
      supported: app.isPackaged,
      currentVersion: app.getVersion()
    }
  }

  public async check(manual = false): Promise<UpdateState> {
    this.init()
    if (!this.state.supported) {
      return manual ? this.fail('开发运行不支持自动更新，请使用安装版', 'check') : this.state
    }
    if (!manual && isPortableProfile()) return this.state
    if (!this.updaterConfigured) {
      return manual ? this.fail('当前安装包未配置更新源，请手动下载新版本', 'check') : this.state
    }
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') return this.state
    if (this.downloadOperation !== undefined) return this.state
    if (!manual && this.state.phase === 'error' && this.state.failedOperation === 'download') {
      return this.state
    }
    if (this.checkOperation !== undefined) {
      if (manual) this.patch({ phase: 'checking', error: undefined, failedOperation: undefined })
      const state = await this.checkOperation
      return manual ? this.patch(state) : state
    }
    if (manual) this.patch({ phase: 'checking', error: undefined, failedOperation: undefined })
    const operation = this.runCheck().finally(() => {
      this.checkOperation = undefined
    })
    this.checkOperation = operation
    const state = await operation
    return manual && state.phase === 'error' ? this.patch(state) : state
  }

  public async download(): Promise<UpdateState> {
    this.init()
    if (!this.state.supported || !this.state.availableVersion) return this.state
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') return this.state
    this.downloadOperation ??= this.runDownload().finally(() => {
      this.downloadOperation = undefined
    })
    return this.downloadOperation
  }

  public install(): void {
    if (this.state.phase !== 'ready') return
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(true, true)
      } catch (err) {
        this.fail(errorMessage(err), 'install')
      }
    })
  }

  private get updaterConfigured(): boolean {
    return app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))
  }

  private isReady(): boolean {
    return this.state.phase === 'ready'
  }

  private async runDownload(): Promise<UpdateState> {
    try {
      await autoUpdater.downloadUpdate()
      if (!this.isReady()) {
        return this.fail('安装包下载完成但未就绪，请重新检查后重试', 'download')
      }
    } catch (err) {
      return this.fail(errorMessage(err), 'download')
    }
    return this.state
  }

  private async runCheck(): Promise<UpdateState> {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result === null) throw new Error('更新服务未返回检查结果')
      return this.applyCheckResult(result)
    } catch (err) {
      return this.failureState(errorMessage(err), 'check')
    }
  }

  private applyCheckResult(result: UpdateCheckResult): UpdateState {
    if (!result.isUpdateAvailable) {
      return this.patch({
        phase: 'up-to-date',
        availableVersion: undefined,
        releaseNotes: undefined,
        progress: undefined,
        error: undefined,
        failedOperation: undefined
      })
    }
    return this.patch({
      phase: 'available',
      availableVersion: result.updateInfo.version,
      releaseNotes: normalizeReleaseNotes(result.updateInfo.releaseNotes),
      progress: undefined,
      error: undefined,
      failedOperation: undefined
    })
  }

  private failureState(message: string, failedOperation: UpdateFailureOperation): UpdateState {
    return {
      ...this.state,
      phase: 'error',
      failedOperation,
      error: message,
      progress: undefined
    }
  }

  private fail(message: string, failedOperation: UpdateFailureOperation): UpdateState {
    return this.patch(this.failureState(message, failedOperation))
  }

  private patch(next: Partial<UpdateState>): UpdateState {
    this.state = { ...this.state, ...next }
    broadcastToWindows('update:state', this.state)
    return this.state
  }
}

export const updateService = new UpdateService()
