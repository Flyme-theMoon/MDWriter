let renderSequence = 0
let mermaidPromise: Promise<typeof import('mermaid')> | null = null

function loadMermaid(): Promise<typeof import('mermaid')> {
  mermaidPromise ??= import('mermaid')
  return mermaidPromise
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return entities[char]
  })
}

function nextId(prefix: string): string {
  renderSequence += 1
  return `${prefix}-${Date.now()}-${renderSequence}`
}

export function encodeMermaidSource(source: string): string {
  return encodeURIComponent(source)
}

export function decodeMermaidSource(encoded: string): string {
  return decodeURIComponent(encoded)
}

async function renderSvg(source: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await loadMermaid()
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'strict',
    maxTextSize: 100000,
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif',
    flowchart: {
      htmlLabels: true,
      wrappingWidth: 180,
      nodeSpacing: 28,
      rankSpacing: 42,
      diagramPadding: 12
    },
    themeVariables: {
      fontSize: '13px'
    }
  })

  try {
    const { svg } = await mermaid.render(nextId('mermaid-render'), source)
    return svg
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `<div class="mermaid-error">Mermaid Error: ${escapeHtml(message)}</div>`
  }
}

export async function renderMermaidToElement(
  source: string,
  container: HTMLElement,
  dark: boolean
): Promise<void> {
  container.dataset.mermaidSource = encodeMermaidSource(source)
  container.dataset.mermaidDark = String(dark)
  container.classList.add('mermaid-render')
  container.innerHTML = await renderSvg(source, dark)
}

export async function rerenderMermaidElement(
  container: HTMLElement,
  dark: boolean
): Promise<void> {
  const encoded = container.dataset.mermaidSource
  if (!encoded) return
  container.dataset.mermaidDark = String(dark)
  container.innerHTML = await renderSvg(decodeMermaidSource(encoded), dark)
}

export function createMermaidPreview(source: string, dark: boolean): string {
  const id = nextId('mermaid-preview')
  const encoded = encodeMermaidSource(source)

  void renderSvg(source, dark).then((html) => {
    const element = document.querySelector<HTMLElement>(
      `[data-mermaid-id="${id}"]`
    )
    if (!element) return
    element.innerHTML = html
    element.classList.add('mermaid-render')
  })

  return `<div class="mermaid-preview" data-mermaid-id="${id}" data-mermaid-source="${encoded}" data-mermaid-dark="${dark}">渲染中...</div>`
}
