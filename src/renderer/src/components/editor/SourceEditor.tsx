import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { ChangeSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

interface SourceEditorProps {
  value: string
  onChange: (value: string) => void
}

export interface SourceEditorHandle {
  focusHeading: (line: number) => void
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

const markdownExtensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  headingShortcuts,
  codeBlockShortcuts
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
