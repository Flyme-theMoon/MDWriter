import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react'
import {
  Code2,
  Columns2,
  Eye,
  FileDown,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Keyboard,
  ListTree,
  Moon,
  Save,
  Search,
  Sun,
  X
} from 'lucide-react'
import type { EditorMode } from '@shared/types/document'
import type {
  FileNode,
  GlobalSearchMatch,
  OpenDirectoryResult,
  ReadFileResult
} from '@shared/types/files'
import type { AppState } from '@shared/types/state'
import type { OutlineHeading } from './markdown/outline'
import { buildOutlineTree, extractOutline } from './markdown/outline'
import {
  fileUrlToPath,
  relativizeImagePaths,
  resolveImagePaths,
  toFileUrl
} from './markdown/imagePaths'
import { AppCloseDialog } from './components/AppCloseDialog'
import { FileDeleteDialog } from './components/FileDeleteDialog'

// Copy images from temp paths to the file's images/ directory and update references
async function resolveTempImages(
  content: string,
  fileDir: string
): Promise<string> {
  if (!window.mdwriter) return content

  const normalizedFileDir = fileDir.replace(/\\/g, '/')
  const fileUrlRegex =
    /!\[([^\]]*)\]\((file:\/\/[^)\s]+)(\s+(["'][^"']*["'])\s*)?\)/g

  const replacements: Array<{ full: string; replacement: string }> = []
  let match

  while ((match = fileUrlRegex.exec(content)) !== null) {
    const [full, alt, urlPart] = match
    const href = fileUrlToPath(urlPart)

    // Skip paths already under the current fileDir
    if (href.startsWith(normalizedFileDir)) {
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await window.mdwriter.moveImageToDir({
      sourcePath: href,
      targetDir: fileDir
    })

    if ('error' in result) continue

    const newSrc = toFileUrl(`${normalizedFileDir}/${result.relativePath}`)
    replacements.push({ full, replacement: `![${alt}](${newSrc})` })
  }

  // Apply all replacements
  let updated = content
  for (const { full, replacement } of replacements) {
    updated = updated.replace(full, replacement)
  }

  return updated
}

import { ImageLightbox } from './components/ImageLightbox'
import { WindowControls } from './components/WindowControls'
import { CurrentSearchBar } from './components/search/CurrentSearchBar'
import { GlobalSearchBar } from './components/sidebar/GlobalSearchBar'
import { GlobalSearchResults } from './components/sidebar/GlobalSearchResults'
import type { PreviewEditorHandle } from './components/editor/PreviewEditor'
import type { PreviewPaneHandle } from './components/editor/PreviewPane'
import type { SourceEditorHandle } from './components/editor/SourceEditor'
import { FileContextMenu } from './components/sidebar/FileContextMenu'
import {
  FileTree,
  type PendingCreateEntry,
  type PendingRenameEntry
} from './components/sidebar/FileTree'
import { OutlineTree } from './components/sidebar/OutlineTree'
import { ShortcutDialog } from './components/ShortcutDialog'
import { UnsavedDialog } from './components/UnsavedDialog'
import { findFuzzyRanges } from './search/fuzzy'
import appIcon from './icon.png'

// Editor engines are loaded on demand so startup only parses the app shell,
// not every editor engine at once.
const SourceEditor = lazy(() =>
  import('./components/editor/SourceEditor').then((module) => ({
    default: module.SourceEditor
  }))
)

const PreviewPane = lazy(() =>
  import('./components/editor/PreviewPane').then((module) => ({
    default: module.PreviewPane
  }))
)

const PreviewEditor = lazy(() =>
  import('./components/editor/PreviewEditor').then((module) => ({
    default: module.PreviewEditor
  }))
)

interface EditorTab {
  id: string
  title: string
  content: string
  path: string | null
  dirty: boolean
}

interface FileContextMenuState {
  x: number
  y: number
  path: string
  name: string
  isRoot: boolean
  kind: 'file' | 'folder'
  directoryPath: string
}

interface CopiedMarkdown {
  sourcePath: string
  name: string
  kind: 'file' | 'folder'
  action: 'copy' | 'cut'
}

interface DeleteFileTarget {
  path: string
  name: string
  kind: 'file' | 'folder'
}

function parentDirectory(filePath: string): string {
  const separator = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  )
  if (separator < 0) return filePath
  return filePath.slice(0, separator) || '/'
}

