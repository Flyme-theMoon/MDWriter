import {
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
  Sun,
  X
} from 'lucide-react'
import type { EditorMode } from '@shared/types/document'
import type {
  FileNode,
  OpenDirectoryResult,
  ReadFileResult
} from '@shared/types/files'
import type { AppState } from '@shared/types/state'
import type { OutlineHeading } from './markdown/outline'
import { buildOutlineTree, extractOutline } from './markdown/outline'
import { AppCloseDialog } from './components/AppCloseDialog'
import { FileDeleteDialog } from './components/FileDeleteDialog'
import { ImageLightbox } from './components/ImageLightbox'
import {
  PreviewEditor,
  type PreviewEditorHandle
} from './components/editor/PreviewEditor'
import {
  PreviewPane,
  type PreviewPaneHandle
} from './components/editor/PreviewPane'
import {
  SourceEditor,
  type SourceEditorHandle
} from './components/editor/SourceEditor'
import { FileContextMenu } from './components/sidebar/FileContextMenu'
import {
  FileTree,
  type PendingCreateEntry,
  type PendingRenameEntry
} from './components/sidebar/FileTree'
import { OutlineTree } from './components/sidebar/OutlineTree'
import { ShortcutDialog } from './components/ShortcutDialog'
import { UnsavedDialog } from './components/UnsavedDialog'
import { buildExportHtml } from './markdown/renderer'
import appIcon from './icon.png'

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
}

interface DeleteFileTarget {
  path: string
  name: string
}

