import { setBlockType } from '@milkdown/prose/commands'
import { InputRule } from '@milkdown/prose/inputrules'
import type { Node } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'
import type { NodeViewConstructor } from '@milkdown/prose/view'
import {
  $inputRule,
  $nodeSchema,
  $remark,
  $view
} from '@milkdown/utils'
import { renderMermaidToElement } from '../../markdown/mermaid'

function visitDiagramNodes(node: Record<string, unknown>): void {
  if (node.type === 'code' && String(node.lang ?? '').toLowerCase() === 'mermaid') {
    node.type = 'diagram'
    delete node.lang
    return
  }

  const children = node.children
  if (Array.isArray(children)) {
    for (const child of children) {
      visitDiagramNodes(child as Record<string, unknown>)
    }
  }
}

function diagramId(): string {
  return crypto.randomUUID()
}

const remarkDiagram = $remark('mdwriterMermaid', () => () => (tree) => {
  visitDiagramNodes(tree as unknown as Record<string, unknown>)
})

const diagramSchema = $nodeSchema('diagram', () => ({
  content: 'text*',
  group: 'block',
  atom: true,
  defining: true,
  isolating: true,
  attrs: {
    value: { default: '' },
    identity: { default: '' }
  },
  parseDOM: [
    {
      tag: 'div[data-type="diagram"]',
      preserveWhitespace: 'full',
      getAttrs: (dom) => {
        const element = dom as HTMLElement
        return {
          value: element.dataset.value ?? '',
          identity: element.dataset.id ?? ''
        }
      }
    }
  ],
  toDOM: (node) => {
    const element = document.createElement('div')
    element.dataset.type = 'diagram'
    element.dataset.id = node.attrs.identity || diagramId()
    element.dataset.value = node.attrs.value ?? ''
    element.textContent = node.attrs.value ?? ''
    return element
  },
  parseMarkdown: {
    match: ({ type }) => type === 'diagram',
    runner: (state, node, type) => {
      const value = String(node.value ?? '')
      state.addNode(type, { value, identity: diagramId() })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'diagram',
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.value ?? '', {
        lang: 'mermaid'
      })
    }
  }
}))

const insertDiagramInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^```mermaid$/, (state, _match, start, end) => {
      const nodeType = diagramSchema.type(ctx)
      const $start = state.doc.resolve(start)
      if (
        !$start
          .node(-1)
          .canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)
      ) {
        return null
      }
      return state.tr
        .delete(start, end)
        .setBlockType(start, start, nodeType, { identity: diagramId() })
    })
)

class MermaidDiagramView {
  dom: HTMLElement

  private node: Node
  private view: EditorView
  private getPos: () => number | undefined
  private source: string
  private renderVersion = 0
  private sourceMode = false
  private sourceInput: HTMLTextAreaElement | null = null

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.source = String(node.attrs.value ?? '')
    this.dom = document.createElement('div')
    this.dom.className = 'milkdown-diagram'
    this.dom.contentEditable = 'false'
    this.dom.textContent = '渲染中...'
    this.dom.addEventListener('click', this.handleClick)
    void this.render()
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    const source = String(node.attrs.value ?? '')
    if (source === this.source) return true
    this.source = source
    if (this.sourceMode) {
      if (this.sourceInput) this.sourceInput.value = source
    } else {
      void this.render()
    }
    return true
  }

  selectNode(): void {
    this.dom.classList.add('selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('selected')
  }

  stopEvent(): boolean {
    return true
  }

  destroy(): void {
    this.renderVersion += 1
    this.dom.removeEventListener('click', this.handleClick)
  }

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    if (!this.sourceMode) {
      this.enterSourceMode()
      return
    }
    if (target.closest('.milkdown-diagram-back')) {
      this.commitSource()
    }
  }

  private enterSourceMode(): void {
    this.sourceMode = true
    this.dom.className = 'milkdown-diagram source-mode'
    this.dom.replaceChildren()

    const input = document.createElement('textarea')
    input.className = 'milkdown-diagram-source-input'
    input.value = this.source
    input.spellcheck = false
    this.sourceInput = input

    const actionBar = document.createElement('div')
    actionBar.className = 'milkdown-diagram-actions'
    const backButton = document.createElement('button')
    backButton.type = 'button'
    backButton.className = 'milkdown-diagram-back'
    backButton.textContent = '返回图表'
    actionBar.appendChild(backButton)

    this.dom.appendChild(input)
    this.dom.appendChild(actionBar)
    input.focus()
  }

  private commitSource(): void {
    const nextSource = this.sourceInput?.value ?? this.source
    const pos = this.getPos()
    if (typeof pos === 'number') {
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          value: nextSource,
          identity: this.node.attrs.identity
        })
      )
    }
    this.source = nextSource
    this.sourceMode = false
    this.sourceInput = null
    this.dom.className = 'milkdown-diagram'
    void this.render()
  }

  private render(): void {
    const version = ++this.renderVersion
    const dark = document.documentElement.classList.contains('dark')
    void renderMermaidToElement(this.source, this.dom, dark).then(() => {
      if (version !== this.renderVersion) return
    })
  }
}

const mermaidDiagramView = $view(
  diagramSchema.node,
  (): NodeViewConstructor => (node, view, getPos) =>
    new MermaidDiagramView(node, view, getPos)
)

export const mermaidDiagramPlugin = [
  remarkDiagram,
  diagramSchema,
  insertDiagramInputRule,
  mermaidDiagramView
].flat()
