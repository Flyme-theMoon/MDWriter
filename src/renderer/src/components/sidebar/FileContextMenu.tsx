import {
  ClipboardCopy,
  ClipboardPaste,
  FilePlus2,
  FolderPlus,
  Pencil,
  Scissors,
  Trash2,
  X
} from 'lucide-react'

interface FileContextMenuProps {
  x: number
  y: number
  kind: 'file' | 'folder'
  isRoot: boolean
  canPaste: boolean
  onNewFile: () => void
  onNewFolder: () => void
  onCopyFile: () => void
  onCutFile: () => void
  onPaste: () => void
  onRename: () => void
  onDeleteFile: () => void
  onRemoveRoot: () => void
  onClose: () => void
}

export function FileContextMenu({
  x,
  y,
  kind,
  isRoot,
  canPaste,
  onNewFile,
  onNewFolder,
  onCopyFile,
  onCutFile,
  onPaste,
  onRename,
  onDeleteFile,
  onRemoveRoot,
  onClose
}: FileContextMenuProps) {
  const left = Math.min(x, Math.max(8, window.innerWidth - 224))
  const top = Math.min(y, Math.max(8, window.innerHeight - 280))

  const run = (action: () => void): void => {
    action()
    onClose()
  }

  return (
    <div
      className="file-context-menu"
      style={{ left, top }}
      role="menu"
      aria-label="文件操作"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {kind === 'file' ? (
        <>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onRename)}
          >
            <Pencil size={14} />
            <span>重命名</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onCopyFile)}
          >
            <ClipboardCopy size={14} />
            <span>复制</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onCutFile)}
          >
            <Scissors size={14} />
            <span>剪切</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            disabled={!canPaste}
            onClick={() => canPaste && run(onPaste)}
          >
            <ClipboardPaste size={14} />
            <span>粘贴到此处</span>
          </button>
          <div className="file-context-separator" />
          <button
            className="file-context-item danger"
            type="button"
            role="menuitem"
            onClick={() => run(onDeleteFile)}
          >
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        </>
      ) : (
        <>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onNewFile)}
          >
            <FilePlus2 size={14} />
            <span>新建 Markdown 文件</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onNewFolder)}
          >
            <FolderPlus size={14} />
            <span>新建文件夹</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onRename)}
          >
            <Pencil size={14} />
            <span>重命名</span>
          </button>
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            onClick={() => run(onCopyFile)}
          >
            <ClipboardCopy size={14} />
            <span>复制</span>
          </button>
          {!isRoot && (
            <button
              className="file-context-item"
              type="button"
              role="menuitem"
              onClick={() => run(onCutFile)}
            >
              <Scissors size={14} />
              <span>剪切</span>
            </button>
          )}
          <button
            className="file-context-item"
            type="button"
            role="menuitem"
            disabled={!canPaste}
            onClick={() => canPaste && run(onPaste)}
          >
            <ClipboardPaste size={14} />
            <span>粘贴到此处</span>
          </button>
          {isRoot && (
            <>
              <div className="file-context-separator" />
              <button
                className="file-context-item danger"
                type="button"
                role="menuitem"
                onClick={() => run(onRemoveRoot)}
              >
                <X size={14} />
                <span>从侧边栏移除</span>
              </button>
            </>
          )}
          {!isRoot && (
            <>
              <div className="file-context-separator" />
              <button
                className="file-context-item danger"
                type="button"
                role="menuitem"
                onClick={() => run(onDeleteFile)}
              >
                <Trash2 size={14} />
                <span>删除文件夹</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