function parentDirectory(filePath: string): string {
  const separator = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  )
  if (separator < 0) return filePath
  return filePath.slice(0, separator) || '/'
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
  const beforeCloseRef = useRef<() => void>(() => undefined)
  const sourceEditorRef = useRef<SourceEditorHandle>(null)
  const previewEditorRef = useRef<PreviewEditorHandle>(null)
  const splitPreviewRef = useRef<PreviewPaneHandle>(null)
  const nextId = useRef(3)
  const stateSaveTimerRef = useRef<number | null>(null)

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
    let cancelled = false

    const restore = async (): Promise<void> => {
      if (!window.mdwriter) {
        setHydrated(true)
        return
      }

      const saved = await window.mdwriter.loadAppState()
      if (cancelled) return

      if (!saved) {
        setHydrated(true)
        return
      }

      const restoredWorkspaces: OpenDirectoryResult[] = []
      for (const path of saved.workspaces) {
        try {
          restoredWorkspaces.push(await window.mdwriter.readDirectory(path))
        } catch {
          // Missing folders are skipped during restore.
        }
      }

      const restoredTabs: EditorTab[] = []
      for (const savedTab of saved.tabs) {
        if (savedTab.path && !savedTab.dirty) {
          try {
            const file = await window.mdwriter.readFile(savedTab.path)
            restoredTabs.push({
              id: savedTab.id,
              title: savedTab.title,
              path: savedTab.path,
              content: file.content,
              dirty: false
            })
          } catch {
            // Files that no longer exist are skipped.
          }
          continue
        }

        let content = savedTab.content ?? ''
        if (!content && savedTab.path) {
          try {
            content = (await window.mdwriter.readFile(savedTab.path)).content
          } catch {
            // Keep the cached draft when the original file is missing.
          }
        }
        restoredTabs.push({
          id: savedTab.id,
          title: savedTab.title,
          path: savedTab.path,
          content,
          dirty: savedTab.dirty
        })
      }

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
    if (!window.mdwriter) return

    const next: OpenDirectoryResult[] = []
    for (const root of roots) {
      try {
        next.push(await window.mdwriter.readDirectory(root.path))
      } catch {
        next.push(root)
      }
    }
    setWorkspaces(next)
  }

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
      content: file.content,
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
        await window.mdwriter.createDirectory({
          directoryPath: entry.directoryPath,
          name
        })
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

      setTabs((current) =>
        current.map((tab) => {
          if (tab.path === oldPath) {
            return {
              ...tab,
              path: result.path,
              title: result.name
            }
          }

          if (entry.kind === 'folder') {
            const separator = oldPath.includes('\\') ? '\\' : '/'
            const prefix = oldPath.endsWith(separator)
              ? oldPath
              : `${oldPath}${separator}`
            if (tab.path?.startsWith(prefix)) {
              const nextPath = `${result.path}${tab.path.slice(prefix.length)}`
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
        if (current === oldPath) return result.path
        if (entry.kind === 'folder') {
          const separator = oldPath.includes('\\') ? '\\' : '/'
          const prefix = oldPath.endsWith(separator)
            ? oldPath
            : `${oldPath}${separator}`
          if (current.startsWith(prefix)) {
            return `${result.path}${current.slice(prefix.length)}`
          }
        }
        return current
      })
    } catch {
      setPendingRename(entry)
    }
  }

  const handleContextRemoveRoot = (): void => {
    if (!contextMenu) return
    removeWorkspace(contextMenu.path)
  }

  const handleContextCopyFile = (): void => {
    if (!contextMenu || contextMenu.kind !== 'file') return
    setCopiedFile({
      sourcePath: contextMenu.path,
      name: contextMenu.name
    })
  }

  const handleContextPaste = async (): Promise<void> => {
    if (!contextMenu || !copiedFile || !window.mdwriter) return
    const destinationDirectory =
      contextMenu.kind === 'file'
        ? contextMenu.directoryPath
        : contextMenu.path

    await window.mdwriter.copyFile({
      sourcePath: copiedFile.sourcePath,
      destinationDirectory
    })
    await refreshWorkspaces()
  }

  const handleContextDeleteFile = (): void => {
    if (!contextMenu || contextMenu.kind !== 'file') return
    setPendingRename(null)
    setDeleteTarget({
      path: contextMenu.path,
      name: contextMenu.name
    })
  }

  const handleDeleteFile = async (): Promise<void> => {
    if (!deleteTarget || !window.mdwriter) return

    const target = deleteTarget
    const remaining = tabs.filter((tab) => tab.path !== target.path)
    setDeleteTarget(null)

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

    const result = await window.mdwriter.saveFile({
      path: tab.path,
      content: tab.content,
      defaultName: tab.title
    })

    if (!result.canceled && result.path) {
      const savedPath = result.path
      setTabs((current) =>
        current.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                path: savedPath,
                title: savedPath.split(/[\\/]/).pop() ?? tab.title,
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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveTab])

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
    await window.mdwriter.exportPdf({
      html: await buildExportHtml(activeTab.content, dark),
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

  return (
    <div
      className={`app-shell${resizingSidebar ? ' resizing-sidebar' : ''}`}
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
              <div className="file-header">
                <span className="file-header-title">文件夹</span>
                <div className="file-header-actions">
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
              {workspaces.length > 0 ? (
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
        </div>

        <div className="editor-area">
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
            <>
              {mode === 'source' && (
                <SourceEditor
                  ref={sourceEditorRef}
                  key={`${activeTab.id}-source`}
                  value={activeTab.content}
                  onChange={updateActiveContent}
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
                    />
                  </div>
                  <div className="preview-pane">
                    <PreviewPane
                      ref={splitPreviewRef}
                      markdown={activeTab.content}
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
                    value={activeTab.content}
                    onChange={updateActiveContent}
                    onImagePreview={setLightboxSrc}
                    dark={dark}
                  />
                </div>
              )}
            </>
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
          canPaste={Boolean(copiedFile)}
          onNewFile={handleContextNewFile}
          onNewFolder={handleContextNewFolder}
          onRename={handleContextRename}
          onCopyFile={handleContextCopyFile}
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
          warning={
            tabs.some((tab) => tab.path === deleteTarget.path && tab.dirty)
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
