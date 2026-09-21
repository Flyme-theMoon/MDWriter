import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  CreateDirectoryPayload,
  CreateDirectoryResult,
  CreateFilePayload,
  CreateFileResult,
  CopyFilePayload,
  CopyFileResult,
  CutFilePayload,
  CutFileResult,
  DeleteFilePayload,
  DeleteFileResult,
  ExportPdfPayload,
  GeneratePdfBufferPayload,
  GeneratePdfBufferResult,
  GlobalSearchMatch,
  OpenPathResult,
  OpenExternalResult,
  OpenDirectoryResult,
  ReadFileResult,
  RenameEntryPayload,
  RenameEntryResult,
  SavePngPagePayload,
  SavePngPageResult,
  SearchDirectoryPayload,
  SaveFilePayload,
  SaveFileResult
} from '../shared/types/files'
import type { AppState } from '../shared/types/state'

const workspaceChangedHandlers = new Map<
  (path: string) => void,
  (event: IpcRendererEvent, path: string) => void
>()

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  openDirectory: (): Promise<OpenDirectoryResult | null> =>
    ipcRenderer.invoke('directory:open'),
  readDirectory: (path: string): Promise<OpenDirectoryResult> =>
    ipcRenderer.invoke('directory:read', path),
  searchDirectory: (
    payload: SearchDirectoryPayload
  ): Promise<GlobalSearchMatch[]> =>
    ipcRenderer.invoke('directory:search', payload),
  readFile: (path: string): Promise<ReadFileResult> =>
    ipcRenderer.invoke('file:read', path),
  saveFile: (payload: SaveFilePayload): Promise<SaveFileResult> =>
    ipcRenderer.invoke('file:save', payload),
  saveImage: (payload: {
    buffer: ArrayBuffer
    fileName: string
    fileDir: string
  }): Promise<{ relativePath: string } | { error: string }> =>
    ipcRenderer.invoke('image:save', payload),
  getTempDir: (): Promise<string> =>
    ipcRenderer.invoke('image:get-temp-dir'),
  readImageDataUrl: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('image:read-data-url', path),
  moveImageToDir: (payload: {
    sourcePath: string
    targetDir: string
  }): Promise<{ relativePath: string } | { error: string }> =>
    ipcRenderer.invoke('image:move-to-dir', payload),
  createFile: (payload: CreateFilePayload): Promise<CreateFileResult> =>
    ipcRenderer.invoke('file:create', payload),
  createDirectory: (payload: CreateDirectoryPayload): Promise<CreateDirectoryResult> =>
    ipcRenderer.invoke('directory:create', payload),
  copyFile: (payload: CopyFilePayload): Promise<CopyFileResult> =>
    ipcRenderer.invoke('file:copy', payload),
  cutFile: (payload: CutFilePayload): Promise<CutFileResult> =>
    ipcRenderer.invoke('file:cut', payload),
  renameEntry: (payload: RenameEntryPayload): Promise<RenameEntryResult> =>
    ipcRenderer.invoke('file:rename', payload),
  deleteFile: (payload: DeleteFilePayload): Promise<DeleteFileResult> =>
    ipcRenderer.invoke('file:delete', payload),
  openPath: (path: string): Promise<OpenPathResult> =>
    ipcRenderer.invoke('file:open', path),
  openExternal: (url: string): Promise<OpenExternalResult> =>
    ipcRenderer.invoke('shell:open-external', url),
  loadAppState: (): Promise<AppState | null> =>
    ipcRenderer.invoke('app-state:load'),
  saveAppState: (state: AppState): Promise<void> =>
    ipcRenderer.invoke('app-state:save', state),
  setWatchedWorkspaces: (paths: string[]): void => {
    ipcRenderer.send('workspace:set-watched', paths)
  },
  onWorkspaceChanged: (callback: (path: string) => void): void => {
    const handler = (_event: IpcRendererEvent, path: string) =>
      callback(path)
    workspaceChangedHandlers.set(callback, handler)
    ipcRenderer.on('workspace:changed', handler)
  },
  offWorkspaceChanged: (callback: (path: string) => void): void => {
    const handler = workspaceChangedHandlers.get(callback)
    if (handler) {
      ipcRenderer.removeListener('workspace:changed', handler)
      workspaceChangedHandlers.delete(callback)
    }
  },
  onBeforeClose: (callback: () => void): void => {
    ipcRenderer.on('app:before-close', callback)
  },
  offBeforeClose: (callback: () => void): void => {
    ipcRenderer.removeListener('app:before-close', callback)
  },
  confirmClose: (): void => {
    ipcRenderer.send('app:close-confirmed')
  },
  cancelClose: (): void => {
    ipcRenderer.send('app:close-canceled')
  },
  exportPdf: (payload: ExportPdfPayload): Promise<{ canceled: boolean; path?: string }> =>
    ipcRenderer.invoke('export:pdf', payload),
  generatePdfBuffer: (payload: GeneratePdfBufferPayload): Promise<GeneratePdfBufferResult> =>
    ipcRenderer.invoke('export:pdf-buffer', payload),
  savePngPage: (payload: SavePngPagePayload): Promise<SavePngPageResult> =>
    ipcRenderer.invoke('png:save-page', payload),
  removeExportFiles: (paths: string[]): Promise<void> =>
    ipcRenderer.invoke('png:remove-files', paths),
  minimizeWindow: (): void => {
    ipcRenderer.send('window:minimize')
  },
  maximizeWindow: (): void => {
    ipcRenderer.send('window:maximize')
  },
  closeWindow: (): void => {
    ipcRenderer.send('window:close')
  },
  onMaximizeChanged: (callback: (maximized: boolean) => void): void => {
    ipcRenderer.on('window:maximize-changed', (_event, maximized) => callback(maximized))
  },
  offMaximizeChanged: (callback: (maximized: boolean) => void): void => {
    ipcRenderer.removeListener('window:maximize-changed', callback as any)
  }
}

contextBridge.exposeInMainWorld('mdwriter', api)
