import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'

/**
 * 全局设置独立窗口服务 (VSCode / OpenCode 风格)
 *
 * 为什么用独立窗口：设置页汇聚外观、路径与 AI 提供商等全部入口，
 * 内嵌在主界面会与决斗工作区争抢空间；与卡组编辑器窗口复用同一渲染 bundle，
 * 以 hash 路由 `#settings` 区分页面 (见 renderer App.tsx)。
 */
class SettingsWindowService {
  private settingsWindow: BrowserWindow | null = null

  /** 打开或聚焦设置独立窗口 */
  public openSettingsWindow(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore()
      }
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }

    this.settingsWindow = new BrowserWindow({
      width: 980,
      height: 720,
      minWidth: 780,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      // 参考设置子窗口形态：完全无边框，仅右上角自绘关闭按钮 (见 SettingsApp.tsx)，拖拽区也在渲染层
      frame: false,
      title: '设置 - YGO Duel Editor',
      icon,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.settingsWindow.on('ready-to-show', () => {
      this.settingsWindow?.show()
    })

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })

    this.settingsWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#settings`)
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'settings'
      })
    }
  }
}

export const settingsWindowService = new SettingsWindowService()
