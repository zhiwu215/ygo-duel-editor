import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAllIpcHandlers } from './ipc/registerIpc'
import { configService } from './services/configService'
import { cdbService } from './db/cdbService'
import { imageService } from './services/imageService'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ygopic',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    title: 'YGO Duel Editor - 游戏王决斗编辑器',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.removeMenu()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ygoduel.editor')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)

    const broadcastMaximized = (): void => {
      if (!window.isDestroyed()) {
        window.webContents.send('window:maximized-changed', window.isMaximized())
      }
    }
    window.on('maximize', broadcastMaximized)
    window.on('unmaximize', broadcastMaximized)
  })

  registerAllIpcHandlers()

  protocol.handle('ygopic', async (request) => {
    try {
      const url = new URL(request.url)
      const isSmall =
        url.searchParams.get('small') === '1' || url.searchParams.get('small') === 'true'
      const codeStr = url.pathname.replace(/^\//, '').replace(/\.(jpg|png)$/i, '')
      const code = parseInt(codeStr, 10)
      if (isNaN(code) || code <= 0) {
        return new Response('Invalid card code', { status: 400 })
      }

      const filePath = imageService.findCardImagePath(code, isSmall)
      if (filePath) {
        return await net.fetch(pathToFileURL(filePath).toString())
      }
      return new Response('Image not found', { status: 404 })
    } catch (err) {
      console.error('[ygopic] protocol handle error:', err)
      return new Response('Internal error', { status: 500 })
    }
  })

  const cfg = configService.get()
  const disabled = cfg.disabledCdbPaths || []
  const extraCdbPaths = (cfg.extraCdbPaths || []).filter((p) => !disabled.includes(p))
  if (cfg.cdbPath || extraCdbPaths.length > 0) {
    cdbService.setPoolTags(cfg.cdbPoolTags || {})
    cdbService.reloadAll(cfg.cdbPath, extraCdbPaths)
    if (!cfg.gameDirectory && cfg.cdbPath) {
      const detected = imageService.detectGameDirectory(cfg.cdbPath)
      if (detected) {
        configService.save({ gameDirectory: detected })
      }
    }
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cdbService.close()
    app.quit()
  }
})
