import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAllIpcHandlers } from './ipc/registerIpc'
import { configService } from './services/configService'
import { cdbService } from './db/cdbService'
import { imageService } from './services/imageService'

// 注册自定义协议 ygopic:// 用于本地卡图秒级加载 (零网络依赖、零 CDN)
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
  // 创建现代化大尺寸工作台窗口
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'YGO Duel Editor - 游戏王决斗编辑器',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 彻底移除系统默认的原生菜单栏，避免用户按下 Alt 键时触发 Windows 原生的 File/Edit/View 工具栏
  mainWindow.removeMenu()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
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
  })

  // 1. 注册所有业务 IPC 处理器
  registerAllIpcHandlers()

  // 2. 注册 ygopic 协议处理器：从本地游戏目录秒级加载卡图 (pics / expansions/pics)
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

  // 3. 尝试自动恢复上次使用的 cards.cdb 与游戏目录
  const cfg = configService.get()
  if (cfg.cdbPath) {
    const ok = cdbService.open(cfg.cdbPath)
    if (ok && !cfg.gameDirectory) {
      const detected = imageService.detectGameDirectory(cfg.cdbPath)
      if (detected) {
        configService.save({ gameDirectory: detected })
      }
    }
  }

  // 4. 打开窗口
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
