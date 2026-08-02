import type { BrowserWindowConstructorOptions } from 'electron'

/**
 * Window chrome options that differ by platform.
 *
 * macOS uses the default native title bar and the first-version topbar
 * layout. Windows and Linux use a hidden title bar with custom HTML window
 * controls rendered by WindowControls.
 */
export function getPlatformWindowOptions(): Partial<BrowserWindowConstructorOptions> {
  if (process.platform === 'darwin') {
    return {}
  }

  return {
    titleBarStyle: 'hidden'
  }
}
