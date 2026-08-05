import { syntaxHighlighting } from '@codemirror/language'
import {
  EditorView as CodeMirrorView,
  keymap as cmKeymap
} from '@codemirror/view'
import {
  Bold,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Code2,
  Columns3,
  Italic,
  List,
  ListOrdered,
  Rows3,
  Scissors,
  Strikethrough
} from 'lucide-react'
import { editorLanguages } from '../../editor/languages'
import {
  commandsCtx,
  editorViewCtx,
  Editor,
  rootCtx,
  schemaCtx,
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
import { uploadConfig } from '@milkdown/plugin-upload'
import { keymap } from '@milkdown/prose/keymap'
import {
  Fragment,
  type Node as ProseNode,
  type ResolvedPos
} from '@milkdown/prose/model'
import {
  cellAround,
  deleteColumn,
  deleteRow,
  isInTable,
  selectedRect
} from '@milkdown/prose/tables'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction
} from '@milkdown/prose/state'
import {
  Decoration,
  DecorationSet,
  type EditorView
} from '@milkdown/prose/view'
import {
  commonmark,
  createCodeBlockCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand
} from '@milkdown/preset-commonmark'
import {
  addColAfterCommand,
  addRowAfterCommand,
  gfm,
  insertTableCommand,
  toggleStrikethroughCommand
} from '@milkdown/preset-gfm'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { $prose, $useKeymap } from '@milkdown/utils'
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
import {
  fileUrlToPath,
  relativizeImagePaths,
  toFileUrl
} from '../../markdown/imagePaths'
import { rerenderMermaidElement } from '../../markdown/mermaid'
import { findFuzzyRanges } from '../../search/fuzzy'
import { vscodeHighlightStyle } from '../../editor/highlightStyle'
import { math } from '../../editor/mathPlugin'
import { mermaidDiagramPlugin } from './mermaidDiagramPlugin'
import 'katex/dist/katex.min.css'

export interface PreviewEditorProps {
  value: string
  onChange: (value: string) => void
  onImagePreview?: (src: string) => void
  filePath?: string | null
  dark?: boolean
}

export interface PreviewEditorHandle {
  scrollToHeading: (heading: OutlineHeading) => void
  scrollToText: (text: string) => void
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
    'Ctrl-4': setHeading(4),
    'Mod-5': setHeading(5),
    'Ctrl-5': setHeading(5),
    'Mod-6': setHeading(6),
    'Ctrl-6': setHeading(6)
  })
})

const selectLineShortcut = $prose(() =>
  keymap({
    'Mod-l': (state, dispatch) => {
      const { $from, $to } = state.selection
      const start = $from.start($from.depth)
      const end = $to.end($to.depth)
      dispatch?.(
        state.tr.setSelection(TextSelection.create(state.doc, start, end))
      )
      return true
    }
  })
)

const codeBlockShortcuts = $prose((ctx) =>
  keymap({
    'Ctrl-Shift-k': () =>
      ctx.get(commandsCtx).call(createCodeBlockCommand.key)
  })
)

const tableShortcuts = $prose((ctx) =>
  keymap({
    'Mod-Shift-t': () =>
      ctx.get(commandsCtx).call(insertTableCommand.key, { row: 2, col: 1 }),
    'Ctrl-Shift-t': () =>
      ctx.get(commandsCtx).call(insertTableCommand.key, { row: 2, col: 1 })
  })
)

const selectCurrentTableCellShortcut = $useKeymap(
  'selectCurrentTableCellShortcut',
  {
    SelectCurrentTableCell: {
      priority: 100,
      shortcuts: 'Mod-a',
      command: () => (state, dispatch) => {
        const $cell = cellAround(state.selection.$head)
        const cell = $cell?.nodeAfter
        if (!$cell || !cell) return false

        const paragraph = cell.firstChild
        if (!paragraph) return false

        const from = $cell.pos + 2
        const to = $cell.pos + paragraph.nodeSize
        dispatch?.(
          state.tr.setSelection(TextSelection.create(state.doc, from, to))
        )
        return true
      }
    }
  }
)

