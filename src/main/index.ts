import { app, shell, BrowserWindow, protocol, net, powerMonitor } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import './services/userDataProfile'
import { registerAllIpcHandlers } from './ipc/registerIpc'
import { registerUpdateIpc } from './ipc/updateIpc'
import { configService } from './services/configService'
import { dataDirService } from './services/dataDirService'
import { cdbService } from './db/cdbService'
import {
  currentBundledCdbPaths,
  currentLanguagePack,
  discoverGameLanguagePacks,
  readGameConfigLanguage,
  resolveGameLanguagePack
} from './services/gameContent'
import { imageService } from './services/imageService'
import { libraryService } from './services/libraryService'
import { textLibraryService } from './services/textLibraryService'
import { seedCurrentGameLanguage } from './services/gameLanguagePreference'
import { installWindowCloseGuard } from './services/windowCloseGuard'
import { updateService } from './services/updateService'
import {
  DEFAULT_UPDATE_SCHEDULE_CONFIG,
  resolveUpdateScheduleConfig,
  UpdateSchedule
} from './services/updateSchedule'

function createUpdateSchedule(): UpdateSchedule {
  try {
    return new UpdateSchedule(updateService, resolveUpdateScheduleConfig(process.env))
  } catch (error) {
    console.warn('[update] invalid check schedule configuration, using defaults:', error)
    return new UpdateSchedule(updateService, DEFAULT_UPDATE_SCHEDULE_CONFIG)
  }
}

const updateSchedule = createUpdateSchedule()

function checkForUpdatesInBackground(): void {
  if (!app.isPackaged) return
  void updateSchedule.check().catch((error: unknown) => {
    console.error('[update] background check failed:', error)
  })
}

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

  installWindowCloseGuard(mainWindow)

  mainWindow.on('ready-to-show', () => {
    checkForUpdatesInBackground()
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
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
  dataDirService.getDataDirectory()
  updateService.init()

  app.on('browser-window-focus', checkForUpdatesInBackground)
  powerMonitor.on('resume', checkForUpdatesInBackground)
  app.on('will-quit', () => {
    updateSchedule.dispose()
    app.off('browser-window-focus', checkForUpdatesInBackground)
    powerMonitor.off('resume', checkForUpdatesInBackground)
  })

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
  registerUpdateIpc((manual) => updateSchedule.check(manual))

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
  const gameDirectory =
    cfg.gameDirectory && existsSync(cfg.gameDirectory) ? cfg.gameDirectory : undefined
  const cdbPath = cfg.cdbPath && existsSync(cfg.cdbPath) ? cfg.cdbPath : undefined
  const disabled = cfg.disabledCdbPaths || []
  const extraCdbPaths = (cfg.extraCdbPaths || []).filter((p) => !disabled.includes(p))
  if (gameDirectory && cfg.gameType === 'ygopro') {
    const packs = discoverGameLanguagePacks(gameDirectory)
    if (packs.length > 0) {
      const pack = resolveGameLanguagePack(
        packs,
        cfg.gameLanguage ?? readGameConfigLanguage(gameDirectory)
      )
      if (pack && pack.id !== cfg.gameLanguage) {
        configService.save({ gameLanguage: pack.id })
      }
    } else if (cfg.gameLanguage) {
      configService.save({ gameLanguage: undefined })
    }
  }
  seedCurrentGameLanguage()
  const bundledCdbPaths = currentBundledCdbPaths()
  cdbService.setPreferredBanlist(cfg.banlistName)
  if (cdbPath || extraCdbPaths.length > 0 || bundledCdbPaths.length > 0) {
    cdbService.setGameDirectory(gameDirectory)
    cdbService.reloadAll(cdbPath, bundledCdbPaths, extraCdbPaths, currentLanguagePack())
    if (!gameDirectory && cdbPath) {
      const detected = imageService.detectGameDirectory(cdbPath)
      if (detected) {
        configService.save({ gameDirectory: detected })
        cdbService.setGameDirectory(detected)
      }
    }
  }

  libraryService.reloadDataDirectory()
  textLibraryService.reloadDataDirectory()

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
