import { Save, Trash2, X } from 'lucide-react'

interface AppCloseDialogProps {
  tabs: Array<{ title: string; path: string | null }>
  onSaveAll: () => void
  onDiscardAll: () => void
  onCancel: () => void
}

export function AppCloseDialog({
  tabs,
  onSaveAll,
  onDiscardAll,
  onCancel
}: AppCloseDialogProps) {
  return (
    <div
      className="unsaved-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        className="unsaved-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="关闭应用"
      >
        <div className="unsaved-dialog-header">
          <h2>关闭应用</h2>
          <button
            className="dialog-icon-button"
            type="button"
            aria-label="取消关闭"
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        </div>
        <p>以下文件有未保存修改：</p>
        <div className="app-close-list">
          {tabs.map((tab) => (
            <div className="app-close-item" key={tab.title}>
              <span>{tab.title}</span>
              <span className="app-close-path">{tab.path ?? '未保存的新文件'}</span>
            </div>
          ))}
        </div>
        <div className="unsaved-dialog-actions">
          <button className="dialog-button primary" type="button" onClick={onSaveAll}>
            <Save size={15} />
            <span>保存全部</span>
          </button>
          <button className="dialog-button danger" type="button" onClick={onDiscardAll}>
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
