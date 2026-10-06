import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'

export class NovelLibraryService {
  private window: BrowserWindow | null = null

  public openWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return
    }

    this.window = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      title: '小说素材库 - YGO Duel Editor',
      icon,
      backgroundColor: '#0f1115',
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
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#novel-library`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'novel-library'
      })
    }
  }
}

export const novelLibraryService = new NovelLibraryService()
