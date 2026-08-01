import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'
import {
  ChevronDown,
  FilePlus2,
  FileText,
  FileType,
  Folder,
  FolderPlus
} from 'lucide-react'
import type { FileNode, OpenDirectoryResult } from '@shared/types/files'

export interface PendingCreateEntry {
  type: 'file' | 'folder'
  directoryPath: string
}

export interface PendingRenameEntry {
  path: string
  name: string
  kind: 'file' | 'folder'
}

interface FileTreeProps {
  roots: OpenDirectoryResult[]
  activePath: string | null
  selectedFolderPath: string | null
  pendingCreate: PendingCreateEntry | null
  pendingRename: PendingRenameEntry | null
  onOpenFile: (node: FileNode) => void
  onSelectFolder: (path: string) => void
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    node: FileNode
  ) => void
  onCreateName: (name: string) => void
  onCancelCreate: () => void
  onRenameName: (name: string) => void
  onCancelRename: () => void
}

interface TreeNodeProps {
  node: FileNode
  depth: number
  rootPaths: string[]
  activePath: string | null
  selectedFolderPath: string | null
  pendingCreate: PendingCreateEntry | null
  pendingRename: PendingRenameEntry | null
  onOpenFile: (node: FileNode) => void
  onSelectFolder: (path: string) => void
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    node: FileNode
  ) => void
  onCreateName: (name: string) => void
  onCancelCreate: () => void
  onRenameName: (name: string) => void
  onCancelRename: () => void
}

function NewEntryInput({
  kind,
  depth,
  onCreateName,
  onCancelCreate
}: {
  kind: 'file' | 'folder'
  depth: number
  onCreateName: (name: string) => void
  onCancelCreate: () => void
}) {
  const [name, setName] = useState(
    kind === 'file' ? '新建 Markdown.md' : '新建文件夹'
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    if (name.trim()) {
      submittedRef.current = true
      onCreateName(name.trim())
    }
  }

  const cancel = (): void => {
    cancelledRef.current = true
    onCancelCreate()
  }

  return (
    <div
      className="new-entry-row"
      style={{ paddingLeft: 18 + depth * 14 }}
    >
      {kind === 'file' ? (
        <FilePlus2 size={15} className="file-type-icon" />
      ) : (
        <FolderPlus size={15} className="file-type-icon" />
      )}
      <input
        ref={inputRef}
        value={name}
        aria-label={kind === 'file' ? '新 Markdown 文件名' : '新文件夹名'}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (submittedRef.current || cancelledRef.current) return
          if (name.trim()) {
            submittedRef.current = true
            onCreateName(name.trim())
          } else {
            onCancelCreate()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
          if (event.key === 'Escape') cancel()
        }}
      />
    </div>
  )
}

function RenameEntryInput({
  kind,
  initialName,
  depth,
  onRenameName,
  onCancelRename
}: {
  kind: 'file' | 'folder'
  initialName: string
  depth: number
  onRenameName: (name: string) => void
  onCancelRename: () => void
}) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (kind === 'file') {
      const dot = initialName.lastIndexOf('.')
      input.setSelectionRange(0, dot > 0 ? dot : initialName.length)
    } else {
      input.select()
    }
  }, [initialName, kind])

  const submit = (): void => {
    if (name.trim()) {
      submittedRef.current = true
      onRenameName(name.trim())
    }
  }

  return (
    <div
      className="new-entry-row rename-entry-row"
      style={{ paddingLeft: 10 + depth * 14 }}
    >
      {kind === 'file' ? (
        <FileText size={15} className="file-type-icon" />
      ) : (
        <Folder size={15} className="file-type-icon" />
      )}
      <input
        ref={inputRef}
        value={name}
        aria-label="重命名"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (!submittedRef.current) onCancelRename()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
          if (event.key === 'Escape') onCancelRename()
        }}
      />
    </div>
  )
}

