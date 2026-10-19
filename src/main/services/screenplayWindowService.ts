import { BrowserWindow, shell, type WebContents } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'

export class ScreenplayWindowService {
  private window: BrowserWindow | null = null

  public openWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return
    }

    this.window = new BrowserWindow({
      width: 900,
      height: 860,
      minWidth: 720,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      title: '决斗台本 - YGO Duel Editor',
      icon,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.window.on('ready-to-show', () => {
      this.window?.show()
    })

    this.window.on('closed', () => {
      this.window = null
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#screenplay`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'screenplay'
      })
    }
  }

  public forwardExcept(from: WebContents, channel: string, payload?: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents !== from) {
        win.webContents.send(channel, payload)
      }
    }
  }
}

export const screenplayWindowService = new ScreenplayWindowService()
