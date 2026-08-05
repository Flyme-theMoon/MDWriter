import type { BlockContext, Line, MarkdownConfig } from '@lezer/markdown'

type ParsingLine = Line & { depth: number }

function isMathOpen(line: Line): boolean {
  return line.next === 36 && line.text.slice(line.pos, line.pos + 2) === '$$'
}

function findMathClose(line: Line, from: number): number {
  const close = line.text.indexOf('$$', from)
  return close >= 0 && line.skipSpace(close + 2) === line.text.length
    ? close
    : -1
}

// Parse `$$...$$` display math as a dedicated block instead of letting a
// lone `=` inside the formula be interpreted as a Setext heading.
export const mathSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'MathBlock', block: true },
    { name: 'MathBlockMark' }
  ],
  parseBlock: [
    {
      name: 'MathBlock',
      parse(cx: BlockContext, line: Line) {
        if (!isMathOpen(line)) return false

        const openStart = cx.lineStart + line.pos
        const openEnd = openStart + 2
        const marks = [cx.elt('MathBlockMark', openStart, openEnd)]
        let close = findMathClose(line, line.pos + 2)

        if (close < 0) {
          while (cx.nextLine() && (line as ParsingLine).depth >= cx.depth) {
            close = findMathClose(line, line.pos)
            if (close >= 0) break
          }
        }

        if (close >= 0) {
          marks.push(
            cx.elt('MathBlockMark', cx.lineStart + close, cx.lineStart + close + 2)
          )
          cx.nextLine()
        }

        cx.addElement(
          cx.elt('MathBlock', openStart, cx.prevLineEnd(), marks)
        )
        return true
      },
      before: 'SetextHeading'
    }
  ]
}