const formattingShortcuts = $prose((ctx) => {
  const runCommand = (
    key: CmdKey<unknown>,
    tableSafe = true
  ) => (state: Parameters<Command>[0]): boolean => {
    if (!tableSafe && isInTable(state)) return false
    return ctx.get(commandsCtx).call(key)
  }

  return keymap({
    'Mod-b': runCommand(toggleStrongCommand.key),
    'Ctrl-b': runCommand(toggleStrongCommand.key),
    'Mod-i': runCommand(toggleEmphasisCommand.key),
    'Ctrl-i': runCommand(toggleEmphasisCommand.key),
    'Mod-Shift-`': runCommand(toggleInlineCodeCommand.key),
    'Ctrl-Shift-`': runCommand(toggleInlineCodeCommand.key),
    'Mod-Alt-x': runCommand(toggleStrikethroughCommand.key),
    'Ctrl-Alt-x': runCommand(toggleStrikethroughCommand.key),
    'Mod-Shift-[': runCommand(wrapInOrderedListCommand.key, false),
    'Mod-Shift-]': runCommand(wrapInBulletListCommand.key, false),
    'Ctrl-Shift-[': runCommand(wrapInOrderedListCommand.key, false),
    'Ctrl-Shift-]': runCommand(wrapInBulletListCommand.key, false)
  })
})

const clearSearchIconSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

function removeSerializedEmptyLineBreaks(markdown: string): string {
  // Milkdown serializes non-last empty paragraphs as <br />. Remove those
  // standalone placeholders so the saved Markdown stays clean.
  const lines = markdown.split('\n')
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) inFence = !inFence
    if (!inFence && /^[ \t]*<br\s*\/?>[ \t]*$/.test(line)) continue
    output.push(line)
  }

  return output.join('\n')
}

const copyIconSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

const codeBlockSelectAllKeymap = cmKeymap.of([
  {
    key: 'Mod-a',
    run: (view) => {
      view.dispatch({
        selection: { anchor: 0, head: view.state.doc.length }
      })
      return true
    }
  }
])

function formatJsonContent(view: CodeMirrorView): boolean {
  // Format the whole code block only when its content is valid JSON.
  const source = view.state.doc.toString()
  const trimmed = source.trim()
  if (!trimmed) return false

  try {
    const parsed = JSON.parse(trimmed)
    const formatted = JSON.stringify(parsed, null, 2)
    if (formatted === source) return true

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted },
      selection: { anchor: formatted.length }
    })
    return true
  } catch {
    return false
  }
}

const codeBlockJsonExtensions = [
  // Auto-format valid JSON after paste and expose Ctrl/Cmd+Shift+F in code blocks.
  cmKeymap.of([
    {
      key: 'Mod-Shift-F',
      run: formatJsonContent,
      preventDefault: true
    },
    {
      key: 'Ctrl-Shift-F',
      run: formatJsonContent,
      preventDefault: true
    }
  ]),
  CodeMirrorView.updateListener.of((update) => {
    if (!update.docChanged) return
    if (!update.transactions.some((tr) => tr.isUserEvent('input.paste'))) {
      return
    }

    // Format after CodeMirror has committed the pasted content. On Windows
    // clipboard insertion can be async, so paste-event timing is unreliable.
    window.requestAnimationFrame(() => {
      formatJsonContent(update.view)
    })
  })
]

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand for restricted environments.
    }
  }

  const textarea = document.createElement('textarea')
  const selection = document.getSelection()
  const originalRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (selection && originalRange) {
    selection.removeAllRanges()
    selection.addRange(originalRange)
  }
  return copied
}

