import type { ReactElement } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

interface WindowControlsProps {
  maximized: boolean
}

export function WindowControls({
  maximized
}: WindowControlsProps): ReactElement {
  // Windows/Linux only. macOS keeps the default native title bar.
  return (
    <div className="window-controls" role="group" aria-label="窗口控制">
      <button
        className="window-control-button"
        type="button"
        aria-label="最小化"
        onClick={() => window.mdwriter?.minimizeWindow()}
      >
        <Minus size={14} />
      </button>
      <button
        className="window-control-button"
        type="button"
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => window.mdwriter?.maximizeWindow()}
      >
        {maximized ? <Copy size={13} /> : <Square size={12} />}
      </button>
      <button
        className="window-control-button close"
        type="button"
        aria-label="关闭"
        onClick={() => window.mdwriter?.closeWindow()}
      >
        <X size={14} />
      </button>
    </div>
  )
}