function TreeNode({
  node,
  depth,
  rootPaths,
  activePath,
  selectedFolderPath,
  pendingCreate,
  pendingRename,
  onOpenFile,
  onSelectFolder,
  onContextMenu,
  onCreateName,
  onCancelCreate,
  onRenameName,
  onCancelRename
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(() => depth === 0)
  const paddingLeft = 10 + depth * 14

  useEffect(() => {
    if (pendingCreate?.directoryPath === node.path) {
      setExpanded(true)
    }
  }, [pendingCreate?.directoryPath, node.path])

  if (node.type === 'file') {
    if (pendingRename?.path === node.path) {
      return (
        <RenameEntryInput
          key={node.path}
          kind="file"
          initialName={node.name}
          depth={depth}
          onRenameName={onRenameName}
          onCancelRename={onCancelRename}
        />
      )
    }

    return (
      <button
        className={`file-item${node.path === activePath ? ' active' : ''}`}
        key={node.path}
        type="button"
        style={{ paddingLeft }}
        role="treeitem"
        onClick={() => onOpenFile(node)}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenu(event, node)
        }}
      >
        {node.kind === 'pdf' ? (
          <FileType size={15} className="file-type-icon" />
        ) : (
          <FileText size={15} className="file-type-icon" />
        )}
        <span title={node.name}>{node.name}</span>
      </button>
    )
  }

  const isRoot = rootPaths.includes(node.path)

  if (pendingRename?.path === node.path) {
    return (
      <RenameEntryInput
        key={node.path}
        kind="folder"
        initialName={node.name}
        depth={depth}
        onRenameName={onRenameName}
        onCancelRename={onCancelRename}
      />
    )
  }

  return (
    <div className="file-tree-group" key={node.path}>
      <div
        className={`file-item file-tree-directory${expanded ? ' expanded' : ''}${
          node.path === selectedFolderPath ? ' selected' : ''
        }`}
        style={{ paddingLeft }}
        role="treeitem"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current)
          onSelectFolder(node.path)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenu(event, node)
        }}
      >
        <ChevronDown
          className={`tree-chevron${expanded ? '' : ' collapsed'}`}
          size={14}
        />
        <Folder size={15} className="file-type-icon" />
        <span title={node.name}>{node.name}</span>
      </div>

      {pendingCreate?.directoryPath === node.path && (
        <NewEntryInput
          kind={pendingCreate.type}
          depth={depth + 1}
          onCreateName={onCreateName}
          onCancelCreate={onCancelCreate}
        />
      )}

      {expanded && node.children && node.children.length > 0 && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              rootPaths={rootPaths}
              activePath={activePath}
              selectedFolderPath={selectedFolderPath}
              pendingCreate={pendingCreate}
              pendingRename={pendingRename}
              onOpenFile={onOpenFile}
              onSelectFolder={onSelectFolder}
              onContextMenu={onContextMenu}
              onCreateName={onCreateName}
              onCancelCreate={onCancelCreate}
              onRenameName={onRenameName}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({
  roots,
  activePath,
  selectedFolderPath,
  pendingCreate,
  pendingRename,
  onOpenFile,
  onSelectFolder,
  onContextMenu,
  onCreateName,
  onCancelCreate,
  onRenameName,
  onCancelRename
}: FileTreeProps) {
  const rootPaths = roots.map((root) => root.path)

  return (
    <div className="file-tree" role="tree">
      {roots.map((root) => (
        <TreeNode
          key={root.path}
          node={{
            name: root.name,
            path: root.path,
            type: 'directory',
            children: root.tree
          }}
          depth={0}
          rootPaths={rootPaths}
          activePath={activePath}
          selectedFolderPath={selectedFolderPath}
          pendingCreate={pendingCreate}
          pendingRename={pendingRename}
          onOpenFile={onOpenFile}
          onSelectFolder={onSelectFolder}
          onContextMenu={onContextMenu}
          onCreateName={onCreateName}
          onCancelCreate={onCancelCreate}
          onRenameName={onRenameName}
          onCancelRename={onCancelRename}
        />
      ))}
    </div>
  )
}