async function readClipboardText(): Promise<string> {
  if (!navigator.clipboard?.readText) return ''
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

interface UploadPlaceholderSpec {
  id: symbol
  pos: number
}

// Handles image paste/drop: shows an upload placeholder, saves the file, then
// inserts the image as a block and moves the caret below it.
const imageUploadPlugin = $prose((ctx) => {
  const pluginKey = new PluginKey('MDWRITER_IMAGE_UPLOAD')

  const findPlaceholder = (state: EditorState, id: symbol): number => {
    const decorations = pluginKey.getState(state)
    if (!decorations) return -1
    const found = decorations.find(
      undefined,
      undefined,
      (spec: UploadPlaceholderSpec) => spec.id === id
    )
    if (!found.length) return -1
    return found[0]?.from ?? -1
  }

  const findBlockDepth = ($pos: ResolvedPos, typeName: string): number => {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === typeName) return depth
    }
    return -1
  }

  const normalizeResult = (
    result: Fragment | ProseNode | ProseNode[]
  ): Fragment => {
    if (result instanceof Fragment) return result
    if (Array.isArray(result)) {
      return Fragment.from(
        result.filter((node): node is ProseNode => Boolean(node))
      )
    }
    return Fragment.from(result)
  }

  const buildImageInsert = (
    state: EditorState,
    insertPos: number,
    fragment: Fragment
  ): { tr: Transaction; selectionPos: number } | null => {
    // Put images in their own paragraph, then move the caret to the start of
    // the following paragraph so typing continues below-left of the image.
    const schema = ctx.get(schemaCtx)
    const resolved = state.doc.resolve(insertPos)
    const headingDepth = findBlockDepth(resolved, 'heading')
    const codeBlockDepth = findBlockDepth(resolved, 'code_block')
    const paragraphDepth = findBlockDepth(resolved, 'paragraph')
    const blockDepth =
      headingDepth >= 0
        ? headingDepth
        : codeBlockDepth >= 0
          ? codeBlockDepth
          : paragraphDepth
    const tr = state.tr

    if (blockDepth >= 0) {
      const paragraphType = schema.nodes.paragraph
      if (!paragraphType) return null
      const imageParagraph = paragraphType.create(null, fragment)
      const currentBlock = resolved.node(blockDepth)
      const isCurrentParagraphEmpty =
        currentBlock.type.name === 'paragraph' && currentBlock.content.size === 0
      let afterImage: number

      if (isCurrentParagraphEmpty) {
        const beforeBlock = resolved.before(blockDepth)
        const afterBlock = resolved.after(blockDepth)
        tr.replaceWith(beforeBlock, afterBlock, imageParagraph)
        afterImage = beforeBlock + imageParagraph.nodeSize
      } else {
        const afterBlock = resolved.after(blockDepth)
        tr.insert(afterBlock, imageParagraph)
        afterImage = afterBlock + imageParagraph.nodeSize
      }

      const next = tr.doc.resolve(afterImage).nodeAfter
      if (next && next.type.name === 'paragraph') {
        return {
          tr,
          selectionPos: afterImage + 1
        }
      }

      const cursorParagraph = paragraphType.create()
      tr.insert(afterImage, cursorParagraph)
      return {
        tr,
        selectionPos: afterImage + 1
      }
    }

    tr.replaceWith(insertPos, insertPos, fragment)
    return {
      tr,
      selectionPos: insertPos + fragment.size
    }
  }

  const handleUpload = (
    view: EditorView,
    event: DragEvent | ClipboardEvent,
    files: FileList | undefined
  ): boolean => {
    if (!files || files.length <= 0) return false
    const hasImage = Array.from(files).some((file) =>
      file.type.includes('image')
    )
    if (!hasImage) return false

    const id = Symbol('mdwriter image upload')
    const schema = ctx.get(schemaCtx)
    const { uploader, getInsertPos, uploadWidgetFactory } =
      ctx.get(uploadConfig.key)
    const defaultInsertPos =
      event instanceof DragEvent
        ? (view.posAtCoords({ left: event.clientX, top: event.clientY })
            ?.pos ?? view.state.selection.from)
        : view.state.selection.from
    const insertPos =
      typeof getInsertPos === 'function'
        ? getInsertPos(event, ctx, defaultInsertPos)
        : defaultInsertPos

    view.dispatch(view.state.tr.setMeta(pluginKey, { add: { id, pos: insertPos } }))

    uploader(files, schema, ctx, insertPos)
      .then((result) => {
        const pos = findPlaceholder(view.state, id)
        if (pos < 0) return

        const fragment = normalizeResult(result)
        const built = buildImageInsert(view.state, pos, fragment)
        if (!built) return

        built.tr.setMeta(pluginKey, { remove: { id } })
        built.tr.setSelection(
          TextSelection.create(built.tr.doc, built.selectionPos, built.selectionPos)
        )
        view.dispatch(built.tr)
      })
      .catch((error) => {
        console.error('[image upload]', error)
      })

    return true
  }

  return new Plugin({
    key: pluginKey,
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(this: Plugin, tr, set) {
        const next = set.map(tr.mapping, tr.doc)
        const action = tr.getMeta(this)
        if (!action) return next

        if (action.add) {
          const { uploadWidgetFactory } = ctx.get(uploadConfig.key)
          const decoration = uploadWidgetFactory(action.add.pos, {
            id: action.add.id
          })
          return next.add(tr.doc, [decoration])
        }
        if (action.remove) {
          const target = next.find(
            undefined,
            undefined,
            (spec: UploadPlaceholderSpec) => spec.id === action.remove.id
          )
          return next.remove(target)
        }

        return next
      }
    },
    props: {
      decorations(this: Plugin, state: EditorState) {
        return this.getState(state)
      },
      handlePaste: (view, event) => {
        if (!(event instanceof ClipboardEvent)) return false
        const { enableHtmlFileUploader } = ctx.get(uploadConfig.key)
        if (
          !enableHtmlFileUploader &&
          event.clipboardData?.getData('text/html')
        ) {
          return false
        }
        if (event.clipboardData?.files.length) {
          return handleUpload(view, event, event.clipboardData.files)
        }

        const html = event.clipboardData?.getData('text/html') ?? ''
        if (!html || !/<img\b/i.test(html)) return false

        // HTML clipboard content often contains <img> followed by <br> or
        // wrapper markup. Extract only the image nodes so no BR leaks into Markdown.
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const htmlImages = Array.from(parsed.querySelectorAll('img'))
        const schema = ctx.get(schemaCtx)
        const imageType = schema.nodes.image
        if (!imageType || htmlImages.length === 0) return false

        const nodes = htmlImages
          .map((image) => {
            const src = image.getAttribute('src') ?? ''
            if (!src) return null
            return imageType.createAndFill({
              src,
              alt: image.getAttribute('alt') ?? '',
              title: image.getAttribute('title') ?? ''
            })
          })
          .filter((node): node is ProseNode => node != null)

        if (nodes.length === 0) return false

        const built = buildImageInsert(
          view.state,
          view.state.selection.from,
          Fragment.fromArray(nodes)
        )
        if (!built) return false

        built.tr.setSelection(
          TextSelection.create(built.tr.doc, built.selectionPos, built.selectionPos)
        )
        view.dispatch(built.tr)
        return true
      },
      handleDrop: (view, event) => {
        if (!(event instanceof DragEvent)) return false
        return handleUpload(view, event, event.dataTransfer?.files)
      }
    }
  })
})

