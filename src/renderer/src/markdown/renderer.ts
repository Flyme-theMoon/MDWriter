import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import markedKatex from 'marked-katex-extension'
import { Marked } from 'marked'
import appCss from '../styles/app.css?inline'
import claudeTokensCss from '../styles/claude-tokens.css?inline'
import katexCss from 'katex/dist/katex.min.css?inline'
import { renderMermaidToElement } from './mermaid'
import 'katex/dist/katex.min.css'

const MAX_CODE_VISUAL_LINES = 30
const CODE_CHARS_PER_LINE = 72

function estimateCodeVisualLines(lines: string[]): number {
  return lines.reduce(
    (total, line) =>
      total + Math.max(1, Math.ceil(line.length / CODE_CHARS_PER_LINE)),
    0
  )
}

function splitCodeLines(lines: string[]): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let currentVisualLines = 0

  for (const line of lines) {
    const lineVisualLines = Math.max(
      1,
      Math.ceil(line.length / CODE_CHARS_PER_LINE)
    )
    if (
      current.length > 0 &&
      currentVisualLines + lineVisualLines > MAX_CODE_VISUAL_LINES
    ) {
      chunks.push(current)
      current = []
      currentVisualLines = 0
    }

    current.push(line)
    currentVisualLines += lineVisualLines
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

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

// Single Markdown render entry shared by split preview and PDF export.
// It produces sanitized HTML with headings, code highlighting and KaTeX.
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
  marked.use(markedKatex({ throwOnError: false, nonStandard: true }))
  const html = marked.parse(markdown, { async: false }) as string
  // Sanitize before injecting into the DOM: raw HTML in markdown must not be
  // able to run scripts or event handlers. Unknown protocols are kept so
  // file:// and data: image URLs keep working; javascript: is always
  // removed by DOMPurify.
  return DOMPurify.sanitize(html, {
    ALLOW_UNKNOWN_PROTOCOLS: true,
    FORBID_TAGS: [
      'style',
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'link',
      'meta',
      'base'
    ]
  })
}

// Export-specific rendering: after generating the shared preview HTML,
// replace Mermaid source with rendered diagrams and prepare print-friendly CSS.
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

    // Detect code blocks with long lines and shrink font to prevent overflow
    const codeBlocks = exportRoot.querySelectorAll('pre code.hljs')
    for (const code of codeBlocks) {
      const text = code.textContent ?? ''
      const maxLineLength = text.split('\n').reduce(
        (max, line) => Math.max(max, line.length),
        0
      )
      if (maxLineLength > 72) {
        const pre = code.closest('pre')
        if (pre) {
          pre.classList.add('code-long-lines')
        }
      }
    }

    // Split long code blocks into complete visual blocks for PDF pagination.
    // Each chunk keeps its own border, radius, padding and margins, so the
    // page boundary falls between two whole code blocks instead of through one.
    const exportCodeBlocks = Array.from(
      exportRoot.querySelectorAll('pre code.hljs')
    )
    for (const code of exportCodeBlocks) {
      const pre = code.closest('pre')
      if (!pre) continue

      const rawText = code.textContent ?? ''
      const lines = rawText.replace(/\n$/, '').split('\n')
      const chunks = splitCodeLines(lines)
      if (chunks.length <= 1) continue

      const languageMatch = code.className.match(/language-([\w-]+)/)
      const language = languageMatch?.[1] ?? 'plaintext'
      const normalizedLanguage =
        language && hljs.getLanguage(language) ? language : 'plaintext'
      const fragment = doc.createDocumentFragment()

      for (const chunkLines of chunks) {
        const chunkText = chunkLines.join('\n')
        if (!chunkText) continue

        const chunkPre = doc.createElement('pre')
        const chunkCode = doc.createElement('code')
        if (pre.classList.contains('code-long-lines')) {
          chunkPre.classList.add('code-long-lines')
        }
        chunkPre.classList.add('code-chunk')
        chunkCode.className = `hljs language-${normalizedLanguage}`
        chunkCode.innerHTML = hljs.highlight(chunkText, {
          language: normalizedLanguage
        }).value
        chunkPre.appendChild(chunkCode)
        fragment.appendChild(chunkPre)
      }

      pre.replaceWith(fragment)
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
      ${katexCss}
      ${appCss}
      @page {
        size: A4;
        margin: 18mm 16mm;
        background: var(--background);
      }
      html {
        height: auto;
        min-height: 100%;
        overflow: visible;
        background: var(--background);
      }
      body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
      .markdown-preview {
        margin: 0;
        max-width: 100%;
        box-shadow: none;
        padding: 0;
      }
      .markdown-preview pre.code-long-lines code {
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }
      .markdown-preview pre,
      .markdown-preview table,
      .markdown-preview th,
      .markdown-preview td,
      .markdown-preview blockquote,
      .markdown-preview img,
      .markdown-preview :not(pre) > code {
        border-color: var(--border, #dad9d4);
      }
      html.dark .markdown-preview pre,
      html.dark .markdown-preview table,
      html.dark .markdown-preview th,
      html.dark .markdown-preview td,
      html.dark .markdown-preview blockquote,
      html.dark .markdown-preview img,
      html.dark .markdown-preview :not(pre) > code {
        border-color: var(--border, #3e3e38);
      }
      .markdown-preview h1,
      .markdown-preview h2,
      .markdown-preview h3,
      .markdown-preview h4,
      .markdown-preview h5,
      .markdown-preview h6 {
        break-after: avoid;
        page-break-after: avoid;
      }
      .markdown-preview p,
      .markdown-preview li {
        orphans: 3;
        widows: 3;
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
