import { $ctx, $inputRule, $nodeSchema, $remark } from '@milkdown/utils'
import { nodeRule } from '@milkdown/prose'
import { InputRule } from '@milkdown/prose/inputrules'
import { Fragment } from '@milkdown/prose/model'
import type { KatexOptions } from 'katex'
import katex from 'katex'
import remarkMath from 'remark-math'

// Math support for the Milkdown (preview-edit) mode. This is a reimplementation
// of @milkdown/plugin-math against the project's own @milkdown/utils version:
// remark-math turns $...$ / $$...$$ into mdast nodes, ProseMirror nodes keep
// the TeX source, and node views render it with KaTeX.

const remarkMathPlugin = $remark('mdwriterMath', () => remarkMath)

const katexOptionsCtx = $ctx<Record<string, unknown>, 'mdwriterKatexOptions'>(
  { throwOnError: false },
  'mdwriterKatexOptions'
)

const mathInlineSchema = $nodeSchema('math_inline', (ctx) => ({
  group: 'inline',
  content: 'text*',
  inline: true,
  atom: true,
  parseDOM: [
    {
      tag: 'span[data-type="math_inline"]',
      getContent: (dom, schema) => {
        if (!(dom instanceof HTMLElement)) {
          throw new Error('math_inline parseDOM expects an HTMLElement')
        }
        return Fragment.from(schema.text(dom.dataset.value ?? ''))
      }
    }
  ],
  toDOM: (node) => {
    const value = node.textContent
    const element = document.createElement('span')
    element.dataset.type = 'math_inline'
    element.dataset.value = value
    katex.render(value, element, ctx.get(katexOptionsCtx.key) as KatexOptions)
    return element
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.openNode(type).addText(String(node.value ?? '')).closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.textContent)
    }
  }
}))

const mathInlineInputRule = $inputRule(
  (ctx) =>
    nodeRule(/(?:\$)([^$]+)(?:\$)$/, mathInlineSchema.type(ctx), {
      beforeDispatch: ({ tr, match, start }) => {
        tr.insertText(match[1] ?? '', start + 1)
      }
    })
)

const mathBlockSchema = $nodeSchema('math_block', (ctx) => ({
  content: 'text*',
  group: 'block',
  marks: '',
  defining: true,
  atom: true,
  isolating: true,
  attrs: {
    value: { default: '' }
  },
  parseDOM: [
    {
      tag: 'div[data-type="math_block"]',
      preserveWhitespace: 'full',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? ''
      })
    }
  ],
  toDOM: (node) => {
    const value = String(node.attrs.value ?? '')
    const element = document.createElement('div')
    element.dataset.type = 'math_block'
    element.dataset.value = value
    katex.render(value, element, {
      ...(ctx.get(katexOptionsCtx.key) as KatexOptions),
      displayMode: true
    })
    return element
  },
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => {
      state.addNode(type, { value: String(node.value ?? '') })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => {
      state.addNode('math', undefined, String(node.attrs.value ?? ''))
    }
  }
}))

const mathBlockInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^\$\$\s$/, (state, match, start, end) => {
      const type = mathBlockSchema.type(ctx)
      const $start = state.doc.resolve(start)
      return $start
        .node(-1)
        .canReplaceWith($start.index(-1), $start.indexAfter(-1), type)
        ? state.tr.delete(start, end).setBlockType(start, start, type)
        : null
    })
)

export const math = [
  remarkMathPlugin,
  katexOptionsCtx,
  mathInlineSchema,
  mathBlockSchema,
  mathBlockInputRule,
  mathInlineInputRule
].flat()
