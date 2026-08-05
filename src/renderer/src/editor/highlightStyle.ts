import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Shared VS Code-style syntax colors for code blocks. Colors come from the
// same CSS variables as the preview's hljs tokens, so light/dark themes stay
// in sync and only need to be tuned in one place.
export const vscodeHighlightStyle = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.operatorKeyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.tagName,
      t.heading,
      t.link
    ],
    color: 'var(--hljs-keyword)'
  },
  {
    tag: [t.string, t.special(t.string), t.character, t.labelName],
    color: 'var(--hljs-string)'
  },
  { tag: [t.regexp, t.escape], color: 'var(--hljs-regexp, #d16969)' },
  {
    tag: [t.number, t.bool, t.null, t.atom],
    color: 'var(--hljs-number)'
  },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: 'var(--hljs-comment)',
    fontStyle: 'italic'
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: 'var(--hljs-title)'
  },
  {
    tag: [t.typeName, t.className, t.namespace],
    color: 'var(--hljs-type)'
  },
  {
    tag: [
      t.variableName,
      t.propertyName,
      t.attributeName,
      t.definition(t.variableName)
    ],
    color: 'var(--hljs-attr)'
  },
  {
    tag: [t.operator, t.punctuation, t.bracket, t.meta, t.processingInstruction],
    color: 'var(--hljs-meta)'
  },
  { tag: t.invalid, color: 'var(--hljs-invalid, #f44747)' }
])

// Source/split Markdown editing intentionally keeps only heading-level colors,
// so ordinary Markdown tokens and fenced code do not get noisy highlighting.
export const sourceMarkdownHighlightStyle = HighlightStyle.define([
  {
    tag: [
      t.heading,
      t.heading1,
      t.heading2,
      t.heading3,
      t.heading4,
      t.heading5,
      t.heading6
    ],
    color: 'var(--hljs-keyword)'
  }
])
