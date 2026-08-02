import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import type { ChangeSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { editorLanguages } from '../../editor/languages'

interface SourceEditorProps {
  value: string
  onChange: (value: string) => void
}

export interface SourceEditorHandle {
  focusHeading: (line: number) => void
  scrollToLine: (line: number) => void
}

function setHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const changes: ChangeSpec[] = []
  const touched = new Set<number>()

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from)
    const endPosition = range.from === range.to ? range.from : Math.max(range.from, range.to - 1)
    const endLine = state.doc.lineAt(endPosition)

    for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
      const line = state.doc.line(lineNumber)
      if (touched.has(line.from)) continue
      touched.add(line.from)

      const match = /^(\s{0,3})(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/.exec(line.text)
      if (match) {
        const prefixStart = line.from + match[1].length
        const prefixEnd = prefixStart + match[2].length
        const hasSpace = line.text.slice(prefixEnd).startsWith(' ') || line.text.slice(prefixEnd).startsWith('\t')
        const replaceTo = hasSpace ? prefixEnd + 1 : prefixEnd
        if (match[2].length !== level) {
          changes.push({
            from: prefixStart,
            to: replaceTo,
            insert: `${'#'.repeat(level)} `
          })
        }
      } else {
        changes.push({
          from: line.from,
          to: line.from,
          insert: `${'#'.repeat(level)} `
        })
      }
    }
  }

  if (changes.length === 0) return false
  view.dispatch({ changes })
  return true
}

function insertCodeBlock(view: EditorView): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const insert = '\n```\n\n```\n'
  const insertAt = line.to
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: insertAt + 5 },
    scrollIntoView: true
  })
  return true
}

function toggleInlineWrap(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string
): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  if (selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length)
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: {
        anchor: from,
        head: from + inner.length
      }
    })
    return true
  }

  const wrapped = selected || placeholder
  view.dispatch({
    changes: { from, to, insert: `${before}${wrapped}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + wrapped.length
    }
  })
  return true
}

const toggleStrong = (view: EditorView): boolean =>
  toggleInlineWrap(view, '**', '**', '加粗文字')

const toggleEmphasis = (view: EditorView): boolean =>
  toggleInlineWrap(view, '*', '*', '斜体文字')

const toggleInlineCode = (view: EditorView): boolean =>
  toggleInlineWrap(view, '`', '`', 'code')

const toggleStrikethrough = (view: EditorView): boolean =>
  toggleInlineWrap(view, '~~', '~~', '删除线')

function toggleList(
  view: EditorView,
  pattern: RegExp,
  prefixFor: (index: number) => string
): boolean {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endPosition = from === to ? from : Math.max(from, to - 1)
  const endLine = view.state.doc.lineAt(endPosition)
  const lines: Array<{ from: number; text: string }> = []

  for (
    let lineNumber = startLine.number;
    lineNumber <= endLine.number;
    lineNumber += 1
  ) {
    const line = view.state.doc.line(lineNumber)
    lines.push({ from: line.from, text: line.text })
  }

  const allListed = lines.every((line) => pattern.test(line.text))
  view.dispatch({
    changes: lines.map((line, index) => {
      const match = pattern.exec(line.text)
      const removeLength = match ? match[0].length : 0
      return {
        from: line.from,
        to: allListed ? line.from + removeLength : line.from,
        insert: allListed ? '' : prefixFor(index)
      }
    })
  })
  return true
}

const toggleBulletList = (view: EditorView): boolean =>
  toggleList(view, /^(\s*)[-*+]\s+/, () => '- ')

const toggleOrderedList = (view: EditorView): boolean =>
  toggleList(view, /^(\s*)\d+\.\s+/, (index) => `${index + 1}. `)

const headingShortcuts = keymap.of(
  [1, 2, 3, 4].flatMap((level) => [
    {
      key: `Mod-${level}`,
      run: (view: EditorView) => setHeading(view, level)
    },
    {
      key: `Ctrl-${level}`,
      run: (view: EditorView) => setHeading(view, level)
    }
  ])
)

const codeBlockShortcuts = keymap.of([
  {
    key: 'Ctrl-Shift-k',
    run: insertCodeBlock
  },
  {
    key: 'Mod-Alt-c',
    run: insertCodeBlock
  }
])

const formattingShortcuts = keymap.of([
  { key: 'Mod-b', run: toggleStrong },
  { key: 'Ctrl-b', run: toggleStrong },
  { key: 'Mod-i', run: toggleEmphasis },
  { key: 'Ctrl-i', run: toggleEmphasis },
  { key: 'Mod-Shift-`', run: toggleInlineCode },
  { key: 'Ctrl-Shift-`', run: toggleInlineCode },
  { key: 'Mod-Alt-x', run: toggleStrikethrough },
  { key: 'Ctrl-Alt-x', run: toggleStrikethrough },
  { key: 'Mod-[', run: toggleOrderedList },
  { key: 'Mod-]', run: toggleBulletList },
  { key: 'Mod-Shift-[', run: toggleOrderedList },
  { key: 'Mod-Shift-]', run: toggleBulletList },
  { key: 'Ctrl-[', run: toggleOrderedList },
  { key: 'Ctrl-]', run: toggleBulletList },
  { key: 'Ctrl-Shift-[', run: toggleOrderedList },
  { key: 'Ctrl-Shift-]', run: toggleBulletList }
])

const markdownExtensions = [
  markdown({ base: markdownLanguage, codeLanguages: editorLanguages }),
  EditorView.lineWrapping,
  headingShortcuts,
  codeBlockShortcuts,
  formattingShortcuts
]

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, onChange }, ref) {
    const viewRef = useRef<EditorView | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        focusHeading(line: number) {
          const view = viewRef.current
          if (!view) return
          const targetLine = Math.min(Math.max(1, line), view.state.doc.lines)
          const pos = view.state.doc.line(targetLine).from
          view.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: 'center' })
          })
          view.focus()
        },
        scrollToLine(line: number) {
          const view = viewRef.current
          if (!view) return
          const targetLine = Math.min(Math.max(1, line), view.state.doc.lines)
          const pos = view.state.doc.line(targetLine).from
          view.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: 'center' })
          })
          view.focus()
        }
      }),
      []
    )

    return (
      <CodeMirror
        className="source-editor"
        value={value}
        height="100%"
        extensions={markdownExtensions}
        onChange={(next) => onChange(next)}
        onCreateEditor={(view) => {
          viewRef.current = view
        }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true
        }}
      />
    )
  }
)
