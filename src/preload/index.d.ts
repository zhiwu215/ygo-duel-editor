import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcApi } from '@shared/index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: IpcApi
  }
}
