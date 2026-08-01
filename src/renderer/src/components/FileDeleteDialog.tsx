import { Trash2, X } from 'lucide-react'

interface FileDeleteDialogProps {
  name: string
  warning?: string
  onDelete: () => void
  onCancel: () => void
}

export function FileDeleteDialog({
  name,
  warning,
  onDelete,
  onCancel
}: FileDeleteDialogProps) {
  return (
    <div
      className="unsaved-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div className="unsaved-dialog" role="dialog" aria-modal="true" aria-label="删除文件">
        <div className="unsaved-dialog-header">
          <h2>删除文件</h2>
          <button
            className="dialog-icon-button"
            type="button"
            aria-label="关闭弹窗"
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        </div>
        <p>确定删除 “{name}”？</p>
        {warning && <p className="delete-dialog-warning">{warning}</p>}
        <div className="unsaved-dialog-actions">
          <button className="dialog-button danger" type="button" onClick={onDelete}>
            <Trash2 size={15} />
            <span>删除</span>
          </button>
          <button className="dialog-button" type="button" onClick={onCancel}>
            <span>取消</span>
          </button>
        </div>
      </div>
    </div>
  )
}
