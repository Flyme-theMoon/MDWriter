/// <reference types="vite/client" />

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
} from '@shared/types/files'
import type { AppState } from '@shared/types/state'

declare global {
  interface Window {
    mdwriter?: {
      platform: string
      versions: {
        electron: string
        chrome: string
        node: string
      }
      openDirectory: () => Promise<OpenDirectoryResult | null>
      readDirectory: (path: string) => Promise<OpenDirectoryResult>
      readFile: (path: string) => Promise<ReadFileResult>
      saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult>
      createFile: (payload: CreateFilePayload) => Promise<CreateFileResult>
      createDirectory: (payload: CreateDirectoryPayload) => Promise<CreateDirectoryResult>
      copyFile: (payload: CopyFilePayload) => Promise<CopyFileResult>
      renameEntry: (payload: RenameEntryPayload) => Promise<RenameEntryResult>
      deleteFile: (payload: DeleteFilePayload) => Promise<DeleteFileResult>
      openPath: (path: string) => Promise<OpenPathResult>
      loadAppState: () => Promise<AppState | null>
      saveAppState: (state: AppState) => Promise<void>
      onBeforeClose: (callback: () => void) => void
      offBeforeClose: (callback: () => void) => void
      confirmClose: () => void
      cancelClose: () => void
      exportPdf: (payload: ExportPdfPayload) => Promise<{ canceled: boolean; path?: string }>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      onMaximizeChanged: (callback: (maximized: boolean) => void) => void
      offMaximizeChanged: (callback: (maximized: boolean) => void) => void
    }
  }
}

export {}
