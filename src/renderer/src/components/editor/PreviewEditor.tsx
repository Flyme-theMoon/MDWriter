import { languages } from '@codemirror/language-data'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Columns3, Rows3 } from 'lucide-react'
import {
  commandsCtx,
  Editor,
  rootCtx,
  defaultValueCtx,
  type CmdKey
} from '@milkdown/core'
import {
  codeBlockComponent,
  codeBlockConfig,
  defaultConfig
} from '@milkdown/components/code-block'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { upload } from '@milkdown/plugin-upload'
import { keymap } from '@milkdown/prose/keymap'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command
} from '@milkdown/prose/state'
import {
  commonmark,
  createCodeBlockCommand
} from '@milkdown/preset-commonmark'
import {
  addColAfterCommand,
  addRowAfterCommand,
  gfm
} from '@milkdown/preset-gfm'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { $prose } from '@milkdown/utils'
import {
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import type { OutlineHeading } from '../../markdown/outline'
import { rerenderMermaidElement } from '../../markdown/mermaid'
import { mermaidDiagramPlugin } from './mermaidDiagramPlugin'

interface PreviewEditorProps {
  value: string
  onChange: (value: string) => void
  onImagePreview?: (src: string) => void
  dark?: boolean
}

export interface PreviewEditorHandle {
  scrollToHeading: (heading: OutlineHeading) => void
}

const exitCodeBlockAtEnd = $prose(() =>
  keymap({
    Enter: (state, dispatch) => {
      const { $from } = state.selection
      if ($from.parent.type.name !== 'code_block') return false
      if ($from.pos !== $from.end()) return false

      const after = $from.after()
      const next = state.doc.resolve(after).nodeAfter
      if (!next || next.type.name !== 'paragraph' || next.content.size > 0) return false

      dispatch?.(state.tr.setSelection(TextSelection.near(state.doc.resolve(after + 1))))
      return true
    }
  })
)

const trailingPluginNoDirty = $prose(() => {
  const key = new PluginKey('MDWRITER_TRAILING')
  const shouldAppend = (state: {
    doc: { lastChild: { type: { name: string } } | null }
  }): boolean => {
    const lastNode = state.doc.lastChild
    if (!lastNode) return false
    return !['heading', 'paragraph'].includes(lastNode.type.name)
  }

  let shouldAppendNode = false
  const plugin = new Plugin({
    key,
    state: {
      init: (_, state) => {
        shouldAppendNode = shouldAppend(state)
        return shouldAppendNode
      },
      apply: (tr, value, _, state) => {
        shouldAppendNode = tr.docChanged ? shouldAppend(state) : value
        return shouldAppendNode
      }
    },
    appendTransaction: (_, __, state) => {
      if (!shouldAppendNode) return

      const nodeType = state.schema.nodes.paragraph
      const endPosition = state.doc.content.size
      if (!nodeType) return

      return state.tr
        .insert(endPosition, nodeType.create())
        .setMeta('addToHistory', false)
    }
  })

  return plugin
})

const headingShortcuts = $prose(() => {
  const setHeading = (level: number): Command => (state, dispatch) => {
    const headingType = state.schema.nodes.heading
    if (!headingType || state.selection.$from.parent.type.name === 'code_block') {
      return false
    }

    try {
      dispatch?.(
        state.tr.setBlockType(
          state.selection.from,
          state.selection.to,
          headingType,
          { level }
        )
      )
    } catch {
      return false
    }

    return true
  }

  return keymap({
    'Mod-1': setHeading(1),
    'Ctrl-1': setHeading(1),
    'Mod-2': setHeading(2),
    'Ctrl-2': setHeading(2),
    'Mod-3': setHeading(3),
    'Ctrl-3': setHeading(3),
    'Mod-4': setHeading(4),
    'Ctrl-4': setHeading(4)
  })
})

const codeBlockShortcuts = $prose((ctx) =>
  keymap({
    'Ctrl-Shift-k': () =>
      ctx.get(commandsCtx).call(createCodeBlockCommand.key)
  })
)

const MilkdownInstance = forwardRef<PreviewEditorHandle, PreviewEditorProps>(
  function MilkdownInstance({ value, onChange, onImagePreview, dark = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tableToolbar, setTableToolbar] = useState<{
    left: number
    top: number
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container
      .querySelectorAll<HTMLElement>('[data-mermaid-source]')
      .forEach((element) => {
        if (element.classList.contains('source-mode')) return
        void rerenderMermaidElement(element, dark)
      })
  }, [dark])

  useImperativeHandle(
    ref,
    () => ({
      scrollToHeading(heading: OutlineHeading) {
        const container = containerRef.current
        if (!container) return

        const target =
          container.querySelector<HTMLElement>(`#${heading.id}`) ??
          Array.from(
            container.querySelectorAll<HTMLElement>(
              'h1, h2, h3, h4, h5, h6'
            )
          ).find((node) => {
            const text = node.textContent?.trim().toLowerCase().replace(/\s+/g, ' ')
            return text === heading.text.trim().toLowerCase().replace(/\s+/g, ' ')
          })

        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }),
    []
  )

  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>): void => {
    const image = (event.target as HTMLElement).closest('img')
    if (image?.src) {
      onImagePreview?.(image.src)
    }
  }

  const { get } = useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, value)
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            onChange(markdown)
          })
          ctx.set(codeBlockConfig.key, {
            ...defaultConfig,
            languages,
            extensions: [syntaxHighlighting(defaultHighlightStyle)],
            copyIcon: '',
            expandIcon: '',
            previewLabel: '',
            renderPreview: () => null
          })
        })
        .use(commonmark)
        .use(gfm)
        .use(mermaidDiagramPlugin)
        .use(history)
        .use(codeBlockComponent)
        .use(trailingPluginNoDirty)
        .use(codeBlockShortcuts)
        .use(upload)
        .use(exitCodeBlockAtEnd)
        .use(headingShortcuts)
        .use(listener),
    []
  )

  const handleEditorInteraction = (
    event:
      | ReactMouseEvent<HTMLElement>
      | ReactKeyboardEvent<HTMLElement>
  ): void => {
    const container = containerRef.current
    if (!container) return

    const cell = (event.target as HTMLElement).closest('td, th')
    if (!cell) {
      setTableToolbar(null)
      return
    }

    const hostRect = container.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    setTableToolbar({
      left: Math.max(
        8,
        cellRect.left - hostRect.left + container.scrollLeft + 8
      ),
      top: Math.max(
        8,
        cellRect.top - hostRect.top + container.scrollTop - 42
      )
    })
  }

  const runTableCommand = (commandKey: CmdKey<unknown>): void => {
    const editor = get()
    if (!editor) return
    editor.action((ctx) => {
      ctx.get(commandsCtx).call(commandKey)
    })
  }

  return (
    <div
      ref={containerRef}
      className="milkdown-host"
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleEditorInteraction}
      onKeyUp={handleEditorInteraction}
      onScroll={() => setTableToolbar(null)}
    >
      <Milkdown />
      {tableToolbar && (
        <div
          className="table-toolbar"
          style={{ left: tableToolbar.left, top: tableToolbar.top }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            data-tooltip="在下方增加一行"
            aria-label="在下方增加一行"
            onClick={() => runTableCommand(addRowAfterCommand.key)}
          >
            <Rows3 size={14} />
            <span>加行</span>
          </button>
          <button
            type="button"
            data-tooltip="在右侧增加一列"
            aria-label="在右侧增加一列"
            onClick={() => runTableCommand(addColAfterCommand.key)}
          >
            <Columns3 size={14} />
            <span>加列</span>
          </button>
        </div>
      )}
    </div>
  )
}
)

export const PreviewEditor = forwardRef<PreviewEditorHandle, PreviewEditorProps>(
  function PreviewEditor(props, ref) {
  return (
    <MilkdownProvider>
      <MilkdownInstance ref={ref} {...props} />
    </MilkdownProvider>
  )
}
)
