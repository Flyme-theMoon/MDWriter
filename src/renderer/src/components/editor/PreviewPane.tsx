import {
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { renderMarkdown } from '../../markdown/renderer'
import {
  decodeMermaidSource,
  renderMermaidToElement,
  rerenderMermaidElement
} from '../../markdown/mermaid'
import { fileUrlToPath } from '../../markdown/imagePaths'
import type { OutlineHeading } from '../../markdown/outline'

export interface PreviewPaneProps {
  markdown: string
  onImagePreview?: (src: string) => void
  dark?: boolean
}

export interface PreviewPaneHandle {
  scrollToHeading: (heading: OutlineHeading) => void
}

export const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(
  function PreviewPane({ markdown, onImagePreview, dark = false }, ref) {
  const containerRef = useRef<HTMLElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      scrollToHeading(heading: OutlineHeading) {
        const container = containerRef.current
        if (!container) return

        const target =
          container.querySelector<HTMLElement>(`#${heading.id}`) ??
          Array.from(
            container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
          ).find((node) => {
            const text = node.textContent?.trim().toLowerCase().replace(/\s+/g, ' ')
            return text === heading.text.trim().toLowerCase().replace(/\s+/g, ' ')
          })

        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }),
    []
  )

  const html = useMemo(() => renderMarkdown(markdown), [markdown])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !window.mdwriter) return

    const handleImageError = (event: Event): void => {
      const image = event.target
      if (!(image instanceof HTMLImageElement)) return
      // Fall back to IPC data URLs when file:// images are blocked by Chromium.
      if (!image.src.startsWith('file://') || image.dataset.mdwriterFallback) {
        return
      }

      image.dataset.mdwriterFallback = '1'
      void window.mdwriter
        ?.readImageDataUrl(fileUrlToPath(image.src))
        .then((dataUrl) => {
          if (dataUrl && image.isConnected) image.src = dataUrl
        })
    }

    container.addEventListener('error', handleImageError, true)
    return () => container.removeEventListener('error', handleImageError, true)
  }, [html])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const mermaidBlocks = Array.from(
      container.querySelectorAll<HTMLElement>('pre code.language-mermaid')
    )
    const created: HTMLElement[] = mermaidBlocks.map((code) => {
      const pre = code.closest('pre')
      const placeholder = document.createElement('div')
      placeholder.className = 'mermaid-preview'
      placeholder.textContent = '渲染中...'
      pre?.replaceWith(placeholder)
      void renderMermaidToElement(code.textContent ?? '', placeholder, dark)
      return placeholder
    })

    if (created.length === 0) {
      container
        .querySelectorAll<HTMLElement>('[data-mermaid-source]')
        .forEach((element) => {
          if (element.dataset.revealed === 'true') return
          void rerenderMermaidElement(element, dark)
        })
    }
  }, [html, dark])

  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>): void => {
    const image = (event.target as HTMLElement).closest('img')
    if (image?.src) {
      onImagePreview?.(image.src)
    }
  }

  const handleMermaidClick = (event: ReactMouseEvent<HTMLElement>): void => {
    const preview = (event.target as HTMLElement).closest<HTMLElement>(
      '.mermaid-preview'
    )
    if (!preview) return

    const encoded = preview.dataset.mermaidSource
    if (!encoded) return

    if (preview.dataset.revealed === 'true') {
      preview.dataset.revealed = 'false'
      preview.classList.remove('source-mode')
      void renderMermaidToElement(
        decodeMermaidSource(encoded),
        preview,
        dark
      )
      return
    }

    preview.dataset.revealed = 'true'
    preview.classList.add('source-mode')
    preview.replaceChildren()
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = decodeMermaidSource(encoded)
    pre.appendChild(code)
    preview.appendChild(pre)
  }

  return (
    <article
      ref={containerRef}
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      onDoubleClick={handleDoubleClick}
      onClick={handleMermaidClick}
    />
  )
}
)
