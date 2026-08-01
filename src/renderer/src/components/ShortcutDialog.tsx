import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

interface ShortcutDialogProps {
  onClose: () => void
}

interface ShortcutItem {
  keys: string
  label: string
}

const shortcutGroups: Array<{ title: string; items: ShortcutItem[] }> = [
  {
    title: '常用',
    items: [
      { keys: 'Ctrl / Cmd + S', label: '保存当前文档' },
      { keys: 'Ctrl / Cmd + 1-4', label: '设置一级到四级标题' }
    ]
  },
  {
    title: '代码块',
    items: [
      { keys: 'Ctrl + Shift + K', label: '插入代码块（Windows / Linux）' },
      { keys: 'Cmd + Option + C', label: '插入代码块（macOS）' }
    ]
  },
  {
    title: '其他',
    items: [
      { keys: '双击图片', label: '预览图片' },
      { keys: 'Esc', label: '关闭弹窗或菜单' }
    ]
  }
]

export function ShortcutDialog({ onClose }: ShortcutDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="unsaved-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="unsaved-dialog shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="快捷键"
      >
        <div className="unsaved-dialog-header">
          <h2>
            <Keyboard size={17} />
            <span>快捷键</span>
          </h2>
          <button
            className="dialog-icon-button"
            type="button"
            aria-label="关闭快捷键弹窗"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="shortcut-list">
          {shortcutGroups.map((group) => (
            <section className="shortcut-group" key={group.title}>
              <div className="shortcut-group-title">{group.title}</div>
              {group.items.map((item) => (
                <div className="shortcut-row" key={`${group.title}-${item.keys}`}>
                  <span className="shortcut-label">{item.label}</span>
                  <kbd>{item.keys}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
