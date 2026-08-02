import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { basename, dirname, extname, join } from 'node:path'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { AppState } from '../../shared/types/state'
import type {
  CreateDirectoryPayload,
  CreateFilePayload,
  CopyFilePayload,
  DeleteFilePayload,
  ExportPdfPayload,
  RenameEntryPayload,
  SaveFilePayload,
  SearchDirectoryPayload
} from '../../shared/types/files'
import {
  copyFileToDirectory,
  createDirectory,
  createMarkdownFile,
  deleteFile,
  listDirectory,
  readTextFile,
  renameEntry,
  saveTextFile,
  searchDirectory
} from '../services/fileService'
import { exportPdf } from '../services/pdfService'
import { loadAppState, saveAppState } from '../services/appStateService'
import { openPdfPreview } from '../services/pdfPreviewService'
import { setWatchedWorkspaces } from '../services/workspaceWatcher'

let closeAllowed = false
let closePromptActive = false
let closePromptWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

function promptClose(): void {
  if (closePromptActive || !closePromptWindow) return
  closePromptActive = true
  closePromptWindow.webContents.send('app:before-close')
}

export function installCloseGuard(window: BrowserWindow): void {
  mainWindow = window
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

  app.on('before-quit', (event) => {
    if (closeAllowed) return
    event.preventDefault()
    promptClose()
  })
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app-state:load', async () => loadAppState())
  ipcMain.handle('app-state:save', async (_event, state: AppState) => {
    await saveAppState(state)
  })

  ipcMain.on('workspace:set-watched', (_event, paths: unknown) => {
    const safePaths = Array.isArray(paths)
      ? paths.filter((path): path is string => typeof path === 'string')
      : []

    setWatchedWorkspaces(safePaths, (path) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workspace:changed', path)
      }
    })
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

  ipcMain.handle(
    'directory:search',
    async (_event, payload: SearchDirectoryPayload) =>
      searchDirectory(payload.path, payload.query)
  )

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

  ipcMain.handle('image:get-temp-dir', async (): Promise<string> => {
    const tempDir = join(app.getPath('temp'), 'mdwriter-images', randomUUID())
    await mkdir(tempDir, { recursive: true })
    return tempDir
  })

  ipcMain.handle(
    'image:save',
    async (
      _event,
      payload: { buffer: ArrayBuffer; fileName: string; fileDir: string }
    ): Promise<{ relativePath: string } | { error: string }> => {
      try {
        // Check if images/ subdirectory exists
        let hasImagesDir = false
        try {
          const st = await stat(join(payload.fileDir, 'images'))
          hasImagesDir = st.isDirectory()
        } catch {
          hasImagesDir = false
        }

        const targetDir = hasImagesDir
          ? join(payload.fileDir, 'images')
          : payload.fileDir

        // Avoid filename collisions: append timestamp + random suffix
        const ext = payload.fileName.includes('.')
          ? payload.fileName.slice(payload.fileName.lastIndexOf('.'))
          : '.png'
        const baseName = payload.fileName.includes('.')
          ? payload.fileName.slice(0, payload.fileName.lastIndexOf('.'))
          : payload.fileName
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).slice(2, 6)
        const safeFileName = `${baseName}-${timestamp}-${random}${ext}`

        const targetPath = join(targetDir, safeFileName)
        await writeFile(targetPath, Buffer.from(payload.buffer))

        return { relativePath: hasImagesDir ? `images/${safeFileName}` : safeFileName }
      } catch (err: any) {
        console.error('[image:save] Error:', err)
        return { error: err?.message ?? String(err) }
      }
    }
  )

  ipcMain.handle(
    'image:move-to-dir',
    async (
      _event,
      payload: { sourcePath: string; targetDir: string }
    ): Promise<{ relativePath: string } | { error: string }> => {
      try {
        // Check if images/ subdirectory exists in targetDir
        let hasImagesDir = false
        try {
          const st = await stat(join(payload.targetDir, 'images'))
          hasImagesDir = st.isDirectory()
        } catch {
          hasImagesDir = false
        }

        const targetDir = hasImagesDir
          ? join(payload.targetDir, 'images')
          : payload.targetDir

        const sourceExt = extname(payload.sourcePath) || '.png'
        const baseName = basename(payload.sourcePath, sourceExt)
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).slice(2, 6)
        const safeFileName = `${baseName}-${timestamp}-${random}${sourceExt}`

        const targetPath = join(targetDir, safeFileName)
        await copyFile(payload.sourcePath, targetPath)

        return { relativePath: hasImagesDir ? `images/${safeFileName}` : safeFileName }
      } catch (err: any) {
        return { error: err?.message ?? String(err) }
      }
    }
  )

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
