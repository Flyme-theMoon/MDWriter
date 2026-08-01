export type EditorMode = 'source' | 'split' | 'preview'

export interface DocumentState {
  id: string
  title: string
  path: string | null
  content: string
  dirty: boolean
}
