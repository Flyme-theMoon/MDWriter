import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { installCloseGuard, registerIpcHandlers } from './ipc/registerIpc'
import { getPlatformWindowOptions } from './windowOptions'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'MDWriter',
    show: false,
    ...getPlatformWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']

  // Markdown links open through shell.openExternal, so the app window itself
  // must never navigate to another document. Only same-document changes
  // (anchor jumps, dev reloads) are allowed through.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const stripHash = (value: string): string => value.split('#')[0]
    if (stripHash(url) !== stripHash(mainWindow.webContents.getURL())) {
      event.preventDefault()
    }
  })

  installCloseGuard(mainWindow)

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized())
  })

  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('MDWriter')

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
