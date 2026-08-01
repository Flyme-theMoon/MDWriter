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
  OpenPathResult,
  OpenDirectoryResult,
  ReadFileResult,
  RenameEntryPayload,
  RenameEntryResult,
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
    ipcRenderer.invoke('export:pdf', payload)
}

contextBridge.exposeInMainWorld('mdwriter', api)
