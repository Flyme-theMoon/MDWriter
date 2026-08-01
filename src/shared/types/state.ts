export interface PersistedTab {
  id: string
  title: string
  path: string | null
  content?: string
  dirty: boolean
}

export interface AppState {
  version: 1
  workspaces: string[]
  tabs: PersistedTab[]
  activeTabId: string
  editorMode: 'source' | 'split' | 'preview'
  dark: boolean
  sidebarWidth: number
}
