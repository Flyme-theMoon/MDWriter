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

export function extractOutline(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  const usedIds = new Map<string, number>()
  let line = 1

  for (const token of lexer(markdown)) {
    if (token.type === 'heading') {
      headings.push({
        id: headingId(token.text, usedIds),
        level: token.depth,
        text: token.text.trim() || `H${token.depth}`,
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
