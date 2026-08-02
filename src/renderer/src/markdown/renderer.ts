import hljs from 'highlight.js'
import { Marked } from 'marked'
import appCss from '../styles/app.css?inline'
import claudeTokensCss from '../styles/claude-tokens.css?inline'
import { renderMermaidToElement } from './mermaid'

hljs.registerAliases(['mongodb', 'mongo'], { languageName: 'javascript' })
hljs.registerAliases(['sqlserver', 'mssql', 'tsql'], { languageName: 'sql' })

function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .replace(/[*_`~]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  const idBase = `heading-${base}`
  const count = used.get(idBase) ?? 0
  used.set(idBase, count + 1)
  return count === 0 ? idBase : `${idBase}-${count + 1}`
}

export function renderMarkdown(markdown: string): string {
  const usedIds = new Map<string, number>()
  const marked = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
      code({ text, lang }) {
        const normalizedLang = lang?.toLowerCase()
        const language =
          normalizedLang && hljs.getLanguage(normalizedLang)
            ? normalizedLang
            : 'plaintext'
        const highlighted = hljs.highlight(text, { language }).value
        const displayLanguage =
          normalizedLang === 'mermaid' ? 'mermaid' : language
        return `<pre><code class="hljs language-${displayLanguage}">${highlighted}</code></pre>`
      },
      heading({ tokens, depth, text }) {
        const id = headingId(text, usedIds)
        const content = this.parser.parseInline(tokens)
        return `<h${depth} id="${id}">${content}</h${depth}>`
      }
    }
  })
  return marked.parse(markdown, { async: false }) as string
}

export async function buildExportHtml(
  markdown: string,
  dark = false
): Promise<string> {
  const body = renderMarkdown(markdown)
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<div id="mdwriter-export-root">${body}</div>`,
    'text/html'
  )
  const exportRoot = doc.getElementById('mdwriter-export-root')

  if (exportRoot) {
    const mermaidBlocks = Array.from(
      exportRoot.querySelectorAll('pre code.language-mermaid')
    )
    for (const code of mermaidBlocks) {
      const pre = code.closest('pre')
      const container = doc.createElement('div')
      container.className = 'mermaid-preview'
      pre?.replaceWith(container)
      await renderMermaidToElement(code.textContent ?? '', container, dark)
    }
  }

  const renderedBody = exportRoot?.innerHTML ?? body

  return `<!doctype html>
<html lang="zh-CN" class="${dark ? 'dark' : ''}">
  <head>
    <meta charset="utf-8" />
    <title>MDWriter Export</title>
    <style>
      ${claudeTokensCss}
      ${appCss}
      @page {
        size: A4;
        margin: 16mm 18mm;
      }
      html,
      body {
        height: auto;
        overflow: visible;
        background: var(--background);
      }
      body {
        padding: 0;
      }
      .markdown-preview {
        max-width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        box-shadow: none;
      }
      .markdown-preview pre,
      .markdown-preview table,
      .markdown-preview blockquote,
      .markdown-preview img {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <article class="markdown-preview">${renderedBody}</article>
  </body>
</html>`
}
