import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'

const FLUSH_TIMEOUT_MS = 3000

function waitForRendererFlush(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    let timer: NodeJS.Timeout | null = null
    const finish = (): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      ipcMain.removeListener('app:close-ready', listener)
      resolve()
    }
    const listener = (event: IpcMainEvent): void => {
      if (event.sender.id === win.webContents.id) finish()
    }
    timer = setTimeout(finish, FLUSH_TIMEOUT_MS)
    ipcMain.on('app:close-ready', listener)
    win.webContents.send('app:before-close')
  })
}

export function installWindowCloseGuard(win: BrowserWindow): void {
  let confirmed = false
  let flushing = false

  win.on('close', (event) => {
    if (confirmed) return
    event.preventDefault()
    if (flushing) return
    if (win.webContents.isDestroyed() || win.webContents.isLoadingMainFrame()) {
      confirmed = true
      win.close()
      return
    }
    flushing = true
    void waitForRendererFlush(win).finally(() => {
      confirmed = true
      flushing = false
      if (!win.isDestroyed()) win.close()
    })
  })
}
