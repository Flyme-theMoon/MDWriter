import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { basename } from 'node:path'
import type { AppState } from '../../shared/types/state'
import type {
  CreateDirectoryPayload,
  CreateFilePayload,
  CopyFilePayload,
  DeleteFilePayload,
  ExportPdfPayload,
  RenameEntryPayload,
  SaveFilePayload
} from '../../shared/types/files'
import {
  copyFileToDirectory,
  createDirectory,
  createMarkdownFile,
  deleteFile,
  listDirectory,
  readTextFile,
  renameEntry,
  saveTextFile
} from '../services/fileService'
import { exportPdf } from '../services/pdfService'
import { loadAppState, saveAppState } from '../services/appStateService'
import { openPdfPreview } from '../services/pdfPreviewService'

let closeAllowed = false
let closePromptActive = false
let closePromptWindow: BrowserWindow | null = null

function promptClose(): void {
  if (closePromptActive || !closePromptWindow) return
  closePromptActive = true
  closePromptWindow.webContents.send('app:before-close')
}

export function installCloseGuard(window: BrowserWindow): void {
  closePromptWindow = window
  window.on('close', (event) => {
    if (closeAllowed) return
    event.preventDefault()
    promptClose()
  })
  window.on('maximize', () => {
    window.webContents.send('window:maximize-changed', true)
  })
  window.on('unmaximize', () => {
    window.webContents.send('window:maximize-changed', false)
  })
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app-state:load', async () => loadAppState())
  ipcMain.handle('app-state:save', async (_event, state: AppState) => {
    await saveAppState(state)
  })

  ipcMain.handle('directory:open', async () => {
    const result = await dialog.showOpenDialog({
      title: '打开目录',
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const path = result.filePaths[0]
    return {
      path,
      name: basename(path),
      tree: await listDirectory(path)
    }
  })

  ipcMain.handle('directory:read', async (_event, path: string) => ({
    path,
    name: basename(path),
    tree: await listDirectory(path)
  }))

  ipcMain.handle('file:read', async (_event, path: string) => ({
    path,
    content: await readTextFile(path)
  }))

  ipcMain.handle('file:save', async (_event, payload: SaveFilePayload) => {
    let path = payload.path

    if (!path) {
      const result = await dialog.showSaveDialog({
        title: '保存 Markdown',
        defaultPath: payload.defaultName ?? 'untitled.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      })

      if (result.canceled || !result.filePath) {
        return { canceled: true, path: null }
      }

      path = result.filePath
    }

    await saveTextFile(path, payload.content)
    return { canceled: false, path }
  })

  ipcMain.handle('file:create', async (_event, payload: CreateFilePayload) => ({
    path: await createMarkdownFile(
      payload.directoryPath,
      payload.name,
      payload.content
    )
  }))

  ipcMain.handle('directory:create', async (_event, payload: CreateDirectoryPayload) => ({
    path: await createDirectory(payload.directoryPath, payload.name)
  }))

  ipcMain.handle('file:copy', async (_event, payload: CopyFilePayload) => ({
    path: await copyFileToDirectory(
      payload.sourcePath,
      payload.destinationDirectory
    )
  }))

  ipcMain.handle(
    'file:rename',
    async (_event, payload: RenameEntryPayload) =>
      renameEntry(payload.sourcePath, payload.name)
  )

  ipcMain.handle('file:delete', async (_event, payload: DeleteFilePayload) => {
    await deleteFile(payload.path)
    return { deleted: true }
  })

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    if (filePath.toLowerCase().endsWith('.pdf')) {
      const preview = await openPdfPreview(filePath)
      if (!preview.error) return preview

      const fallbackError = await shell.openPath(filePath)
      return { error: fallbackError || null }
    }

    const error = await shell.openPath(filePath)
    return { error: error || null }
  })

  ipcMain.handle('export:pdf', async (_event, payload: ExportPdfPayload) =>
    exportPdf(payload.html, payload.defaultName, payload.targetPath)
  )

  ipcMain.on('app:close-confirmed', () => {
    closeAllowed = true
    closePromptActive = false
    app.quit()
  })

  ipcMain.on('app:close-canceled', () => {
    closePromptActive = false
  })

  ipcMain.on('window:minimize', () => {
    BrowserWindow.getAllWindows()[0]?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.on('window:close', () => {
    BrowserWindow.getAllWindows()[0]?.close()
  })
}

app.on('before-quit', (event) => {
  if (closeAllowed) return
  event.preventDefault()
  promptClose()
})
