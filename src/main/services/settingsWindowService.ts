import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SettingsSectionId } from '@shared/index'
import icon from '../../../resources/icon.png?asset'

class SettingsWindowService {
  private settingsWindow: BrowserWindow | null = null

  public openSettingsWindow(section: SettingsSectionId = 'appearance'): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore()
      }
      this.settingsWindow.show()
      this.settingsWindow.focus()
      this.settingsWindow.webContents.send('settings:navigate', section)
      return
    }

    this.settingsWindow = new BrowserWindow({
      width: 1060,
      height: 740,
      minWidth: 900,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
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
      this.settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#settings/${section}`)
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `settings/${section}`
      })
    }
  }
}

export const settingsWindowService = new SettingsWindowService()
