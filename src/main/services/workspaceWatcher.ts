import { existsSync, watch, type FSWatcher } from 'node:fs'

const watchers = new Map<string, FSWatcher>()
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryTimers = new Map<string, ReturnType<typeof setInterval>>()

const REFRESH_DEBOUNCE_MS = 300
const REWATCH_INTERVAL_MS = 2000

/**
 * Watch workspace roots and notify the renderer whenever the filesystem
 * changes (external edits, deletes, renames, new files, ...).
 */
export function setWatchedWorkspaces(
  paths: string[],
  onChanged: (path: string) => void
): void {
  const next = new Set(paths)

  for (const [path, watcher] of watchers) {
    if (next.has(path)) continue
    watcher.close()
    watchers.delete(path)
    stopRetry(path)
    stopRefresh(path)
  }

  for (const path of next) {
    if (!watchers.has(path)) startWatch(path, onChanged)
  }
}

function stopRetry(path: string): void {
  const timer = retryTimers.get(path)
  if (timer) {
    clearInterval(timer)
    retryTimers.delete(path)
  }
}

function stopRefresh(path: string): void {
  const timer = refreshTimers.get(path)
  if (timer) {
    clearTimeout(timer)
    refreshTimers.delete(path)
  }
}

function startWatch(path: string, onChanged: (path: string) => void): void {
  if (!existsSync(path)) {
    scheduleRetry(path, onChanged)
    return
  }

  let watcher: FSWatcher
  try {
    watcher = watch(path, { recursive: true }, () => {
      scheduleRefresh(path, onChanged)
    })
  } catch (error) {
    console.error('[workspaceWatcher] Failed to watch workspace:', path, error)
    // Linux does not support recursive watching; fall back to watching the
    // root directory only so top-level changes still refresh the sidebar.
    try {
      watcher = watch(path, () => {
        scheduleRefresh(path, onChanged)
      })
    } catch (fallbackError) {
      console.error(
        '[workspaceWatcher] Failed to watch workspace (fallback):',
        path,
        fallbackError
      )
      scheduleRetry(path, onChanged)
      return
    }
  }

  watcher.on('error', (error) => {
    console.error('[workspaceWatcher] Workspace watch error:', path, error)
    watcher.close()
    watchers.delete(path)
    scheduleRetry(path, onChanged)
  })

  watchers.set(path, watcher)
  stopRetry(path)
}

function scheduleRefresh(
  path: string,
  onChanged: (path: string) => void
): void {
  stopRefresh(path)
  refreshTimers.set(
    path,
    setTimeout(() => {
      refreshTimers.delete(path)
      onChanged(path)

      // If the workspace root itself was removed, re-register as soon as it
      // reappears so the sidebar keeps following it.
      if (!existsSync(path)) {
        const watcher = watchers.get(path)
        if (watcher) {
          watcher.close()
          watchers.delete(path)
        }
        scheduleRetry(path, onChanged)
      }
    }, REFRESH_DEBOUNCE_MS)
  )
}

function scheduleRetry(path: string, onChanged: (path: string) => void): void {
  if (retryTimers.has(path)) return
  retryTimers.set(
    path,
    setInterval(() => {
      if (existsSync(path) && !watchers.has(path)) {
        startWatch(path, onChanged)
      }
    }, REWATCH_INTERVAL_MS)
  )
}
