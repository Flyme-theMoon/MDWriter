/// <reference types="vite/client" />

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
      searchDirectory: (payload: SearchDirectoryPayload) => Promise<GlobalSearchMatch[]>
      readFile: (path: string) => Promise<ReadFileResult>
      saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult>
      saveImage: (payload: {
        buffer: ArrayBuffer
        fileName: string
        fileDir: string
      }) => Promise<{ relativePath: string } | { error: string }>
      getTempDir: () => Promise<string>
      readImageDataUrl: (path: string) => Promise<string | null>
      moveImageToDir: (payload: {
        sourcePath: string
        targetDir: string
      }) => Promise<{ relativePath: string } | { error: string }>
      createFile: (payload: CreateFilePayload) => Promise<CreateFileResult>
      createDirectory: (payload: CreateDirectoryPayload) => Promise<CreateDirectoryResult>
      copyFile: (payload: CopyFilePayload) => Promise<CopyFileResult>
      cutFile: (payload: CutFilePayload) => Promise<CutFileResult>
      renameEntry: (payload: RenameEntryPayload) => Promise<RenameEntryResult>
      deleteFile: (payload: DeleteFilePayload) => Promise<DeleteFileResult>
      openPath: (path: string) => Promise<OpenPathResult>
      openExternal: (url: string) => Promise<OpenExternalResult>
      loadAppState: () => Promise<AppState | null>
      saveAppState: (state: AppState) => Promise<void>
      setWatchedWorkspaces: (paths: string[]) => void
      onWorkspaceChanged: (callback: (path: string) => void) => void
      offWorkspaceChanged: (callback: (path: string) => void) => void
      onBeforeClose: (callback: () => void) => void
      offBeforeClose: (callback: () => void) => void
      confirmClose: () => void
      cancelClose: () => void
      exportPdf: (payload: ExportPdfPayload) => Promise<{ canceled: boolean; path?: string }>
      generatePdfBuffer: (payload: GeneratePdfBufferPayload) => Promise<GeneratePdfBufferResult>
      savePngPage: (payload: SavePngPagePayload) => Promise<SavePngPageResult>
      removeExportFiles: (paths: string[]) => Promise<void>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      onMaximizeChanged: (callback: (maximized: boolean) => void) => void
      offMaximizeChanged: (callback: (maximized: boolean) => void) => void
    }
  }
}

export {}