function isInsideOrEqual(childPath: string, parentPath: string): boolean {
  const normalizedChild = childPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedParent = parentPath.replace(/\\/g, '/').replace(/\/+$/, '')
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}/`)
  )
}

const initialTabs: EditorTab[] = []

export default function App() {
  const [tabs, setTabs] = useState<EditorTab[]>(initialTabs)
  const [activeTabId, setActiveTabId] = useState(initialTabs[0]?.id ?? '')
  const [mode, setMode] = useState<EditorMode>('split')
  const [sidebarMode, setSidebarMode] = useState<'files' | 'outline'>('files')
  const [dark, setDark] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<OpenDirectoryResult[]>([])
  const workspacesRef = useRef<OpenDirectoryResult[]>([])
  workspacesRef.current = workspaces
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const [pendingCreate, setPendingCreate] = useState<PendingCreateEntry | null>(null)
  const [pendingRename, setPendingRename] = useState<PendingRenameEntry | null>(null)
  const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(null)
  const [copiedFile, setCopiedFile] = useState<CopiedMarkdown | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteFileTarget | null>(null)
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null)
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [pendingAppClose, setPendingAppClose] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [currentSearchOpen, setCurrentSearchOpen] = useState(false)
  const [currentSearchQuery, setCurrentSearchQuery] = useState('')
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [currentSearchTotal, setCurrentSearchTotal] = useState(0)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<
    GlobalSearchMatch[]
  >([])
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [pendingSearchJump, setPendingSearchJump] =
    useState<GlobalSearchMatch | null>(null)
  const beforeCloseRef = useRef<() => void>(() => undefined)
  const sourceEditorRef = useRef<SourceEditorHandle>(null)
  const previewEditorRef = useRef<PreviewEditorHandle>(null)
  const splitPreviewRef = useRef<PreviewPaneHandle>(null)
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const currentSearchInputRef = useRef<HTMLInputElement>(null)
  const currentSearchRangesRef = useRef<Range[]>([])
  const nextId = useRef(3)
  const stateSaveTimerRef = useRef<number | null>(null)
  // macOS uses the native title bar and first-version topbar layout;
  // Windows/Linux use a hidden title bar and custom WindowControls.
  const isMac = window.mdwriter?.platform === 'darwin'

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const outlineHeadings = useMemo(
    () => extractOutline(activeTab?.content ?? ''),
    [activeTab?.content]
  )
  const outlineTree = useMemo(
    () => buildOutlineTree(outlineHeadings),
    [outlineHeadings]
  )

  const buildAppState = (
    tabList: EditorTab[] = tabs,
    activeId = activeTab?.id ?? ''
  ): AppState => ({
    version: 1,
    workspaces: workspaces.map((workspace) => workspace.path),
    tabs: tabList.map((tab) => ({
      id: tab.id,
      title: tab.title,
      path: tab.path,
      dirty: tab.dirty,
      ...(tab.dirty || !tab.path ? { content: tab.content } : {})
    })),
    activeTabId: activeId,
    editorMode: mode,
    dark,
    sidebarWidth
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    ;(window as any).__workspaces = workspaces.map((ws) => ws.path)
  }, [workspaces])

  useEffect(() => {
    if (!window.mdwriter) return
    const handler = (max: boolean) => setMaximized(max)
    window.mdwriter.onMaximizeChanged(handler)
    return () => window.mdwriter?.offMaximizeChanged(handler)
  }, [])

  useEffect(() => {
    let cancelled = false

    const restore = async (): Promise<void> => {
      const mdwriter = window.mdwriter
      if (!mdwriter) {
        setHydrated(true)
        return
      }

      const saved = await mdwriter.loadAppState()
      if (cancelled) return

      if (!saved) {
        setHydrated(true)
        return
      }

      const [workspaceResults, tabResults] = await Promise.all([
        Promise.all(
          (saved.workspaces ?? []).map(
            async (path): Promise<OpenDirectoryResult | null> => {
              try {
                return await mdwriter.readDirectory(path)
              } catch {
                // Missing folders are skipped during restore.
                return null
              }
            }
          )
        ),
        Promise.all(
          saved.tabs.map(async (savedTab): Promise<EditorTab | null> => {
            if (savedTab.path && !savedTab.dirty) {
              try {
                const file = await mdwriter.readFile(savedTab.path)
                return {
                  id: savedTab.id,
                  title: savedTab.title,
                  path: savedTab.path,
                  content: relativizeImagePaths(file.content, savedTab.path),
                  dirty: false
                }
              } catch {
                // Files that no longer exist are skipped.
                return null
              }
            }

            let content = savedTab.path
              ? relativizeImagePaths(savedTab.content ?? '', savedTab.path)
              : savedTab.content ?? ''
            if (!content && savedTab.path) {
              try {
                content = relativizeImagePaths(
                  (await mdwriter.readFile(savedTab.path)).content,
                  savedTab.path
                )
              } catch {
                // Keep the cached draft when the original file is missing.
              }
            }
            return {
              id: savedTab.id,
              title: savedTab.title,
              path: savedTab.path,
              content,
              dirty: savedTab.dirty
            }
          })
        )
      ])

      const restoredWorkspaces = workspaceResults.filter(
        (workspace): workspace is OpenDirectoryResult => workspace !== null
      )
      const restoredTabs = tabResults.filter(
        (tab): tab is EditorTab => tab !== null
      )

      if (restoredTabs.length === 0) {
        const id = String(nextId.current)
        nextId.current += 1
        restoredTabs.push({
          id,
          title: `Untitled-${id}.md`,
          content: '# Untitled\n\n开始写作。',
          path: null,
          dirty: false
        })
      }

      const maxNumericId = restoredTabs.reduce((max, tab) => {
        const value = Number(tab.id)
        return Number.isFinite(value) ? Math.max(max, value) : max
      }, 2)
      nextId.current = maxNumericId + 1

      setWorkspaces(restoredWorkspaces)
      setTabs(restoredTabs)
      setActiveTabId(
        restoredTabs.some((tab) => tab.id === saved.activeTabId)
          ? saved.activeTabId
          : restoredTabs[0].id
      )
      setMode(saved.editorMode)
      setDark(saved.dark)
      setSidebarWidth(saved.sidebarWidth)
      setHydrated(true)
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !window.mdwriter) return
    const state = buildAppState()
    const timeout = window.setTimeout(() => {
      stateSaveTimerRef.current = null
      void window.mdwriter?.saveAppState(state)
    }, 400)
    stateSaveTimerRef.current = timeout
    return () => {
      if (stateSaveTimerRef.current !== null) {
        window.clearTimeout(stateSaveTimerRef.current)
        stateSaveTimerRef.current = null
      }
    }
  }, [
    hydrated,
    tabs,
    activeTab?.id,
    workspaces,
    mode,
    dark,
    sidebarWidth
  ])

  useEffect(() => {
    if (!contextMenu) return

    const close = (): void => setContextMenu(null)
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  const updateActiveContent = (content: string): void => {
    if (!activeTab) return
    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeTab?.id
          ? {
              ...tab,
              content,
              dirty: tab.content !== content ? true : tab.dirty
            }
          : tab
      )
    )
  }

  const addTab = (): void => {
    const id = String(nextId.current)
    nextId.current += 1
    const tab: EditorTab = {
      id,
      title: `Untitled-${id}.md`,
      content: '# Untitled\n\n开始写作。',
      path: null,
      dirty: false
    }
    setTabs((current) => [...current, tab])
    setActiveTabId(id)
  }

  const closeTab = (id: string): void => {
    const index = tabs.findIndex((tab) => tab.id === id)
    const nextTabs = tabs.filter((tab) => tab.id !== id)
    setTabs(nextTabs)
    if (activeTabId === id) {
      const nextId = nextTabs[Math.max(0, index - 1)]?.id ?? ''
      setActiveTabId(nextId)
    }
  }

  const requestCloseTab = (id: string): void => {
    const tab = tabs.find((item) => item.id === id)
    if (!tab) return
    if (tab.dirty) {
      setPendingCloseTabId(id)
      return
    }
    closeTab(id)
  }

  const stats = useMemo(() => {
    const content = activeTab?.content ?? ''
    const withoutImages = content.replace(
      /!\[[^\]]*\]\((?:data:image\/[^)]+|[^)]+)\)/g,
      ''
    )
    const words = withoutImages.trim().split(/\s+/).filter(Boolean).length
    return {
      words,
      chars: withoutImages.length
    }
  }, [activeTab?.content])

  const modeLabel = {
    source: '源码',
    split: '分栏',
    preview: '预览编辑'
  }[mode]

  const canPaste =
    copiedFile !== null &&
    contextMenu !== null &&
    !isInsideOrEqual(
      contextMenu.kind === 'file'
        ? contextMenu.directoryPath
        : contextMenu.path,
      copiedFile.sourcePath
    )

  const openDirectory = async (): Promise<void> => {
    const result = await window.mdwriter?.openDirectory()
    if (result) {
      setWorkspaces((current) =>
        current.some((workspace) => workspace.path === result.path)
          ? current
          : [...current, result]
      )
      setSelectedFolderPath(result.path)
    }
  }

  const refreshWorkspaces = async (
    roots: OpenDirectoryResult[] = workspaces
  ): Promise<void> => {
    const mdwriter = window.mdwriter
    if (!mdwriter) return

    const refreshed = await Promise.all(
      roots.map(async (root) => {
        try {
          return await mdwriter.readDirectory(root.path)
        } catch {
          return root
        }
      })
    )

    setWorkspaces((current) =>
      current.map(
        (existing) =>
          refreshed.find((root) => root.path === existing.path) ?? existing
      )
    )
  }

  useEffect(() => {
    if (!window.mdwriter) return

    const handleWorkspaceChanged = (changedPath: string): void => {
      const roots = workspacesRef.current.filter(
        (workspace) => workspace.path === changedPath
      )
      if (roots.length > 0) void refreshWorkspaces(roots)
    }

    window.mdwriter.onWorkspaceChanged(handleWorkspaceChanged)
    return () => window.mdwriter?.offWorkspaceChanged(handleWorkspaceChanged)
  }, [])

  useEffect(() => {
    window.mdwriter?.setWatchedWorkspaces(
      workspaces.map((workspace) => workspace.path)
    )
  }, [workspaces])

  const openReadFile = (file: ReadFileResult): void => {
    const existing = tabs.find((tab) => tab.path === file.path)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    const id = String(nextId.current)
    nextId.current += 1
    const tab: EditorTab = {
      id,
      title: file.path.split(/[\\/]/).pop() ?? '未命名.md',
      content: relativizeImagePaths(file.content, file.path),
      path: file.path,
      dirty: false
    }
    setTabs((current) => [...current, tab])
    setActiveTabId(id)
  }

  const openFileFromTree = async (node: FileNode): Promise<void> => {
    if (node.type !== 'file' || !window.mdwriter) return
    if (node.kind === 'pdf') {
      await window.mdwriter.openPath(node.path)
      return
    }
    const file = await window.mdwriter.readFile(node.path)
    openReadFile(file)
  }

  const createMarkdownFile = (): void => {
    if (!window.mdwriter) return

    if (workspaces.length === 0) {
      void (async () => {
        const result = await window.mdwriter?.saveFile({
          path: null,
          content: '# 新建文档\n',
          defaultName: '新建文档.md'
        })
        if (result?.path) {
          const file = await window.mdwriter?.readFile(result.path)
          if (file) openReadFile(file)
        }
      })()
      return
    }

    setPendingCreate({
      type: 'file',
      directoryPath: selectedFolderPath ?? workspaces[0].path
    })
  }

  const createFolder = (): void => {
    if (workspaces.length === 0) return
    setPendingCreate({
      type: 'folder',
      directoryPath: selectedFolderPath ?? workspaces[0].path
    })
  }

  const handleCreateEntry = async (name: string): Promise<void> => {
    if (!pendingCreate || !window.mdwriter) return

    const entry = pendingCreate
    setPendingCreate(null)

    try {
      if (entry.type === 'file') {
        const result = await window.mdwriter.createFile({
          directoryPath: entry.directoryPath,
          name,
          content: '# 新建文档\n'
        })
        await refreshWorkspaces()
        const file = await window.mdwriter.readFile(result.path)
        openReadFile(file)
      } else {
        const result = await window.mdwriter.createDirectory({
          directoryPath: entry.directoryPath,
          name
        })
        const folderName = result.path.split(/[\\/]/).pop()?.toLowerCase()
        if (folderName !== 'images') {
          // Create images/ subdirectory for regular content folders.
          try {
            await window.mdwriter.createDirectory({
              directoryPath: result.path,
              name: 'images'
            })
          } catch {
            // Non-critical; image saving will handle missing images/ gracefully
          }
        }
        await refreshWorkspaces()
      }
    } catch {
      setPendingCreate(entry)
    }
  }

  const removeWorkspace = (path: string): void => {
    setPendingCreate(null)
    setPendingRename(null)
    setWorkspaces((current) =>
      current.filter((workspace) => workspace.path !== path)
    )
    setSelectedFolderPath((current) => {
      if (
        !current ||
        current === path ||
        current.startsWith(`${path}/`) ||
        current.startsWith(`${path}\\`)
      ) {
        return null
      }
      return current
    })
  }

  const handleFileContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    node: FileNode
  ): void => {
    const directoryPath =
      node.type === 'file' ? parentDirectory(node.path) : node.path
    setSelectedFolderPath(directoryPath)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      path: node.path,
      name: node.name,
      isRoot:
        node.type === 'directory' &&
        workspaces.some((workspace) => workspace.path === node.path),
      kind: node.type === 'file' ? 'file' : 'folder',
      directoryPath
    })
  }

  const handleContextNewFile = (): void => {
    if (!contextMenu) return
    setPendingRename(null)
    setSelectedFolderPath(contextMenu.path)
    setPendingCreate({ type: 'file', directoryPath: contextMenu.path })
  }

  const handleContextNewFolder = (): void => {
    if (!contextMenu) return
    setPendingRename(null)
    setSelectedFolderPath(contextMenu.path)
    setPendingCreate({ type: 'folder', directoryPath: contextMenu.path })
  }

  const handleContextRename = (): void => {
    if (!contextMenu) return
    setPendingCreate(null)
    setPendingRename({
      path: contextMenu.path,
      name: contextMenu.name,
      kind: contextMenu.kind
    })
  }

  const rebasePathsForMove = (
    oldPath: string,
    newPath: string,
    kind: 'file' | 'folder'
  ): void => {
    setTabs((current) =>
      current.map((tab) => {
        if (tab.path === oldPath) {
          return {
            ...tab,
            path: newPath,
            title: newPath.split(/[\\/]/).pop() ?? tab.title
          }
        }

        if (kind === 'folder') {
          const separator = oldPath.includes('\\') ? '\\' : '/'
          const prefix = oldPath.endsWith(separator)
            ? oldPath
            : `${oldPath}${separator}`
          if (tab.path?.startsWith(prefix)) {
            const nextPath = `${newPath}${tab.path.slice(prefix.length)}`
            return {
              ...tab,
              path: nextPath,
              title: nextPath.split(/[\\/]/).pop() ?? tab.title
            }
          }
        }

        return tab
      })
    )

    setSelectedFolderPath((current) => {
      if (!current) return current
      if (current === oldPath) return newPath
      if (kind === 'folder') {
        const separator = oldPath.includes('\\') ? '\\' : '/'
        const prefix = oldPath.endsWith(separator)
          ? oldPath
          : `${oldPath}${separator}`
        if (current.startsWith(prefix)) {
          return `${newPath}${current.slice(prefix.length)}`
        }
      }
      return current
    })
  }

  const handleRenameEntry = async (name: string): Promise<void> => {
    if (!pendingRename || !window.mdwriter) return

    const entry = pendingRename
    const oldPath = entry.path
    setPendingRename(null)

    try {
      const result = await window.mdwriter.renameEntry({
        sourcePath: oldPath,
        name
      })

      let rootsToRefresh = workspaces
      if (entry.kind === 'folder' && workspaces.some((root) => root.path === oldPath)) {
        const renamedRoot = await window.mdwriter.readDirectory(result.path)
        rootsToRefresh = workspaces.map((root) =>
          root.path === oldPath ? renamedRoot : root
        )
      }
      await refreshWorkspaces(rootsToRefresh)
      rebasePathsForMove(oldPath, result.path, entry.kind)
    } catch {
      setPendingRename(entry)
    }
  }

  const handleContextRemoveRoot = (): void => {
    if (!contextMenu) return
    removeWorkspace(contextMenu.path)
  }

  const handleContextCopyFile = (): void => {
    if (!contextMenu) return
    setCopiedFile({
      sourcePath: contextMenu.path,
      name: contextMenu.name,
      kind: contextMenu.kind,
      action: 'copy'
    })
  }

  const handleContextCutFile = (): void => {
    if (!contextMenu) return
    setCopiedFile({
      sourcePath: contextMenu.path,
      name: contextMenu.name,
      kind: contextMenu.kind,
      action: 'cut'
    })
  }

  const handleContextPaste = async (): Promise<void> => {
    if (!contextMenu || !copiedFile || !window.mdwriter) return
    const destinationDirectory =
      contextMenu.kind === 'file'
        ? contextMenu.directoryPath
        : contextMenu.path

    if (isInsideOrEqual(destinationDirectory, copiedFile.sourcePath)) {
      return
    }

    if (copiedFile.action === 'cut') {
      const result = await window.mdwriter.cutFile({
        sourcePath: copiedFile.sourcePath,
        destinationDirectory
      })
      rebasePathsForMove(
        copiedFile.sourcePath,
        result.path,
        copiedFile.kind
      )
      setCopiedFile(null)
    } else {
      await window.mdwriter.copyFile({
        sourcePath: copiedFile.sourcePath,
        destinationDirectory
      })
    }
    await refreshWorkspaces()
  }

  const handleContextDeleteFile = (): void => {
    if (!contextMenu) return
    setPendingRename(null)
    setDeleteTarget({
      path: contextMenu.path,
      name: contextMenu.name,
      kind: contextMenu.kind
    })
  }

  const handleDeleteFile = async (): Promise<void> => {
    if (!deleteTarget || !window.mdwriter) return

    const target = deleteTarget
    setDeleteTarget(null)

    if (target.kind === 'folder') {
      // Close all tabs that are inside the deleted folder
      const separator = target.path.includes('\\') ? '\\' : '/'
      const prefix = target.path.endsWith(separator)
        ? target.path
        : `${target.path}${separator}`
      const remaining = tabs.filter((tab) => {
        if (!tab.path) return true
        return !tab.path.startsWith(prefix)
      })
      await window.mdwriter.deleteFile({ path: target.path })
      await refreshWorkspaces()

      if (remaining.length === 0) {
        setTabs([])
        setActiveTabId('')
        return
      }

      setTabs(remaining)
      if (activeTab && remaining.every((t) => t.id !== activeTab.id)) {
        const index = tabs.findIndex((tab) => tab.id === activeTab?.id)
        setActiveTabId(
          remaining[Math.max(0, index - 1)]?.id ?? remaining[0].id
        )
      }
      return
    }

    const remaining = tabs.filter((tab) => tab.path !== target.path)
    await window.mdwriter.deleteFile({ path: target.path })
    await refreshWorkspaces()

    if (remaining.length === 0) {
      setTabs([])
      setActiveTabId('')
      return
    }

    setTabs(remaining)
    if (activeTab?.path === target.path) {
      const index = tabs.findIndex((tab) => tab.id === activeTab?.id)
      setActiveTabId(
        remaining[Math.max(0, index - 1)]?.id ?? remaining[0].id
      )
    }
  }

  const saveTab = async (id: string): Promise<string | null> => {
    if (!window.mdwriter) return null
    const tab = tabs.find((item) => item.id === id)
    if (!tab) return null

    // Markdown files should keep relative image paths. On first save, temp
    // images are also moved into the file's images directory.
    const content = tab.path ? relativizeImagePaths(tab.content, tab.path) : tab.content

    const result = await window.mdwriter.saveFile({
      path: tab.path,
      content,
      defaultName: tab.title
    })

    if (!result.canceled && result.path) {
      const savedPath = result.path
      let processedContent = content

      // First save - resolve temporary images to permanent directory
      if (!tab.path) {
        const fileDir = savedPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
        processedContent = await resolveTempImages(content, fileDir)
        const relativeContent = relativizeImagePaths(processedContent, savedPath)

        if (relativeContent !== content) {
          // Save again with updated image paths
          await window.mdwriter.saveFile({
            path: savedPath,
            content: relativeContent,
            defaultName: tab.title
          })
          processedContent = relativeContent
        }
      }

      setTabs((current) =>
        current.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                path: savedPath,
                title: savedPath.split(/[\\/]/).pop() ?? tab.title,
                content: processedContent,
                dirty: false
              }
            : tab
        )
      )
      if (savedPath !== tab.path) {
        await refreshWorkspaces()
      }
      return savedPath
    }

    return null
  }

  const saveActiveTab = async (): Promise<void> => {
    if (!activeTab) return
    await saveTab(activeTab.id)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActiveTab()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openCurrentSearch()
      }
      if (event.key === 'Escape' && currentSearchOpen) {
        event.preventDefault()
        closeCurrentSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveTab, currentSearchOpen])

  useEffect(() => {
    if (!pendingSearchJump) return

    const target = pendingSearchJump
    setPendingSearchJump(null)
    requestAnimationFrame(() => {
      if (mode === 'preview') {
        previewEditorRef.current?.scrollToText(target.snippet)
      } else {
        sourceEditorRef.current?.scrollToLine(target.line)
      }
    })
  }, [pendingSearchJump, mode, activeTab?.id])

  useEffect(() => {
    closeCurrentSearch()
  }, [activeTab?.id])

  const handleBeforeClose = async (): Promise<void> => {
    if (!window.mdwriter) return

    const dirtyTabs = tabs.filter((tab) => tab.dirty)
    if (dirtyTabs.length > 0) {
      setPendingAppClose(true)
      return
    }

    if (stateSaveTimerRef.current !== null) {
      window.clearTimeout(stateSaveTimerRef.current)
      stateSaveTimerRef.current = null
    }
    await window.mdwriter.saveAppState(buildAppState())
    window.mdwriter.confirmClose()
  }

  beforeCloseRef.current = () => {
    void handleBeforeClose()
  }

  useEffect(() => {
    if (!window.mdwriter) return
    const handler = () => beforeCloseRef.current()
    window.mdwriter.onBeforeClose(handler)
    return () => window.mdwriter?.offBeforeClose(handler)
  }, [])

  const handleAppCloseSaveAll = async (): Promise<void> => {
    if (!window.mdwriter) return

    const savedPaths = new Map<string, string>()
    for (const tab of tabs) {
      if (!tab.dirty) continue
      const savedPath = await saveTab(tab.id)
      if (!savedPath) {
        window.mdwriter.cancelClose()
        return
      }
      savedPaths.set(tab.id, savedPath)
    }

    const finalTabs = tabs.map((tab) => {
      const savedPath = savedPaths.get(tab.id)
      return savedPath ? { ...tab, path: savedPath, dirty: false } : tab
    })
    if (stateSaveTimerRef.current !== null) {
      window.clearTimeout(stateSaveTimerRef.current)
      stateSaveTimerRef.current = null
    }
    await window.mdwriter.saveAppState(
      buildAppState(finalTabs, activeTab?.id)
    )
    setPendingAppClose(false)
    window.mdwriter.confirmClose()
  }

  const handleAppCloseDiscardAll = async (): Promise<void> => {
    if (!window.mdwriter) return

    const finalTabs = tabs
      .filter((tab) => tab.path !== null)
      .map((tab) => ({ ...tab, dirty: false }))
    const finalActiveId = finalTabs.some((tab) => tab.id === activeTab?.id)
      ? activeTab?.id ?? ''
      : finalTabs[0]?.id ?? ''
    if (stateSaveTimerRef.current !== null) {
      window.clearTimeout(stateSaveTimerRef.current)
      stateSaveTimerRef.current = null
    }
    await window.mdwriter.saveAppState(
      buildAppState(finalTabs, finalActiveId)
    )
    setPendingAppClose(false)
    window.mdwriter.confirmClose()
  }

  const handleAppCloseCancel = (): void => {
    setPendingAppClose(false)
    window.mdwriter?.cancelClose()
  }

  const handleDialogSave = async (): Promise<void> => {
    if (!pendingCloseTabId) return
    if ((await saveTab(pendingCloseTabId)) !== null) {
      setPendingCloseTabId(null)
      closeTab(pendingCloseTabId)
    }
  }

  const handleDialogDiscard = (): void => {
    if (!pendingCloseTabId) return
    const id = pendingCloseTabId
    setPendingCloseTabId(null)
    closeTab(id)
  }

  const exportPdf = async (): Promise<void> => {
    if (!window.mdwriter || !activeTab) return

    const defaultName = activeTab.title.replace(/\.md$/i, '') + '.pdf'
    const { buildExportHtml } = await import('./markdown/renderer')
    await window.mdwriter.exportPdf({
      html: await buildExportHtml(
        resolveImagePaths(activeTab.content, activeTab.path),
        dark
      ),
      defaultName
    })
  }

  const handleOutlineSelect = (heading: OutlineHeading): void => {
    setActiveOutlineId(heading.id)
    if (mode === 'source') {
      sourceEditorRef.current?.focusHeading(heading.line)
    } else if (mode === 'preview') {
      previewEditorRef.current?.scrollToHeading(heading)
    } else {
      splitPreviewRef.current?.scrollToHeading(heading)
    }
  }

  const applyCurrentSearchHighlights = (
    ranges: Range[],
    index: number
  ): void => {
    const registry = (
      CSS as unknown as {
        highlights?: {
          set: (name: string, value: unknown) => void
          delete: (name: string) => void
        }
      }
    ).highlights
    const HighlightCtor = (
      globalThis as unknown as {
        Highlight?: new (...ranges: Range[]) => unknown
      }
    ).Highlight
    if (!registry || !HighlightCtor) return

    registry.delete('mdwriter-search')
    registry.delete('mdwriter-search-current')
    if (ranges.length === 0) return

    registry.set('mdwriter-search', new HighlightCtor(...ranges))
    if (index >= 0 && index < ranges.length) {
      registry.set(
        'mdwriter-search-current',
        new HighlightCtor(ranges[index])
      )
    }
  }

  const collectCurrentSearchRanges = (query: string): Range[] => {
    const root = editorAreaRef.current
    if (!root || !query.trim()) return []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (
          parent?.closest(
            '.cm-gutters, script, style, textarea, select, [data-mermaid-source]'
          )
        ) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const ranges: Range[] = []
    let node: Node | null

    while ((node = walker.nextNode()) && ranges.length < 2000) {
      const textNode = node as Text
      for (const match of findFuzzyRanges(textNode.nodeValue ?? '', query)) {
        const range = document.createRange()
        range.setStart(textNode, match.start)
        range.setEnd(textNode, match.end)
        ranges.push(range)
        if (ranges.length >= 2000) break
      }
    }

    return ranges
  }

  const jumpToCurrentSearch = (index: number): void => {
    const ranges = currentSearchRangesRef.current
    if (ranges.length === 0) {
      setCurrentSearchIndex(0)
      applyCurrentSearchHighlights([], -1)
      return
    }

    const safeIndex = ((index % ranges.length) + ranges.length) % ranges.length
    setCurrentSearchIndex(safeIndex)
    applyCurrentSearchHighlights(ranges, safeIndex)

    const range = ranges[safeIndex]
    const block =
      range.startContainer.parentElement?.closest(
        'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, .cm-line'
      ) ?? range.startContainer.parentElement
    block?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const updateCurrentSearchQuery = (query: string): void => {
    setCurrentSearchQuery(query)
    const ranges = collectCurrentSearchRanges(query)
    currentSearchRangesRef.current = ranges
    setCurrentSearchTotal(ranges.length)
    if (ranges.length === 0) {
      setCurrentSearchIndex(0)
      applyCurrentSearchHighlights([], -1)
      return
    }
    jumpToCurrentSearch(0)
  }

  const openCurrentSearch = (): void => {
    setCurrentSearchOpen(true)
    requestAnimationFrame(() => currentSearchInputRef.current?.focus())
  }

  const closeCurrentSearch = (): void => {
    setCurrentSearchOpen(false)
    setCurrentSearchQuery('')
    setCurrentSearchIndex(0)
    setCurrentSearchTotal(0)
    currentSearchRangesRef.current = []
    applyCurrentSearchHighlights([], -1)
  }

  const moveCurrentSearch = (direction: number): void => {
    if (currentSearchRangesRef.current.length === 0) return
    jumpToCurrentSearch(currentSearchIndex + direction)
  }

  const openGlobalSearch = (): void => {
    setSidebarMode('files')
    setGlobalSearchOpen(true)
    setGlobalSearchQuery('')
    setGlobalSearchResults([])
  }

  const closeGlobalSearch = (): void => {
    setGlobalSearchOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchResults([])
  }

  const runGlobalSearch = async (query: string): Promise<void> => {
    const trimmed = query.trim()
    setGlobalSearchQuery(trimmed)
    setGlobalSearchResults([])
    if (!window.mdwriter || !trimmed || workspaces.length === 0) {
      setGlobalSearchLoading(false)
      return
    }

    setGlobalSearchLoading(true)
    try {
      const settled = await Promise.all(
        workspaces.map((workspace) =>
          window.mdwriter?.searchDirectory({
            path: workspace.path,
            query: trimmed
          })
        )
      )
      const unique = new Map<string, GlobalSearchMatch>()
      for (const matches of settled) {
        for (const match of matches ?? []) {
          unique.set(`${match.path}:${match.line}:${match.start}`, match)
        }
      }
      setGlobalSearchResults(
        Array.from(unique.values()).sort(
          (left, right) =>
            left.path.localeCompare(right.path) || left.line - right.line
        )
      )
    } finally {
      setGlobalSearchLoading(false)
    }
  }

  const openFileByPath = async (path: string): Promise<void> => {
    const existing = tabs.find((tab) => tab.path === path)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }
    if (!window.mdwriter) return

    const file = await window.mdwriter.readFile(path)
    openReadFile(file)
  }

  const handleGlobalSearchSelect = async (
    match: GlobalSearchMatch
  ): Promise<void> => {
    await openFileByPath(match.path)
    setMode('preview')
    setPendingSearchJump(match)
  }

  const tabStrip = (
    <div
      className="tab-strip"
      role="tablist"
      aria-label="打开的文档"
      onWheel={(event) => {
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY
        event.currentTarget.scrollLeft += delta
      }}
    >
      {tabs.map((tab) => (
        <div
          className={`tab${tab.id === activeTab?.id ? ' active' : ''}`}
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab?.id}
          onClick={() => setActiveTabId(tab.id)}
        >
          <span>{tab.title}</span>
          {tab.dirty && <span className="tab-dirty-dot" aria-label="未保存" />}
          <button
            className="tab-close"
            type="button"
            aria-label={`关闭 ${tab.title}`}
            onClick={(event) => {
              event.stopPropagation()
              requestCloseTab(tab.id)
            }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )

  const topActions = (
    <div className="top-actions">
      <button
        className="icon-button"
        type="button"
        data-tooltip="保存"
        aria-label="保存"
        onClick={saveActiveTab}
      >
        <Save size={16} />
      </button>
      <button
        className="icon-button"
        type="button"
        data-tooltip="新建标签页"
        aria-label="新建标签页"
        onClick={addTab}
      >
        <FilePlus2 size={16} />
      </button>
      <button
        className="icon-button"
        type="button"
        data-tooltip="添加文件夹"
        aria-label="添加文件夹"
        onClick={openDirectory}
      >
        <FolderOpen size={16} />
      </button>
      <button
        className="icon-button"
        type="button"
        data-tooltip="导出 PDF"
        aria-label="导出 PDF"
        onClick={exportPdf}
      >
        <FileDown size={16} />
      </button>
      <button
        className="icon-button"
        type="button"
        data-tooltip="快捷键"
        aria-label="快捷键"
        onClick={() => setShowShortcuts(true)}
      >
        <Keyboard size={16} />
      </button>
      <button
        className="icon-button"
        type="button"
        data-tooltip="切换主题"
        aria-label="切换主题"
        onClick={() => setDark((value) => !value)}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  )

  return (
    <div
      className={`app-shell${resizingSidebar ? ' resizing-sidebar' : ''}${isMac ? ' platform-darwin' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={appIcon} alt="MDWriter" />
          <div>
            <div className="brand-name">MDWriter</div>
            <div className="brand-sub">local markdown</div>
          </div>
        </div>
        {isMac ? (
          <>
            {tabStrip}
            {topActions}
          </>
        ) : (
          <>
            <span className="topbar-spacer" />
            <WindowControls maximized={maximized} />
          </>
        )}
      </header>

      <aside className="sidebar">
        <div className="sidebar-controls">
          <div className="sidebar-mode-switch" role="group" aria-label="侧边栏模式">
            <button
              className={`sidebar-mode-button${sidebarMode === 'files' ? ' active' : ''}`}
              type="button"
              onClick={() => setSidebarMode('files')}
            >
              <FolderOpen size={13} />
              <span>文件</span>
            </button>
            <button
              className={`sidebar-mode-button${sidebarMode === 'outline' ? ' active' : ''}`}
              type="button"
              onClick={() => setSidebarMode('outline')}
            >
              <ListTree size={13} />
              <span>目录</span>
            </button>
          </div>
        </div>
        <div className="sidebar-scroll">
          {sidebarMode === 'files' ? (
            <>
              {globalSearchOpen ? (
                <GlobalSearchBar
                  query={globalSearchQuery}
                  loading={globalSearchLoading}
                  onQueryChange={setGlobalSearchQuery}
                  onSearch={(query) => void runGlobalSearch(query)}
                  onBack={closeGlobalSearch}
                />
              ) : (
                <div className="file-header">
                  <span className="file-header-title">文件夹</span>
                  <div className="file-header-actions">
                    <button
                      className="file-action-button"
                      type="button"
                      data-tooltip="全局搜索"
                      aria-label="全局搜索"
                      onClick={openGlobalSearch}
                    >
                      <Search size={13} />
                    </button>
                    <button
                      className="file-action-button"
                      type="button"
                      data-tooltip="新建 Markdown 文件"
                      aria-label="新建 Markdown 文件"
                      disabled={workspaces.length === 0}
                      onClick={createMarkdownFile}
                    >
                      <FilePlus2 size={13} />
                    </button>
                    <button
                      className="file-action-button"
                      type="button"
                      data-tooltip="新建文件夹"
                      aria-label="新建文件夹"
                      disabled={workspaces.length === 0}
                      onClick={createFolder}
                    >
                      <FolderPlus size={13} />
                    </button>
                    <button
                      className="file-action-button"
                      type="button"
                      data-tooltip="添加文件夹"
                      aria-label="添加文件夹"
                      onClick={openDirectory}
                    >
                      <FolderOpen size={13} />
                    </button>
                  </div>
                </div>
              )}
              {globalSearchOpen ? (
                globalSearchLoading ? (
                  <div className="global-search-state">搜索中...</div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="global-search-state">
                    {globalSearchQuery ? '没有匹配结果' : '输入关键词后回车搜索'}
                  </div>
                ) : (
                  <GlobalSearchResults
                    results={globalSearchResults}
                    query={globalSearchQuery}
                    onSelect={(match) => void handleGlobalSearchSelect(match)}
                  />
                )
              ) : workspaces.length > 0 ? (
                <FileTree
                  roots={workspaces}
                  activePath={activeTab?.path ?? null}
                  selectedFolderPath={selectedFolderPath}
                  pendingCreate={pendingCreate}
                  onOpenFile={openFileFromTree}
                  onSelectFolder={setSelectedFolderPath}
                  onContextMenu={handleFileContextMenu}
                  pendingRename={pendingRename}
                  onCreateName={(name) => void handleCreateEntry(name)}
                  onCancelCreate={() => setPendingCreate(null)}
                  onRenameName={(name) => void handleRenameEntry(name)}
                  onCancelRename={() => setPendingRename(null)}
                />
              ) : (
                <div className="file-list">
                  {tabs.map((tab) => (
                    <button
                      className={`file-item${tab.id === activeTab?.id ? ' active' : ''}`}
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      <Code2 size={15} />
                      <span>{tab.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <OutlineTree
              nodes={outlineTree}
              activeId={activeOutlineId}
              onSelect={handleOutlineSelect}
            />
          )}
        </div>
      </aside>

      <div
        className={`sidebar-resizer${resizingSidebar ? ' active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setResizingSidebar(true)
        }}
        onPointerMove={(event) => {
          if (!resizingSidebar) return
          setSidebarWidth(Math.min(420, Math.max(180, event.clientX)))
        }}
        onPointerUp={(event) => {
          setResizingSidebar(false)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={(event) => {
          setResizingSidebar(false)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
      />

      <main className="workspace">
        <div className="toolbar">
          <div className="mode-switch" role="group" aria-label="编辑模式">
            <button
              className={`mode-button${mode === 'source' ? ' active' : ''}`}
              type="button"
              onClick={() => setMode('source')}
            >
              <Code2 size={15} />
              <span>源码</span>
            </button>
            <button
              className={`mode-button${mode === 'split' ? ' active' : ''}`}
              type="button"
              onClick={() => setMode('split')}
            >
              <Columns2 size={15} />
              <span>分栏</span>
            </button>
            <button
              className={`mode-button${mode === 'preview' ? ' active' : ''}`}
              type="button"
              onClick={() => setMode('preview')}
            >
              <Eye size={15} />
              <span>预览编辑</span>
            </button>
          </div>
          {!isMac && (
            <>
              {tabStrip}
              {topActions}
            </>
          )}
        </div>

        <div className="editor-area" ref={editorAreaRef}>
          {currentSearchOpen && (
            <CurrentSearchBar
              query={currentSearchQuery}
              matchIndex={currentSearchIndex}
              matchTotal={currentSearchTotal}
              inputRef={currentSearchInputRef}
              onQueryChange={updateCurrentSearchQuery}
              onPrev={() => moveCurrentSearch(-1)}
              onNext={() => moveCurrentSearch(1)}
              onClose={closeCurrentSearch}
            />
          )}
          {!activeTab ? (
            <div className="empty-welcome">
              <div className="empty-welcome-content">
                <div className="empty-welcome-brand">
                  <img className="empty-welcome-icon" src={appIcon} alt="MDWriter" />
                </div>
                <h2 className="empty-welcome-title">MDWriter</h2>
                <p className="empty-welcome-sub">local markdown</p>
                <div className="empty-welcome-actions">
                  <button
                    className="empty-welcome-button"
                    type="button"
                    onClick={openDirectory}
                  >
                    <FolderOpen size={16} />
                    <span>打开文件夹</span>
                  </button>
                  <button
                    className="empty-welcome-button"
                    type="button"
                    onClick={createMarkdownFile}
                  >
                    <FilePlus2 size={16} />
                    <span>新建文件</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="editor-loading">正在加载编辑器…</div>}>
              {mode === 'source' && (
                <SourceEditor
                  ref={sourceEditorRef}
                  key={`${activeTab.id}-source`}
                  value={activeTab.content}
                  onChange={updateActiveContent}
                  dark={dark}
                />
              )}
              {mode === 'split' && (
                <div className="split-view">
                  <div className="editor-pane">
                    <SourceEditor
                      ref={sourceEditorRef}
                      key={`${activeTab.id}-split-source`}
                      value={activeTab.content}
                      onChange={updateActiveContent}
                      dark={dark}
                    />
                  </div>
                  <div className="preview-pane">
                    <PreviewPane
                      ref={splitPreviewRef}
                      markdown={resolveImagePaths(
                        activeTab.content,
                        activeTab.path
                      )}
                      dark={dark}
                      onImagePreview={setLightboxSrc}
                    />
                  </div>
                </div>
              )}
              {mode === 'preview' && (
                <div className="preview-editor-wrap">
                  <PreviewEditor
                    ref={previewEditorRef}
                    key={`${activeTab.id}-preview`}
                    value={resolveImagePaths(activeTab.content, activeTab.path)}
                    onChange={updateActiveContent}
                    onImagePreview={setLightboxSrc}
                    filePath={activeTab.path}
                    dark={dark}
                  />
                </div>
              )}
            </Suspense>
          )}
        </div>
      </main>

      <footer className="statusbar">
        <span>{modeLabel}</span>
        <span>{stats.words} 词</span>
        <span>{stats.chars} 字符</span>
        <span className="status-spacer" />
        {window.mdwriter && (
          <span>Electron {window.mdwriter.versions.electron}</span>
        )}
      </footer>

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kind={contextMenu.kind}
          isRoot={contextMenu.isRoot}
          canPaste={canPaste}
          onNewFile={handleContextNewFile}
          onNewFolder={handleContextNewFolder}
          onRename={handleContextRename}
          onCopyFile={handleContextCopyFile}
          onCutFile={handleContextCutFile}
          onPaste={() => void handleContextPaste()}
          onDeleteFile={handleContextDeleteFile}
          onRemoveRoot={handleContextRemoveRoot}
          onClose={() => setContextMenu(null)}
        />
      )}

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {pendingCloseTabId && (
        <UnsavedDialog
          title={tabs.find((tab) => tab.id === pendingCloseTabId)?.title ?? '文档'}
          onSave={() => void handleDialogSave()}
          onDiscard={handleDialogDiscard}
          onCancel={() => setPendingCloseTabId(null)}
        />
      )}

      {deleteTarget && (
        <FileDeleteDialog
          name={deleteTarget.name}
          kind={deleteTarget.kind}
          warning={
            deleteTarget.kind === 'folder'
              ? '此操作会永久删除该文件夹及其所有内容，不可恢复。'
              : tabs.some((tab) => tab.path === deleteTarget.path && tab.dirty)
                ? '该文件有未保存修改，删除后这些修改会丢失。'
                : '此操作会永久删除磁盘上的文件。'
          }
          onDelete={() => void handleDeleteFile()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {pendingAppClose && (
        <AppCloseDialog
          tabs={tabs
            .filter((tab) => tab.dirty)
            .map((tab) => ({ title: tab.title, path: tab.path }))}
          onSaveAll={() => void handleAppCloseSaveAll()}
          onDiscardAll={() => void handleAppCloseDiscardAll()}
          onCancel={handleAppCloseCancel}
        />
      )}

      {showShortcuts && (
        <ShortcutDialog onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  )
}
