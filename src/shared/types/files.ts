export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  kind?: 'markdown' | 'pdf'
  children?: FileNode[]
}

export interface OpenDirectoryResult {
  path: string
  name: string
  tree: FileNode[]
}

export interface GlobalSearchMatch {
  path: string
  name: string
  line: number
  start: number
  end: number
  snippet: string
}

export interface SearchDirectoryPayload {
  path: string
  query: string
}

export interface ReadFileResult {
  path: string
  content: string
}

export interface SaveFilePayload {
  path: string | null
  content: string
  defaultName?: string
}

export interface SaveFileResult {
  canceled: boolean
  path: string | null
}

export interface CreateFilePayload {
  directoryPath: string
  name?: string
  content?: string
}

export interface CreateFileResult {
  path: string
}

export interface CreateDirectoryPayload {
  directoryPath: string
  name?: string
}

export interface CreateDirectoryResult {
  path: string
}

export interface CopyFilePayload {
  sourcePath: string
  destinationDirectory: string
}

export interface CopyFileResult {
  path: string
}

export interface CutFilePayload {
  sourcePath: string
  destinationDirectory: string
}

export interface CutFileResult {
  path: string
}

export interface RenameEntryPayload {
  sourcePath: string
  name: string
}

export interface RenameEntryResult {
  path: string
  name: string
}

export interface DeleteFilePayload {
  path: string
}

export interface DeleteFileResult {
  deleted: boolean
}

export interface OpenPathResult {
  error: string | null
}

export interface ExportPdfPayload {
  html: string
  defaultName: string
  targetPath?: string
}

export interface ExportPdfResult {
  canceled: boolean
  path?: string
}
