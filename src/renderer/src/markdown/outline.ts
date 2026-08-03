import { lexer } from 'marked'

export interface OutlineHeading {
  id: string
  level: number
  text: string
  line: number
}

export interface OutlineNode extends OutlineHeading {
  children: OutlineNode[]
}

interface InlineToken {
  type?: string
  text?: string
  tokens?: InlineToken[]
}

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

function inlinePlainText(tokens: InlineToken[] | undefined | null): string {
  if (!tokens) return ''

  let text = ''
  for (const token of tokens) {
    if (token.type === 'image') continue
    if (token.type === 'escape' || token.type === 'codespan' || token.type === 'text') {
      text += token.text ?? ''
    } else if (token.tokens && token.tokens.length > 0) {
      text += inlinePlainText(token.tokens)
    } else {
      text += token.text ?? ''
    }
  }
  return text
}

function containsImageToken(tokens: InlineToken[] | undefined | null): boolean {
  if (!tokens) return false

  for (const token of tokens) {
    if (token.type === 'image') return true
    if (token.tokens && containsImageToken(token.tokens)) return true
  }
  return false
}

export function extractOutline(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  const usedIds = new Map<string, number>()
  let line = 1

  for (const token of lexer(markdown)) {
    if (token.type === 'heading') {
      const rawText = token.text.trim() || `H${token.depth}`
      const plainText = inlinePlainText(token.tokens).trim()
      headings.push({
        id: headingId(rawText, usedIds),
        level: token.depth,
        text: plainText || (containsImageToken(token.tokens) ? '图片' : rawText),
        line
      })
    }
    line += token.raw.split(/\r\n|\r|\n/).length
  }

  return headings
}

export function buildOutlineTree(headings: OutlineHeading[]): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []

  for (const heading of headings) {
    const node: OutlineNode = { ...heading, children: [] }

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  return roots
}
