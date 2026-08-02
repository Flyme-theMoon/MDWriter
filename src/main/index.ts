import { app, BrowserWindow, protocol, shell } from 'electron'
import { net } from 'electron'
import { join } from 'node:path'
import { installCloseGuard, registerIpcHandlers } from './ipc/registerIpc'
import { getPlatformWindowOptions } from './windowOptions'

// Register privileged scheme before app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdwriter',
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: true }
  }
])

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

  installCloseGuard(mainWindow)

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized())
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('MDWriter')

  // Register protocol handler to serve local files (e.g. images saved to workspace)
  protocol.handle('mdwriter', (request) => {
    const filePath = decodeURIComponent(request.url.slice('mdwriter:///'.length))
    return net.fetch('file:///' + filePath)
  })

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