const MilkdownInstance = forwardRef<PreviewEditorHandle, PreviewEditorProps>(
  function MilkdownInstance({ value, onChange, onImagePreview, filePath, dark = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath
  const [tableToolbar, setTableToolbar] = useState<{
    left: number
    top: number
  } | null>(null)
  const [formatBubble, setFormatBubble] = useState<{
    left: number
    top: number
    inTable: boolean
  } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const tableToolbarTimerRef = useRef<number | null>(null)
  const codeCopyTimerRef = useRef<number | null>(null)

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
  }, [])

  useEffect(
    () => () => {
      if (tableToolbarTimerRef.current !== null) {
        window.clearTimeout(tableToolbarTimerRef.current)
      }
      if (codeCopyTimerRef.current !== null) {
        window.clearTimeout(codeCopyTimerRef.current)
      }
    },
    []
  )

  const hideTableToolbar = (): void => {
    if (tableToolbarTimerRef.current !== null) {
      window.clearTimeout(tableToolbarTimerRef.current)
      tableToolbarTimerRef.current = null
    }
    setTableToolbar(null)
  }

  const showTableToolbar = (cell: HTMLElement, host: HTMLElement): void => {
    const hostRect = host.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const toolbarWidth = 240
    setTableToolbar({
      left: Math.min(
        Math.max(8, cellRect.left - hostRect.left + host.scrollLeft + 8),
        Math.max(8, host.clientWidth - toolbarWidth - 8)
      ),
      top: Math.max(
        8,
        cellRect.top - hostRect.top + host.scrollTop - 42
      )
    })

    if (tableToolbarTimerRef.current !== null) {
      window.clearTimeout(tableToolbarTimerRef.current)
    }
    tableToolbarTimerRef.current = window.setTimeout(() => {
      setTableToolbar(null)
      tableToolbarTimerRef.current = null
    }, 2000)
  }

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
      },
      scrollToText(text: string) {
        const container = containerRef.current
        if (!container) return

        const query = text
          .replace(/^#{1,6}\s+/, '')
          .replace(/^[-*+]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/[`*_~]/g, '')
          .trim()
          .toLowerCase()
        if (!query) return

        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT
        )
        let node: Node | null
        while ((node = walker.nextNode())) {
          const textNode = node as Text
          const ranges = findFuzzyRanges(textNode.nodeValue ?? '', query)
          if (ranges.length === 0) continue

          const range = document.createRange()
          range.setStart(textNode, ranges[0].start)
          range.setEnd(textNode, ranges[0].end)
          const block =
            textNode.parentElement?.closest(
              'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, tr'
            ) ?? textNode.parentElement
          block?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
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
            // Normalize editor output back to relative image paths and remove
            // Milkdown's empty-paragraph <br /> before updating app state.
            const normalizedMarkdown = removeSerializedEmptyLineBreaks(
              filePathRef.current
                ? relativizeImagePaths(markdown, filePathRef.current)
                : markdown
            )
            onChange(
              normalizedMarkdown
            )
          })
          ctx.set(codeBlockConfig.key, {
            ...defaultConfig,
            languages: editorLanguages,
            extensions: [
              syntaxHighlighting(vscodeHighlightStyle),
              codeBlockSelectAllKeymap,
              ...codeBlockJsonExtensions
            ],
            copyText: '复制',
            copyIcon: copyIconSvg,
            onCopy: () => {
              setCodeCopied(true)
              if (codeCopyTimerRef.current !== null) {
                window.clearTimeout(codeCopyTimerRef.current)
              }
              codeCopyTimerRef.current = window.setTimeout(() => {
                setCodeCopied(false)
                codeCopyTimerRef.current = null
              }, 1400)
            },
            expandIcon: '',
            searchIcon: '',
            clearSearchIcon: clearSearchIconSvg,
            previewLabel: '',
            renderPreview: () => null
          })
          ctx.set(uploadConfig.key, {
            uploader: async (files, schema) => {
              // Save pasted images next to the Markdown file when possible;
              // unsaved documents use a temp directory until first save.
              const images: File[] = []
              for (let i = 0; i < files.length; i++) {
                const file = files.item(i)
                if (!file || !file.type.includes('image')) continue
                images.push(file)
              }

              if (images.length === 0) return []

              // No file saved yet — save to temp directory
              const currentFilePath = filePathRef.current
              if (!currentFilePath) {
                const tempDir = await window.mdwriter!.getTempDir()
                const results = await Promise.all(
                  images.map(async (img) => {
                    const buffer = await img.arrayBuffer()
                    const result = await window.mdwriter!.saveImage({
                      buffer,
                      fileName: img.name || 'pasted-image.png',
                      fileDir: tempDir
                    })
                    if ('error' in result) {
                      console.error('[PreviewEditor] saveImage to temp failed:', result.error)
                      // Fallback to base64 on error
                      const { readImageAsBase64 } = await import(
                        '@milkdown/plugin-upload'
                      )
                      const data = await readImageAsBase64(img)
                      return schema.nodes.image.createAndFill({
                        src: data.src,
                        alt: data.alt
                      })
                    }
                    return schema.nodes.image.createAndFill({
                      src: toFileUrl(`${tempDir}/${result.relativePath}`),
                      alt: img.name || 'image'
                    })
                  })
                )
                return results.filter((r) => r != null) as any[]
              }

              // Determine file directory from the markdown file path
              if (typeof currentFilePath !== 'string' || !currentFilePath) {
                const tempDir = await window.mdwriter!.getTempDir()
                const results = await Promise.all(
                  images.map(async (img) => {
                    const buffer = await img.arrayBuffer()
                    const result = await window.mdwriter!.saveImage({
                      buffer,
                      fileName: img.name || 'pasted-image.png',
                      fileDir: tempDir
                    })
                    if ('error' in result) {
                      console.error('[PreviewEditor] saveImage to temp (fallback) failed:', result.error)
                      const { readImageAsBase64 } = await import(
                        '@milkdown/plugin-upload'
                      )
                      const data = await readImageAsBase64(img)
                      return schema.nodes.image.createAndFill({
                        src: data.src,
                        alt: data.alt
                      })
                    }
                    return schema.nodes.image.createAndFill({
                      src: toFileUrl(`${tempDir}/${result.relativePath}`),
                      alt: img.name || 'image'
                    })
                  })
                )
                return results.filter((r) => r != null) as any[]
              }
              const fileDir = currentFilePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
              if (!fileDir) {
                const tempDir = await window.mdwriter!.getTempDir()
                const results = await Promise.all(
                  images.map(async (img) => {
                    const buffer = await img.arrayBuffer()
                    const result = await window.mdwriter!.saveImage({
                      buffer,
                      fileName: img.name || 'pasted-image.png',
                      fileDir: tempDir
                    })
                    if ('error' in result) {
                      console.error('[PreviewEditor] saveImage to temp (fallback) failed:', result.error)
                      const { readImageAsBase64 } = await import(
                        '@milkdown/plugin-upload'
                      )
                      const data = await readImageAsBase64(img)
                      return schema.nodes.image.createAndFill({
                        src: data.src,
                        alt: data.alt
                      })
                    }
                    return schema.nodes.image.createAndFill({
                      src: toFileUrl(`${tempDir}/${result.relativePath}`),
                      alt: img.name || 'image'
                    })
                  })
                )
                return results.filter((r) => r != null) as any[]
              }

              const results = await Promise.all(
                images.map(async (img) => {
                  const buffer = await img.arrayBuffer()
                  const result = await window.mdwriter!.saveImage({
                    buffer,
                    fileName: img.name || 'pasted-image.png',
                    fileDir
                  })
                  if ('error' in result) {
                    console.error('[PreviewEditor] saveImage to fileDir failed:', result.error)
                    // Fallback to temp dir on error
                    const tempDir = await window.mdwriter!.getTempDir()
                    const retryResult = await window.mdwriter!.saveImage({
                      buffer,
                      fileName: img.name || 'pasted-image.png',
                      fileDir: tempDir
                    })
                    if ('error' in retryResult) {
                      console.error('[PreviewEditor] saveImage to temp (retry) failed:', retryResult.error)
                      const { readImageAsBase64 } = await import(
                        '@milkdown/plugin-upload'
                      )
                      const data = await readImageAsBase64(img)
                      return schema.nodes.image.createAndFill({
                        src: data.src,
                        alt: data.alt
                      })
                    }
                    return schema.nodes.image.createAndFill({
                      src: toFileUrl(`${tempDir}/${retryResult.relativePath}`),
                      alt: img.name || 'image'
                    })
                  }
                  return schema.nodes.image.createAndFill({
                    src: toFileUrl(`${fileDir}/${result.relativePath}`),
                    alt: img.name || 'image'
                  })
                })
              )
              return results.filter((r) => r != null) as any[]
            },
            enableHtmlFileUploader: true,
            uploadWidgetFactory: (pos: number, spec: any) => {
              const widgetDOM = document.createElement('span')
              widgetDOM.textContent = '上传中...'
              return Decoration.widget(pos, widgetDOM, spec)
            }
          })
        })
        .use(commonmark)
        .use(gfm)
        .use(math)
        .use(mermaidDiagramPlugin)
        .use(history)
        .use(codeBlockComponent)
        .use(trailingPluginNoDirty)
        .use(codeBlockShortcuts)
        .use(tableShortcuts)
        .use(selectCurrentTableCellShortcut)
        .use(formattingShortcuts)
        .use(uploadConfig)
        .use(imageUploadPlugin)
        .use(exitCodeBlockAtEnd)
        .use(headingShortcuts)
        .use(selectLineShortcut)
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

    const cell = (event.target as HTMLElement).closest(
      'td, th'
    ) as HTMLElement | null
    const selection = window.getSelection()
    const hasSelection =
      selection !== null &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      container.contains(selection.anchorNode) &&
      container.contains(selection.focusNode)
    const range = hasSelection ? selection?.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    const hasVisibleSelection =
      Boolean(range && rect) && (rect?.width ?? 0) + (rect?.height ?? 0) > 0

    const showFormatBubble = (inTable: boolean): void => {
      if (!range || !rect) return

      const hostRect = container.getBoundingClientRect()
      const bubbleWidth = inTable ? 240 : 300
      const left = Math.min(
        Math.max(
          8,
          rect.left -
            hostRect.left +
            container.scrollLeft +
            rect.width / 2 -
            bubbleWidth / 2
        ),
        Math.max(8, container.clientWidth - bubbleWidth - 8)
      )
      setFormatBubble({
        left,
        top: Math.max(
          8,
          rect.top - hostRect.top + container.scrollTop - 42
        ),
        inTable
      })
    }

    if (cell) {
      if (hasVisibleSelection) {
        hideTableToolbar()
        showFormatBubble(true)
      } else {
        setFormatBubble(null)
        showTableToolbar(cell, container)
      }
      return
    }

    hideTableToolbar()
    if (hasVisibleSelection) {
      showFormatBubble(false)
    } else {
      setFormatBubble(null)
    }
  }

  const runEditorCommand = (commandKey: CmdKey<unknown>): void => {
    const editor = get()
    if (!editor) return
    editor.action((ctx) => {
      ctx.get(commandsCtx).call(commandKey)
    })
    hideTableToolbar()
    setFormatBubble(null)
  }

  const runClipboardAction = (
    action: 'copy' | 'cut' | 'paste'
  ): void => {
    const editor = get()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to } = view.state.selection
      const text = view.state.doc.textBetween(from, to, '\n')

      if (action === 'copy') {
        void copyTextToClipboard(text)
      } else if (action === 'cut') {
        void (async () => {
          if (text) await copyTextToClipboard(text)
          view.dispatch(view.state.tr.deleteSelection())
        })()
      } else {
        void (async () => {
          const clipboardText = await readClipboardText()
          if (!clipboardText) return
          view.focus()
          view.dispatch(view.state.tr.insertText(clipboardText))
        })()
      }
    })
    hideTableToolbar()
    setFormatBubble(null)
  }

  const runTableStructureCommand = (
    action: 'delete-row' | 'delete-col'
  ): void => {
    const editor = get()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const rect = selectedRect(view.state)
      if (action === 'delete-row') {
        const remainingRows = rect.map.height - (rect.bottom - rect.top)
        if (rect.top === 0 || remainingRows < 2) return
        deleteRow(view.state, view.dispatch)
      } else {
        const remainingCols = rect.map.width - (rect.right - rect.left)
        if (remainingCols < 1) return
        deleteColumn(view.state, view.dispatch)
      }
    })
    hideTableToolbar()
    setFormatBubble(null)
  }

  return (
    <div
      ref={containerRef}
      className="milkdown-host"
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleEditorInteraction}
      onKeyUp={handleEditorInteraction}
      onScroll={() => {
        hideTableToolbar()
        setFormatBubble(null)
      }}
    >
      <Milkdown />
      {codeCopied && (
        <div className="copy-success-toast" role="status">
          <Check size={14} />
          <span>复制成功</span>
        </div>
      )}
      {formatBubble && (
        <div
          className="format-bubble"
          style={{ left: formatBubble.left, top: formatBubble.top }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            data-tooltip="复制"
            aria-label="复制"
            onClick={() => runClipboardAction('copy')}
          >
            <ClipboardCopy size={14} />
          </button>
          <button
            type="button"
            data-tooltip="粘贴"
            aria-label="粘贴"
            onClick={() => runClipboardAction('paste')}
          >
            <ClipboardPaste size={14} />
          </button>
          <button
            type="button"
            data-tooltip="剪切"
            aria-label="剪切"
            onClick={() => runClipboardAction('cut')}
          >
            <Scissors size={14} />
          </button>
          <span className="format-bubble-separator" />
          <button
            type="button"
            data-tooltip="加粗"
            aria-label="加粗"
            onClick={() => runEditorCommand(toggleStrongCommand.key)}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            data-tooltip="斜体"
            aria-label="斜体"
            onClick={() => runEditorCommand(toggleEmphasisCommand.key)}
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            data-tooltip="删除线"
            aria-label="删除线"
            onClick={() => runEditorCommand(toggleStrikethroughCommand.key)}
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            data-tooltip="行内代码"
            aria-label="行内代码"
            onClick={() => runEditorCommand(toggleInlineCodeCommand.key)}
          >
            <Code2 size={14} />
          </button>
          {!formatBubble.inTable && (
            <>
              <span className="format-bubble-separator" />
              <button
                type="button"
                data-tooltip="无序列表"
                aria-label="无序列表"
                onClick={() => runEditorCommand(wrapInBulletListCommand.key)}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                data-tooltip="有序列表"
                aria-label="有序列表"
                onClick={() => runEditorCommand(wrapInOrderedListCommand.key)}
              >
                <ListOrdered size={14} />
              </button>
            </>
          )}
        </div>
      )}
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
            onClick={() => runEditorCommand(addRowAfterCommand.key)}
          >
            <Rows3 size={14} />
            <span>加行</span>
          </button>
          <button
            type="button"
            data-tooltip="在右侧增加一列"
            aria-label="在右侧增加一列"
            onClick={() => runEditorCommand(addColAfterCommand.key)}
          >
            <Columns3 size={14} />
            <span>加列</span>
          </button>
          <button
            type="button"
            data-tooltip="删除选中行"
            aria-label="删除选中行"
            onClick={() => runTableStructureCommand('delete-row')}
          >
            <Rows3 size={14} />
            <span>删行</span>
          </button>
          <button
            type="button"
            data-tooltip="删除选中列"
            aria-label="删除选中列"
            onClick={() => runTableStructureCommand('delete-col')}
          >
            <Columns3 size={14} />
            <span>删列</span>
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
