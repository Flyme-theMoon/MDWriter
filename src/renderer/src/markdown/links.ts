// Rendered Markdown links must never navigate the Electron window: external
// links go to the system browser, local file links to their default app.

import { fileUrlToPath } from './imagePaths'

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export interface OpenMarkdownLinkOptions {
  /**
   * Only open the link while a modifier key is held. The editable Milkdown
   * surface needs this so a plain click still places the caret for editing.
   */
  requireModifier?: boolean
}

/**
 * Route a click on rendered Markdown content to the right handler.
 * Returns true when the click opened something and the caller should treat it
 * as consumed.
 */
export function openMarkdownLink(
  event: MouseEvent,
  options: OpenMarkdownLinkOptions = {}
): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false

  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  const href = anchor?.getAttribute('href')?.trim()
  if (!anchor || !href) return false

  // In-page anchors keep the browser's own jump. Relative links are skipped
  // because resolving them needs the document directory, which this layer
  // does not know; the main process blocks the navigation either way.
  if (href.startsWith('#') || !ABSOLUTE_URL_PATTERN.test(href)) return false

  if (options.requireModifier && !(event.metaKey || event.ctrlKey)) return false

  let url: URL
  try {
    url = new URL(href)
  } catch {
    return false
  }

  if (EXTERNAL_PROTOCOLS.has(url.protocol)) {
    event.preventDefault()
    void window.mdwriter?.openExternal(url.toString())
    return true
  }

  if (url.protocol === 'file:') {
    event.preventDefault()
    void window.mdwriter?.openPath(fileUrlToPath(url.toString()))
    return true
  }

  // javascript:, custom URL schemes and anything else unlisted are swallowed
  // rather than handed to Chromium.
  event.preventDefault()
  return true
}
