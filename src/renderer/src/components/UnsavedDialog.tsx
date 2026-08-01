import { Save, Trash2, X } from 'lucide-react'

interface UnsavedDialogProps {
  title: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedDialog({ title, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  return (
    <div
      className="unsaved-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div className="unsaved-dialog" role="dialog" aria-modal="true" aria-label="未保存的更改">
        <div className="unsaved-dialog-header">
          <h2>未保存的更改</h2>
          <button className="dialog-icon-button" type="button" aria-label="关闭弹窗" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <p>“{title}” 有尚未保存的修改，是否保存？</p>
        <div className="unsaved-dialog-actions">
          <button className="dialog-button primary" type="button" onClick={onSave}>
            <Save size={15} />
            <span>保存</span>
          </button>
          <button className="dialog-button danger" type="button" onClick={onDiscard}>
            <Trash2 size={15} />
            <span>不保存</span>
          </button>
          <button className="dialog-button" type="button" onClick={onCancel}>
            <span>取消</span>
          </button>
        </div>
      </div>
    </div>
  )
}
