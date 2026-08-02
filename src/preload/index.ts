import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateDirectoryPayload,
  CreateDirectoryResult,
  CreateFilePayload,
  CreateFileResult,
  CopyFilePayload,
  CopyFileResult,
  DeleteFilePayload,
  DeleteFileResult,
  ExportPdfPayload,
  GlobalSearchMatch,
  OpenPathResult,
  OpenDirectoryResult,
  ReadFileResult,
  RenameEntryPayload,
  RenameEntryResult,
  SearchDirectoryPayload,
  SaveFilePayload,
  SaveFileResult
} from '../shared/types/files'
import type { AppState } from '../shared/types/state'

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
  createFile: (payload: CreateFilePayload): Promise<CreateFileResult> =>
    ipcRenderer.invoke('file:create', payload),
  createDirectory: (payload: CreateDirectoryPayload): Promise<CreateDirectoryResult> =>
    ipcRenderer.invoke('directory:create', payload),
  copyFile: (payload: CopyFilePayload): Promise<CopyFileResult> =>
    ipcRenderer.invoke('file:copy', payload),
  renameEntry: (payload: RenameEntryPayload): Promise<RenameEntryResult> =>
    ipcRenderer.invoke('file:rename', payload),
  deleteFile: (payload: DeleteFilePayload): Promise<DeleteFileResult> =>
    ipcRenderer.invoke('file:delete', payload),
  openPath: (path: string): Promise<OpenPathResult> =>
    ipcRenderer.invoke('file:open', path),
  loadAppState: (): Promise<AppState | null> =>
    ipcRenderer.invoke('app-state:load'),
  saveAppState: (state: AppState): Promise<void> =>
    ipcRenderer.invoke('app-state:save', state),
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
